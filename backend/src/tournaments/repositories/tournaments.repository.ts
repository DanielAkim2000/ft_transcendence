import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TournamentEntity,
  TournamentEntryEntity,
  TournamentStatus,
  TournamentTieEntity,
  TournamentTieStatus,
} from '../entities/tournament.entity';
import { MatchFormat, MatchStatus } from '../../matches/entities/match.entity';
import { roundLabel, resolveTie, type TieLeg } from '../lib/bracket';
import { Prisma } from '../../generated/prisma/client';
import {
  PageQueryDto,
  pageOffset,
} from '../../common/pagination/page-query.dto';

const playerFields = {
  id: true,
  displayname: true,
  avatarUrl: true,
  rating: true,
} as const;

const withEntries = {
  entries: {
    include: {
      player1: { select: playerFields },
      player2: { select: playerFields },
    },
    orderBy: { seed: 'asc' as const },
  },
} satisfies Prisma.TournamentInclude;

const withTies = {
  ties: {
    include: {
      entryA: {
        include: {
          player1: { select: playerFields },
          player2: { select: playerFields },
        },
      },
      entryB: {
        include: {
          player1: { select: playerFields },
          player2: { select: playerFields },
        },
      },
      legs: {
        select: {
          id: true,
          legNumber: true,
          status: true,
          scoreA: true,
          scoreB: true,
          tableId: true,
          submittedById: true,
        },
      },
    },
    orderBy: [{ round: 'asc' as const }, { slot: 'asc' as const }],
  },
} satisfies Prisma.TournamentInclude;

const withAll = {
  createdBy: { select: playerFields },
  ...withEntries,
  ...withTies,
} satisfies Prisma.TournamentInclude;

type TournamentWithAll = Prisma.TournamentGetPayload<{
  include: typeof withAll;
}>;
type TieWithDetails = TournamentWithAll['ties'][number];
type EntryWithPlayers = TournamentWithAll['entries'][number];

