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
import type { Prisma } from '../../generated/prisma/client';
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

@Injectable()
export class TournamentsRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Crée un tournoi en brouillon avec ses entrées initiales (seed attribué dans l'ordre). */
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

  /** Ajoute une entrée au tournoi avec le seed suivant (dernier seed + 1). */
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

  /** Supprime une entrée du tournoi ; retourne false si elle n'existe pas. */
  async removeEntry(tournamentId: string, entryId: string): Promise<boolean> {
    const { count } = await this.prisma.tournamentEntry.deleteMany({
      where: { id: entryId, tournamentId },
    });
    return count > 0;
  }

  /** Retrouve un tournoi complet (entrées, rencontres) par id, ou null. */
  async findById(id: string): Promise<TournamentEntity | null> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: withAll,
    });
    return tournament ? this.toEntity(tournament) : null;
  }

  /** Liste une page de tournois (les plus récents d'abord) avec leurs détails, plus le total. */
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

  /** Nombre de manches (dans un tournoi en cours) que l'utilisateur doit jouer ou valider. */
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

  /** Statut DRAFT requis pour être lancé (vérifié par le service). */
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

  /** Passe le tournoi en statut CANCELLED et clôt ses manches en cours (en litige) pour qu'aucun joueur n'ait plus de score à saisir ou valider. */
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

  /** Met le tournoi en file d'attente (un autre tournoi est en cours). */
  async markQueued(tournamentId: string): Promise<void> {
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.QUEUED, queuedAt: new Date() },
    });
  }

  /** Nombre de tournois en cours (au plus un en régime normal). */
  countInProgress(): Promise<number> {
    return this.prisma.tournament.count({
      where: { status: TournamentStatus.IN_PROGRESS },
    });
  }

  /** Ids des tournois en cours, du plus ancien au plus récent. */
  async listInProgressIds(): Promise<string[]> {
    const rows = await this.prisma.tournament.findMany({
      where: { status: TournamentStatus.IN_PROGRESS },
      orderBy: { startedAt: 'asc' },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Id du tournoi en file d'attente depuis le plus longtemps, ou null. */
  async findNextQueuedId(): Promise<string | null> {
    const next = await this.prisma.tournament.findFirst({
      where: { status: TournamentStatus.QUEUED },
      orderBy: { queuedAt: 'asc' },
      select: { id: true },
    });
    return next?.id ?? null;
  }

  /** Passe le tournoi en COMPLETED et enregistre la date de fin. */
  async complete(tournamentId: string): Promise<void> {
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.COMPLETED, completedAt: new Date() },
    });
  }

  /** Rencontres READY (les deux entrées connues, aucune manche en cours) d'un tournoi. */
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

  /** Retrouve une rencontre avec ses deux entrées, ses manches (triées) et son tournoi. */
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

  /** Retrouve la rencontre d'un tournoi à partir de son tour et de son emplacement dans le tableau. */
  async findTieByRoundSlot(tournamentId: string, round: number, slot: number) {
    return this.prisma.tournamentTie.findUnique({
      where: { tournamentId_round_slot: { tournamentId, round, slot } },
      include: { entryA: true, entryB: true },
    });
  }

  /** Retourne l'id de la rencontre et de la table d'une manche, ou null si le match n'appartient pas à un tournoi. */
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

  /** Crée la manche (Match) suivante d'une rencontre et la lie à la table réservée. */
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

  /** Remet une rencontre au statut READY (prête à être jouée sur une table). */
  markTieReady(tieId: string): Promise<unknown> {
    return this.prisma.tournamentTie.update({
      where: { id: tieId },
      data: { status: TournamentTieStatus.READY },
    });
  }

  /** Clôt une rencontre : statut DONE, entrée gagnante et points attribués. */
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

  /** Fait avancer le vainqueur dans la rencontre du tour suivant ; renvoie true si les 2 côtés de celle-ci sont désormais connus. */
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

  /** Ajoute les points de tournoi à la note de chaque joueur gagnant. */
  async awardRatingBonus(userIds: string[], points: number): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { rating: { increment: points } },
    });
  }

  /** Enregistre sur la manche décisive les points de tournoi gagnés, pour l'historique. */
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

  /** Score + composition de la manche qui vient d'être jouée (pour les badges : victoire/défaite de CETTE manche). */
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

  /** Rencontres encore actives (manche en cours) d'un tournoi, pour libérer leurs tables à l'annulation. */
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

  /** Convertit un tournoi Prisma en TournamentEntity (rencontres converties ; le champion est le vainqueur de la finale une fois le tournoi terminé). */
  private toEntity(tournament: TournamentWithAll): TournamentEntity {
    const totalRounds = tournament.totalRounds ?? 0;
    const ties = tournament.ties.map((tie) =>
      this.tieToEntity(tie, totalRounds, tournament.twoLegged),
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
      entries: tournament.entries.map((entry) => this.entryToEntity(entry)),
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

  /** Convertit une entrée Prisma en TournamentEntryEntity. */
  private entryToEntity(entry: EntryWithPlayers): TournamentEntryEntity {
    return new TournamentEntryEntity({
      id: entry.id,
      seed: entry.seed,
      player1: entry.player1,
      player2: entry.player2,
      eliminatedRound: entry.eliminatedRound,
    });
  }

  /** Convertit une rencontre Prisma en TournamentTieEntity : libellé du tour, manche active, manches jouées/nécessaires et score cumulé. */
  private tieToEntity(
    tie: TieWithDetails,
    totalRounds: number,
    twoLegged: boolean,
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
      entryA: tie.entryA ? this.entryToEntity(tie.entryA) : null,
      entryB: tie.entryB ? this.entryToEntity(tie.entryB) : null,
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
    });
  }
}
