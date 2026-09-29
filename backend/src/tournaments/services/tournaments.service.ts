import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TournamentsRepository } from '../repositories/tournaments.repository';
import { TournamentsGateway } from '../tournaments.gateway';
import { UsersService } from '../../users/services/users.services';
import { TablesService } from '../../tables/services/tables.service';
import { QueueService } from '../../queue/services/queue.service';
import { BadgesService } from '../../badges/services/badges.service';
import { MatchFormat } from '../../matches/entities/match.entity';
import {
  TournamentEntity,
  TournamentStatus,
} from '../entities/tournament.entity';
import {
  isPowerOfTwo,
  log2,
  pointsForRound,
  resolveTie,
  shuffle,
  type TieLeg,
} from '../lib/bracket';

import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { Paginated, toPaginated } from '../../common/pagination/paginated';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

const MIN_ENTRIES = 4;

@Injectable()
export class TournamentsService {
  /** Injecte les dépendances : TournamentsRepository, TournamentsGateway, UsersService, TablesService, QueueService, BadgesService, NotificationsService. */
  constructor(
    private readonly tournamentsRepository: TournamentsRepository,
    private readonly tournamentsGateway: TournamentsGateway,
    private readonly usersService: UsersService,
    private readonly tablesService: TablesService,
    private readonly queueService: QueueService,
    private readonly badgesService: BadgesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Liste une page de tournois. */
  async listPage(page: PageQueryDto): Promise<Paginated<TournamentEntity>> {
    const { tournaments, total } =
      await this.tournamentsRepository.listPage(page);
    return toPaginated(tournaments, total, page);
  }

  /** Nombre de manches de tournoi que l'utilisateur doit jouer ou valider (pastille de la barre latérale). */
  async countPendingActions(userId: string): Promise<{ count: number }> {
    return {
      count: await this.tournamentsRepository.countActiveLegsForUser(userId),
    };
  }

  /** Retrouve un tournoi par id ou lève une NotFoundException. */
  async getById(id: string): Promise<TournamentEntity> {
    const tournament = await this.tournamentsRepository.findById(id);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

  /** Crée un tournoi en brouillon après validation des entrées, puis le diffuse à tous les clients. */
  async create(
    createdById: string,
    name: string,
    format: MatchFormat,
    twoLegged: boolean,
    entries: { player1Id: string; player2Id?: string }[],
  ): Promise<TournamentEntity> {
    await this.validateEntries(format, entries);
    const tournament = await this.tournamentsRepository.create(
      name,
      format,
      twoLegged,
      createdById,
      entries,
    );
    this.tournamentsGateway.broadcast('tournament:created', tournament);
    return tournament;
  }

  /** Ajoute une entrée à un tournoi encore en brouillon, après validation de l'ensemble des entrées, puis diffuse la mise à jour. */
  async addEntry(
    tournamentId: string,
    player1Id: string,
    player2Id: string | undefined,
  ): Promise<TournamentEntity> {
    const tournament = await this.getById(tournamentId);
    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new ConflictException('Tournament is no longer a draft');
    }
    await this.validateEntries(tournament.format, [
      ...tournament.entries.map((entry) => ({
        player1Id: entry.player1.id,
        player2Id: entry.player2?.id,
      })),
      { player1Id, player2Id },
    ]);
    await this.tournamentsRepository.addEntry(
      tournamentId,
      player1Id,
      player2Id,
    );
    const updated = await this.getById(tournamentId);
    this.tournamentsGateway.broadcast('tournament:updated', updated);
    return updated;
  }

  /** Retire une entrée d'un tournoi encore en brouillon puis diffuse la mise à jour. */
  async removeEntry(
    tournamentId: string,
    entryId: string,
  ): Promise<TournamentEntity> {
    const tournament = await this.getById(tournamentId);
    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new ConflictException('Tournament is no longer a draft');
    }
    if (
      !(await this.tournamentsRepository.removeEntry(tournamentId, entryId))
    ) {
      throw new NotFoundException('Entry not found');
    }
    const updated = await this.getById(tournamentId);
    this.tournamentsGateway.broadcast('tournament:updated', updated);
    return updated;
  }

  /** Lance le tournoi : exige un nombre d'entrées puissance de 2 (au moins 4), tire au sort le tableau, réquisitionne les tables (libère les occupants, vide les files), notifie les participants et démarre les premières rencontres. */
  async launch(tournamentId: string): Promise<TournamentEntity> {
    const tournament = await this.getById(tournamentId);
    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new ConflictException('Tournament already launched');
    }
    const count = tournament.entries.length;
    if (!isPowerOfTwo(count) || count < MIN_ENTRIES) {
      throw new BadRequestException(
        `Tournament needs a power-of-two number of entries (4, 8, 16, 32…), got ${count}`,
      );
    }