/** [Minor · Tournois] Dépôt de données des tournois : requêtes Prisma et conversion en entités. */
@Injectable()
export class TournamentsRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Minor · Tournois] Crée un tournoi en brouillon avec ses entrées initiales (seed attribué dans l'ordre). */
  async create(
    name: string,
    format: MatchFormat,
    twoLegged: boolean,
    createdById: string,
    entries: { player1Id: string; player2Id?: string }[],
  ): Promise<TournamentEntity> {
    const tournament = await this.prisma.tournament.create({
      data: {
        name,
        format,
        twoLegged,
        createdById,
        entries: {
          create: entries.map((entry, index) => ({
            seed: index,
            player1Id: entry.player1Id,
            player2Id: entry.player2Id,
          })),
        },
      },
      include: withAll,
    });
    return this.toEntity(tournament);
  }

  /** [Minor · Tournois] Ajoute une entrée au tournoi avec le seed suivant (dernier seed + 1). */
  async addEntry(
    tournamentId: string,
    player1Id: string,
    player2Id: string | undefined,
  ): Promise<void> {
    const last = await this.prisma.tournamentEntry.findFirst({
      where: { tournamentId },
      orderBy: { seed: 'desc' },
      select: { seed: true },
    });
    await this.prisma.tournamentEntry.create({
      data: {
        tournamentId,
        player1Id,
        player2Id,
        seed: (last?.seed ?? -1) + 1,
      },
    });
  }

  /** [Minor · Tournois] Supprime une entrée du tournoi ; retourne false si elle n'existe pas. */
  async removeEntry(tournamentId: string, entryId: string): Promise<boolean> {
    const { count } = await this.prisma.tournamentEntry.deleteMany({
      where: { id: entryId, tournamentId },
    });
    return count > 0;
  }

  /** [Minor · Tournois] Remplace un joueur d'une entrée par un autre, y compris dans les manches en cours (acceptées ou en attente de validation) de ses rencontres ; les manches terminées gardent le joueur qui les a jouées. Une seule transaction. */
  async replaceEntryPlayer(
    tournamentId: string,
    entryId: string,
    playerId: string,
    replacementId: string,
  ): Promise<void> {
    const live = [MatchStatus.ACCEPTED, MatchStatus.PENDING_VALIDATION];
    await this.prisma.$transaction(async (tx) => {
      const entry = await tx.tournamentEntry.findFirst({
        where: { id: entryId, tournamentId },
        select: { player1Id: true },
      });
      if (!entry) return;
      await tx.tournamentEntry.update({
        where: { id: entryId },
        data:
          entry.player1Id === playerId
            ? { player1Id: replacementId }
            : { player2Id: replacementId },
      });
      const asA = {
        status: { in: live },
        tournamentTie: { entryAId: entryId },
      };
      const asB = {
        status: { in: live },
        tournamentTie: { entryBId: entryId },
      };
      await tx.match.updateMany({
        where: { ...asA, teamAPlayer1Id: playerId },
        data: { teamAPlayer1Id: replacementId },
      });
      await tx.match.updateMany({
        where: { ...asA, teamAPlayer2Id: playerId },
        data: { teamAPlayer2Id: replacementId },
      });
      await tx.match.updateMany({
        where: { ...asB, teamBPlayer1Id: playerId },
        data: { teamBPlayer1Id: replacementId },
      });
      await tx.match.updateMany({
        where: { ...asB, teamBPlayer2Id: playerId },
        data: { teamBPlayer2Id: replacementId },
      });
    });
  }

  /** [Minor · Tournois] Retrouve un tournoi complet (entrées, rencontres) par id, ou null. */
  async findById(id: string): Promise<TournamentEntity | null> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: withAll,
    });
    return tournament ? this.toEntity(tournament) : null;
  }

  /** [Minor · Tournois] Liste une page de tournois (les plus récents d'abord) avec leurs détails, plus le total. */
  async listPage(
    page: PageQueryDto,
  ): Promise<{ tournaments: TournamentEntity[]; total: number }> {
    const [tournaments, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        include: withAll,
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.tournament.count(),
    ]);
    return {
      tournaments: tournaments.map((tournament) => this.toEntity(tournament)),
      total,
    };
  }

  /** [Minor · Tournois] Nombre de manches (dans un tournoi en cours) que l'utilisateur doit jouer ou valider. */
  countActiveLegsForUser(userId: string): Promise<number> {
    return this.prisma.match.count({
      where: {
        OR: [
          { teamAPlayer1Id: userId },
          { teamAPlayer2Id: userId },
          { teamBPlayer1Id: userId },
          { teamBPlayer2Id: userId },
        ],
        tournamentTieId: { not: null },
        status: {
          in: [MatchStatus.ACCEPTED, MatchStatus.PENDING_VALIDATION],
        },
        tournamentTie: { tournament: { status: TournamentStatus.IN_PROGRESS } },
      },
    });
  }

  /** [Minor · Tournois] Statut DRAFT requis pour être lancé (vérifié par le service). */
  async launch(
    tournamentId: string,
    totalRounds: number,
    firstRoundPairs: { slot: number; entryAId: string; entryBId: string }[],
    futureRounds: { round: number; slot: number }[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          status: TournamentStatus.IN_PROGRESS,
          totalRounds,
          startedAt: new Date(),
        },
      }),
      this.prisma.tournamentTie.createMany({
        data: firstRoundPairs.map((pair) => ({
          tournamentId,
          round: 1,
          slot: pair.slot,
          entryAId: pair.entryAId,
          entryBId: pair.entryBId,
          status: TournamentTieStatus.READY,
        })),
      }),
      this.prisma.tournamentTie.createMany({
        data: futureRounds.map((shell) => ({
          tournamentId,
          round: shell.round,
          slot: shell.slot,
          status: TournamentTieStatus.PENDING,
        })),
      }),
    ]);
  }

  /** [Minor · Tournois] Passe le tournoi en statut CANCELLED et clôt ses manches en cours (en litige) pour qu'aucun joueur n'ait plus de score à saisir ou valider. */
  async cancel(tournamentId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.CANCELLED },
      }),
      this.prisma.match.updateMany({
        where: {
          tournamentTie: { tournamentId },
          status: {
            in: [MatchStatus.ACCEPTED, MatchStatus.PENDING_VALIDATION],
          },
        },
        data: { status: MatchStatus.DISPUTED },
      }),
    ]);
  }

  /** [Minor · Tournois] Met le tournoi en file d'attente (un autre tournoi est en cours). */
  async markQueued(tournamentId: string): Promise<void> {
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.QUEUED, queuedAt: new Date() },
    });
  }

  /** [Minor · Tournois] Nombre de tournois en cours (au plus un en régime normal). */
  countInProgress(): Promise<number> {
    return this.prisma.tournament.count({
      where: { status: TournamentStatus.IN_PROGRESS },
    });
  }

  /** [Minor · Tournois] Ids des tournois en cours, du plus ancien au plus récent. */
  async listInProgressIds(): Promise<string[]> {
    const rows = await this.prisma.tournament.findMany({
      where: { status: TournamentStatus.IN_PROGRESS },
      orderBy: { startedAt: 'asc' },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** [Minor · Tournois] Id du tournoi en file d'attente depuis le plus longtemps, ou null. */
  async findNextQueuedId(): Promise<string | null> {
    const next = await this.prisma.tournament.findFirst({
      where: { status: TournamentStatus.QUEUED },
      orderBy: { queuedAt: 'asc' },
      select: { id: true },
    });
    return next?.id ?? null;
  }

  /** [Minor · Tournois] Passe le tournoi en COMPLETED et enregistre la date de fin. */
  async complete(tournamentId: string): Promise<void> {
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.COMPLETED, completedAt: new Date() },
    });
  }

  /** [Minor · Tournois] Rencontres READY (les deux entrées connues, aucune manche en cours) d'un tournoi. */
  async findReadyTies(tournamentId: string) {
    return this.prisma.tournamentTie.findMany({
      where: { tournamentId, status: TournamentTieStatus.READY },
      include: {
        entryA: true,
        entryB: true,
      },
      orderBy: [{ round: 'asc' }, { slot: 'asc' }],
    });
  }

  /** [Minor · Tournois] Retrouve une rencontre avec ses deux entrées, ses manches (triées) et son tournoi. */
  async findTieById(tieId: string) {
    return this.prisma.tournamentTie.findUnique({
      where: { id: tieId },
      include: {
        entryA: true,
        entryB: true,
        legs: { orderBy: { legNumber: 'asc' } },
        tournament: true,
      },
    });
  }

  /** [Minor · Tournois] Retrouve la rencontre d'un tournoi à partir de son tour et de son emplacement dans le tableau. */
  async findTieByRoundSlot(tournamentId: string, round: number, slot: number) {
    return this.prisma.tournamentTie.findUnique({
      where: { tournamentId_round_slot: { tournamentId, round, slot } },
      include: {
        entryA: true,
        entryB: true,
        legs: {
          select: { id: true, status: true, scoreA: true, tableId: true },
        },
      },
    });
  }

  /** [Minor · Tournois] Remplace le score d'une manche de tournoi déjà terminée ; false si la manche n'existe pas ou n'est pas terminée. */
  async updateLegScore(
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: {
        id: matchId,
        status: MatchStatus.COMPLETED,
        tournamentTieId: { not: null },
      },
      data: { scoreA, scoreB },
    });
    return count === 1;
  }

  /** [Minor · Tournois] Supprime une manche de tournoi créée mais jamais jouée (acceptée, sans aucun score) ; false si elle a reçu un score entre-temps. */
  async deleteUnplayedLeg(matchId: string): Promise<boolean> {
    const { count } = await this.prisma.match.deleteMany({
      where: {
        id: matchId,
        status: MatchStatus.ACCEPTED,
        scoreA: null,
        tournamentTieId: { not: null },
      },
    });
    return count === 1;
  }

  /** [Minor · Tournois] Efface l'historique des points de tournoi gagnés enregistré sur une manche. */
  async clearLegRatingDeltas(matchId: string): Promise<void> {
    await this.prisma.match.update({
      where: { id: matchId },
      data: { ratingDeltas: Prisma.DbNull },
    });
  }

  /** [Minor · Tournois] Rouvre une rencontre décidée : prête à être (re)jouée, sans vainqueur ni points. */
  async reopenTie(tieId: string): Promise<void> {
    await this.prisma.tournamentTie.update({
      where: { id: tieId },
      data: {
        status: TournamentTieStatus.READY,
        winnerEntryId: null,
        pointsAwarded: null,
      },
    });
  }

  /** [Minor · Tournois] Vide un côté de la rencontre du tour suivant (le vainqueur qui y avait avancé change) ; la rencontre redevient en attente d'un adversaire. */
  async clearAdvancedEntry(
    tournamentId: string,
    nextRound: number,
    nextSlot: number,
    side: 'A' | 'B',
  ): Promise<void> {
    await this.prisma.tournamentTie.update({
      where: {
        tournamentId_round_slot: {
          tournamentId,
          round: nextRound,
          slot: nextSlot,
        },
      },
      data: {
        ...(side === 'A' ? { entryAId: null } : { entryBId: null }),
        status: TournamentTieStatus.PENDING,
      },
    });
  }

  /** [Minor · Tournois] Retourne l'id de la rencontre et de la table d'une manche, ou null si le match n'appartient pas à un tournoi. */
  async findLegMeta(
    matchId: string,
  ): Promise<{ tieId: string; tableId: string | null } | null> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { tournamentTieId: true, tableId: true },
    });
    if (!match?.tournamentTieId) {
      return null;
    }
    return { tieId: match.tournamentTieId, tableId: match.tableId };
  }

  /** [Minor · Tournois] Crée la manche (Match) suivante d'une rencontre et la lie à la table réservée. */
  async createLeg(
    tieId: string,
    legNumber: number,
    format: MatchFormat,
    tableId: string,
    entryA: { player1Id: string; player2Id: string | null },
    entryB: { player1Id: string; player2Id: string | null },
  ): Promise<string> {
    const match = await this.prisma.match.create({
      data: {
        format,
        status: MatchStatus.ACCEPTED,
        tournamentTieId: tieId,
        legNumber,
        tableId,
        teamAPlayer1Id: entryA.player1Id,
        teamAPlayer2Id: entryA.player2Id,
        teamBPlayer1Id: entryB.player1Id,
        teamBPlayer2Id: entryB.player2Id,
      },
      select: { id: true },
    });
    await this.prisma.tournamentTie.update({
      where: { id: tieId },
      data: { status: TournamentTieStatus.IN_PROGRESS },
    });
    return match.id;
  }

  /** [Minor · Tournois] Remet une rencontre au statut READY (prête à être jouée sur une table). */
  markTieReady(tieId: string): Promise<unknown> {
    return this.prisma.tournamentTie.update({
      where: { id: tieId },
      data: { status: TournamentTieStatus.READY },
    });
  }

  /** [Minor · Tournois] Clôt une rencontre : statut DONE, entrée gagnante et points attribués. */
  async markTieDone(
    tieId: string,
    winnerEntryId: string,
    pointsAwarded: number,
  ): Promise<void> {
    await this.prisma.tournamentTie.update({
      where: { id: tieId },
      data: { status: TournamentTieStatus.DONE, winnerEntryId, pointsAwarded },
    });
  }

  /** [Minor · Tournois] Fait avancer le vainqueur dans la rencontre du tour suivant ; renvoie true si les 2 côtés de celle-ci sont désormais connus. */
  async advanceWinner(
    tournamentId: string,
    nextRound: number,
    nextSlot: number,
    side: 'A' | 'B',
    winnerEntryId: string,
  ): Promise<boolean> {
    const data =
      side === 'A' ? { entryAId: winnerEntryId } : { entryBId: winnerEntryId };
    const updated = await this.prisma.tournamentTie.update({
      where: {
        tournamentId_round_slot: {
          tournamentId,
          round: nextRound,
          slot: nextSlot,
        },
      },
      data,
    });
    if (updated.entryAId && updated.entryBId) {
      await this.prisma.tournamentTie.update({
        where: { id: updated.id },
        data: { status: TournamentTieStatus.READY },
      });
      return true;
    }
    return false;
  }

  /** [Minor · Tournois] Ajoute les points de tournoi à la note de chaque joueur gagnant. */
  async awardRatingBonus(userIds: string[], points: number): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { rating: { increment: points } },
    });
  }

  /** [Minor · Tournois] Enregistre sur la manche décisive les points de tournoi gagnés, pour l'historique. */
  async setLegRatingDeltas(
    matchId: string,
    userIds: string[],
    points: number,
  ): Promise<void> {
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        ratingDeltas: Object.fromEntries(userIds.map((id) => [id, points])),
      },
    });
  }

  /** [Minor · Tournois] Score + composition de la manche qui vient d'être jouée (pour les badges : victoire/défaite de CETTE manche). */
  async getLegOutcome(matchId: string): Promise<{
    scoreA: number | null;
    scoreB: number | null;
    teamAPlayer1Id: string;
    teamAPlayer2Id: string | null;
    teamBPlayer1Id: string;
    teamBPlayer2Id: string | null;
  } | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        scoreA: true,
        scoreB: true,
        teamAPlayer1Id: true,
        teamAPlayer2Id: true,
        teamBPlayer1Id: true,
        teamBPlayer2Id: true,
      },
    });
  }

  /** [Minor · Tournois] Rencontres encore actives (manche en cours) d'un tournoi, pour libérer leurs tables à l'annulation. */
  async findInProgressTies(tournamentId: string) {
    return this.prisma.tournamentTie.findMany({
      where: { tournamentId, status: TournamentTieStatus.IN_PROGRESS },
      include: {
        legs: {
          where: {
            status: {
              in: [MatchStatus.ACCEPTED, MatchStatus.PENDING_VALIDATION],
            },
          },
        },
      },
    });
  }

  /** [Minor · Tournois] Convertit un tournoi Prisma en TournamentEntity (rencontres converties ; le champion est le vainqueur de la finale une fois le tournoi terminé). */
  private toEntity(tournament: TournamentWithAll): TournamentEntity {
    const totalRounds = tournament.totalRounds ?? 0;
    // Une équipe est éliminée au tour où elle perd une rencontre terminée (dérivé des rencontres, jamais stocké : reste juste après une correction de score).
    const eliminatedRounds = new Map<string, number>();
    for (const tie of tournament.ties) {
      if (tie.status !== 'DONE' || !tie.winnerEntryId) continue;
      const loserId =
        tie.entryAId === tie.winnerEntryId ? tie.entryBId : tie.entryAId;
      if (loserId) eliminatedRounds.set(loserId, tie.round);
    }
    const ties = tournament.ties.map((tie) =>
      this.tieToEntity(
        tie,
        totalRounds,
        tournament.twoLegged,
        eliminatedRounds,
      ),
    );
    const finalTie = ties.find((tie) => tie.round === totalRounds);
    return new TournamentEntity({
      id: tournament.id,
      name: tournament.name,
      format: tournament.format as MatchFormat,
      twoLegged: tournament.twoLegged,
      status: tournament.status as TournamentStatus,
      totalRounds: tournament.totalRounds,
      createdBy: tournament.createdBy,
      entries: tournament.entries.map((entry) =>
        this.entryToEntity(entry, eliminatedRounds),
      ),
      ties,
      createdAt: tournament.createdAt,
      startedAt: tournament.startedAt,
      completedAt: tournament.completedAt,
      championEntryId:
        tournament.status === 'COMPLETED'
          ? (finalTie?.winnerEntryId ?? null)
          : null,
    });
  }

  /** [Minor · Tournois] Convertit une entrée Prisma en TournamentEntryEntity. */
  private entryToEntity(
    entry: EntryWithPlayers,
    eliminatedRounds: Map<string, number>,
  ): TournamentEntryEntity {
    return new TournamentEntryEntity({
      id: entry.id,
      seed: entry.seed,
      player1: entry.player1,
      player2: entry.player2,
      eliminatedRound: eliminatedRounds.get(entry.id) ?? null,
    });
  }

  /** [Minor · Tournois] Convertit une rencontre Prisma en TournamentTieEntity : libellé du tour, manche active, manches jouées/nécessaires et score cumulé. */
  private tieToEntity(
    tie: TieWithDetails,
    totalRounds: number,
    twoLegged: boolean,
    eliminatedRounds: Map<string, number>,
  ): TournamentTieEntity {
    const legs: TieLeg[] = tie.legs.map((leg) => ({
      legNumber: leg.legNumber ?? 1,
      status: leg.status,
      scoreA: leg.scoreA,
      scoreB: leg.scoreB,
    }));
    const completedLegs = legs.filter((leg) => leg.status === 'COMPLETED');
    const resolution = resolveTie(twoLegged, legs);
    const activeLeg = tie.legs.find(
      (leg) => leg.status === 'ACCEPTED' || leg.status === 'PENDING_VALIDATION',
    );
    const firstTwo = completedLegs.slice(0, 2);
    return new TournamentTieEntity({
      id: tie.id,
      round: tie.round,
      slot: tie.slot,
      roundLabel: roundLabel(tie.round, totalRounds),
      entryA: tie.entryA
        ? this.entryToEntity(tie.entryA, eliminatedRounds)
        : null,
      entryB: tie.entryB
        ? this.entryToEntity(tie.entryB, eliminatedRounds)
        : null,
      status: tie.status as TournamentTieStatus,
      winnerEntryId: tie.winnerEntryId,
      pointsAwarded: tie.pointsAwarded,
      activeTableId: activeLeg?.tableId ?? null,
      activeLegId: activeLeg?.id ?? null,
      activeLegStatus: activeLeg?.status ?? null,
      activeLegScoreA: activeLeg?.scoreA ?? null,
      activeLegScoreB: activeLeg?.scoreB ?? null,
      activeLegSubmittedById: activeLeg?.submittedById ?? null,
      legsPlayed: completedLegs.length,
      legsNeeded: resolution.nextLegNumber ?? completedLegs.length,
      aggregateScoreA:
        firstTwo.length > 0
          ? firstTwo.reduce((sum, leg) => sum + (leg.scoreA ?? 0), 0)
          : null,
      aggregateScoreB:
        firstTwo.length > 0
          ? firstTwo.reduce((sum, leg) => sum + (leg.scoreB ?? 0), 0)
          : null,
      completedLegs: completedLegs.flatMap((leg) => {
        const source = tie.legs.find(
          (candidate) =>
            candidate.status === 'COMPLETED' &&
            (candidate.legNumber ?? 1) === leg.legNumber,
        );
        return source && leg.scoreA !== null && leg.scoreB !== null
          ? [
              {
                id: source.id,
                legNumber: leg.legNumber,
                scoreA: leg.scoreA,
                scoreB: leg.scoreB,
              },
            ]
          : [];
      }),
    });
  }
}
