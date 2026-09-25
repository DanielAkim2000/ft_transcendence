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

const MIN_ENTRIES = 4;

@Injectable()
export class TournamentsService {
  constructor(
    private readonly tournamentsRepository: TournamentsRepository,
    private readonly tournamentsGateway: TournamentsGateway,
    private readonly usersService: UsersService,
    private readonly tablesService: TablesService,
    private readonly queueService: QueueService,
    private readonly badgesService: BadgesService,
  ) {}

  listAll(): Promise<TournamentEntity[]> {
    return this.tournamentsRepository.listAll();
  }

  async getById(id: string): Promise<TournamentEntity> {
    const tournament = await this.tournamentsRepository.findById(id);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

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

    // Les 2 tables passent sous contrôle du tournoi : on libère de force
    // l'occupant en cours (s'il y en a un) et on vide leurs files d'attente.
    const tables = await this.tablesService.list();
    for (const table of tables) {
      const previousOccupantId = await this.tablesService.forceRelease(
        table.id,
      );
      if (previousOccupantId) {
        this.tournamentsGateway.emitToUser(
          previousOccupantId,
          'tournament:tableReclaimed',
          {
            tableId: table.id,
            tournamentId,
          },
        );
      }
      await this.queueService.clearForTable(table.id);
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
    this.tournamentsGateway.broadcast('tournament:updated', updated);

    await this.scheduleFreeTables(tournamentId);
    return this.getById(tournamentId);
  }

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
    this.tournamentsGateway.emitToUsers(
      [loserEntry.player1Id, loserEntry.player2Id].filter(
        (id): id is string => !!id,
      ),
      'tournament:eliminated',
      { tournamentId: tie.tournamentId, round: tie.round },
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
    }

    const updated = await this.getById(tournamentId);
    this.tournamentsGateway.broadcast('tournament:updated', updated);
  }

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