    const totalRounds = log2(count);
    const shuffledIds = shuffle(tournament.entries.map((entry) => entry.id));
    const firstRoundPairs = Array.from({ length: count / 2 }, (_, slot) => ({
      slot,
      entryAId: shuffledIds[slot * 2],
      entryBId: shuffledIds[slot * 2 + 1],
    }));
    const futureRounds: { round: number; slot: number }[] = [];
    for (let round = 2; round <= totalRounds; round++) {
      const slots = count / 2 ** round;
      for (let slot = 0; slot < slots; slot++) {
        futureRounds.push({ round, slot });
      }
    }

    await this.tournamentsRepository.launch(
      tournamentId,
      totalRounds,
      firstRoundPairs,
      futureRounds,
    );

    // Les tables passent sous contrôle du tournoi : on vide leur file, on
    // annule les groupes et le match en cours, et on prévient les joueurs
    // qui étaient sur la table.
    const tables = await this.tablesService.list();
    for (const table of tables) {
      const previousPlayerIds = await this.queueService.clearForTable(table.id);
      for (const playerId of previousPlayerIds) {
        this.tournamentsGateway.emitToUser(
          playerId,
          'tournament:tableReclaimed',
          {
            tableId: table.id,
            tournamentId,
          },
        );
      }
      await this.notificationsService.createForUsers(
        previousPlayerIds,
        NotificationType.TOURNAMENT_TABLE_RECLAIMED,
        {
          tableId: table.id,
          tableName: table.name,
          tournamentId,
          tournamentName: tournament.name,
        },
      );
    }

    const updated = await this.getById(tournamentId);
    const participantIds = updated.entries.flatMap((entry) =>
      [entry.player1.id, entry.player2?.id].filter((id): id is string => !!id),
    );
    this.tournamentsGateway.emitToUsers(
      participantIds,
      'tournament:launched',
      updated,
    );
    await this.notificationsService.createForUsers(
      participantIds,
      NotificationType.TOURNAMENT_LAUNCHED,
      { tournamentId, tournamentName: updated.name },
    );
    this.tournamentsGateway.broadcast('tournament:updated', updated);

    await this.scheduleFreeTables(tournamentId);
    return this.getById(tournamentId);
  }

  /** Annule un tournoi non terminé : libère les tables des rencontres en cours et diffuse la mise à jour. */
  async cancel(tournamentId: string): Promise<TournamentEntity> {
    const tournament = await this.getById(tournamentId);
    if (
      tournament.status !== TournamentStatus.DRAFT &&
      tournament.status !== TournamentStatus.IN_PROGRESS
    ) {
      throw new ConflictException('Tournament already finished');
    }
    const activeTies =
      await this.tournamentsRepository.findInProgressTies(tournamentId);
    for (const tie of activeTies) {
      const activeLeg = tie.legs[0];
      if (activeLeg?.tableId) {
        await this.tablesService.releaseTournamentClaim(
          activeLeg.tableId,
          tie.id,
        );
      }
    }
    await this.tournamentsRepository.cancel(tournamentId);
    const updated = await this.getById(tournamentId);
    this.tournamentsGateway.broadcast('tournament:updated', updated);
    return updated;
  }

  /** Appelé par MatchesService quand une manche de tournoi vient d'être validée. */
  async handleLegCompleted(matchId: string): Promise<void> {
    const meta = await this.findLegMeta(matchId);
    if (!meta) return;
    const { tieId, tableId } = meta;

    const tie = await this.tournamentsRepository.findTieById(tieId);
    if (!tie || !tie.entryA || !tie.entryB) return;

    if (tableId) {
      await this.tablesService.releaseTournamentClaim(tableId, tieId);
    }

    const legOutcome = await this.tournamentsRepository.getLegOutcome(matchId);
    if (
      legOutcome &&
      legOutcome.scoreA !== null &&
      legOutcome.scoreB !== null
    ) {
      const legTeamA = [
        legOutcome.teamAPlayer1Id,
        legOutcome.teamAPlayer2Id,
      ].filter((id): id is string => !!id);
      const legTeamB = [
        legOutcome.teamBPlayer1Id,
        legOutcome.teamBPlayer2Id,
      ].filter((id): id is string => !!id);
      if (legOutcome.scoreA === legOutcome.scoreB) {
        await this.badgesService.recordDraw([...legTeamA, ...legTeamB]);
      } else {
        const [legWinners, legLosers] =
          legOutcome.scoreA > legOutcome.scoreB
            ? [legTeamA, legTeamB]
            : [legTeamB, legTeamA];
        await this.badgesService.recordGameResult({
          winnerIds: legWinners,
          loserIds: legLosers,
        });
      }
    }

    const legs: TieLeg[] = tie.legs.map((leg) => ({
      legNumber: leg.legNumber ?? 1,
      status: leg.status,
      scoreA: leg.scoreA,
      scoreB: leg.scoreB,
    }));
    const resolution = resolveTie(tie.tournament.twoLegged, legs);

    if (!resolution.done) {
      await this.tournamentsRepository.markTieReady(tieId);
      await this.scheduleFreeTables(tie.tournamentId);
      return;
    }

    const winnerEntry = resolution.winnerSide === 'A' ? tie.entryA : tie.entryB;
    const loserEntry = resolution.winnerSide === 'A' ? tie.entryB : tie.entryA;
    const points = pointsForRound(tie.round);
    await this.tournamentsRepository.markTieDone(tieId, winnerEntry.id, points);
    const winnerIds = [winnerEntry.player1Id, winnerEntry.player2Id].filter(
      (id): id is string => !!id,
    );
    await this.tournamentsRepository.awardRatingBonus(winnerIds, points);

    const allParticipantIds = [
      ...winnerIds,
      ...[loserEntry.player1Id, loserEntry.player2Id].filter(
        (id): id is string => !!id,
      ),
    ];

    if (tie.round === tie.tournament.totalRounds) {
      await this.tournamentsRepository.complete(tie.tournamentId);
      await this.badgesService.awardTournamentChampion(winnerIds);
      const updated = await this.getById(tie.tournamentId);
      this.tournamentsGateway.emitToUsers(
        allParticipantIds,
        'tournament:completed',
        updated,
      );
      await this.notificationsService.createForUsers(
        allParticipantIds,
        NotificationType.TOURNAMENT_COMPLETED,
        { tournamentId: tie.tournamentId, tournamentName: updated.name },
      );
      this.tournamentsGateway.broadcast('tournament:updated', updated);
      return;
    }

    const nextRound = tie.round + 1;
    const nextSlot = Math.floor(tie.slot / 2);
    const side = tie.slot % 2 === 0 ? 'A' : 'B';
    const nextTieReady = await this.tournamentsRepository.advanceWinner(
      tie.tournamentId,
      nextRound,
      nextSlot,
      side,
      winnerEntry.id,
    );
    if (nextTieReady && nextRound === tie.tournament.totalRounds) {
      const finalTie = await this.tournamentsRepository.findTieByRoundSlot(
        tie.tournamentId,
        nextRound,
        nextSlot,
      );
      if (finalTie?.entryA && finalTie.entryB) {
        await this.badgesService.awardTournamentFinalists(
          [
            finalTie.entryA.player1Id,
            finalTie.entryA.player2Id,
            finalTie.entryB.player1Id,
            finalTie.entryB.player2Id,
          ].filter((id): id is string => !!id),
        );
      }
    }

    this.tournamentsGateway.emitToUsers(winnerIds, 'tournament:tieWon', {
      tournamentId: tie.tournamentId,
      round: tie.round,
    });
    await this.notificationsService.createForUsers(
      winnerIds,
      NotificationType.TOURNAMENT_TIE_WON,
      {
        tournamentId: tie.tournamentId,
        tournamentName: tie.tournament.name,
        round: tie.round,
      },
    );
    const loserIds = [loserEntry.player1Id, loserEntry.player2Id].filter(
      (id): id is string => !!id,
    );
    this.tournamentsGateway.emitToUsers(loserIds, 'tournament:eliminated', {
      tournamentId: tie.tournamentId,
      round: tie.round,
    });
    await this.notificationsService.createForUsers(
      loserIds,
      NotificationType.TOURNAMENT_ELIMINATED,
      {
        tournamentId: tie.tournamentId,
        tournamentName: tie.tournament.name,
        round: tie.round,
      },
    );
    const updated = await this.getById(tie.tournamentId);
    this.tournamentsGateway.broadcast('tournament:updated', updated);

    await this.scheduleFreeTables(tie.tournamentId);
  }

  /** Appelé par MatchesService quand une manche de tournoi part en litige (ou expire) : on la rejoue. */
  async handleLegDisputed(matchId: string): Promise<void> {
    const meta = await this.findLegMeta(matchId);
    if (!meta) return;
    const { tieId, tableId } = meta;
    if (tableId) {
      await this.tablesService.releaseTournamentClaim(tableId, tieId);
    }
    await this.tournamentsRepository.markTieReady(tieId);
    const tie = await this.tournamentsRepository.findTieById(tieId);
    if (tie) {
      await this.scheduleFreeTables(tie.tournamentId);
    }
  }

  /** Retourne la rencontre et la table liées à une manche (match) de tournoi, ou null si le match n'en est pas une. */
  private async findLegMeta(
    matchId: string,
  ): Promise<{ tieId: string; tableId: string | null } | null> {
    return this.tournamentsRepository.findLegMeta(matchId);
  }

  /** Distribue les rencontres prêtes sur les tables libres, une table libre <-> une rencontre au hasard. */
  private async scheduleFreeTables(tournamentId: string): Promise<void> {
    const freeTableIds = await this.tablesService.listFreeUnclaimed();
    if (freeTableIds.length === 0) return;
    const readyTies =
      await this.tournamentsRepository.findReadyTies(tournamentId);
    if (readyTies.length === 0) return;

    const tournament = await this.getById(tournamentId);

    for (let i = 0; i < Math.min(freeTableIds.length, readyTies.length); i++) {
      const tableId = freeTableIds[i];
      const tieSummary = readyTies[i];
      const tie = await this.tournamentsRepository.findTieById(tieSummary.id);
      if (!tie || !tie.entryA || !tie.entryB) continue;

      const legs: TieLeg[] = tie.legs.map((leg) => ({
        legNumber: leg.legNumber ?? 1,
        status: leg.status,
        scoreA: leg.scoreA,
        scoreB: leg.scoreB,
      }));
      const resolution = resolveTie(tournament.twoLegged, legs);
      const nextLegNumber = resolution.nextLegNumber ?? 1;

      const claimed = await this.tablesService.claimForTournament(
        tableId,
        tie.id,
      );
      if (!claimed) continue;

      await this.tournamentsRepository.createLeg(
        tie.id,
        nextLegNumber,
        tournament.format,
        tableId,
        { player1Id: tie.entryA.player1Id, player2Id: tie.entryA.player2Id },
        { player1Id: tie.entryB.player1Id, player2Id: tie.entryB.player2Id },
      );

      const participantIds = [
        tie.entryA.player1Id,
        tie.entryA.player2Id,
        tie.entryB.player1Id,
        tie.entryB.player2Id,
      ].filter((id): id is string => !!id);
      this.tournamentsGateway.emitToUsers(
        participantIds,
        'tournament:tieStarted',
        {
          tournamentId,
          tieId: tie.id,
          tableId,
          legNumber: nextLegNumber,
        },
      );
      await this.notificationsService.createForUsers(
        participantIds,
        NotificationType.TOURNAMENT_TIE_STARTED,
        { tournamentId, tournamentName: tournament.name },
      );
    }

    const updated = await this.getById(tournamentId);
    this.tournamentsGateway.broadcast('tournament:updated', updated);
  }

  /** Vérifie les entrées : joueur 2 requis en 2v2 et interdit en 1v1, pas de paire avec soi-même, aucun joueur en double, tous les joueurs existent. */
  private async validateEntries(
    format: MatchFormat,
    entries: { player1Id: string; player2Id?: string }[],
  ): Promise<void> {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (format === MatchFormat.TWO_V_TWO && !entry.player2Id) {
        throw new BadRequestException(
          'player2Id is required for a 2v2 tournament',
        );
      }
      if (format === MatchFormat.ONE_V_ONE && entry.player2Id) {
        throw new BadRequestException(
          'player2Id is not allowed for a 1v1 tournament',
        );
      }
      if (entry.player2Id && entry.player1Id === entry.player2Id) {
        throw new BadRequestException(
          'An entry cannot pair a player with themselves',
        );
      }
      for (const id of [entry.player1Id, entry.player2Id].filter(
        (v): v is string => !!v,
      )) {
        if (seen.has(id)) {
          throw new ConflictException(
            'A player cannot appear in more than one entry',
          );
        }
        seen.add(id);
        if (!(await this.usersService.findUserById(id))) {
          throw new NotFoundException(`Player ${id} not found`);
        }
      }
    }
  }
}
