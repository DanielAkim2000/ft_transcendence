import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MatchEntity,
  MatchFormat,
  MatchStatus,
} from '../entities/match.entity';
import { HistoryQueryDto } from '../dtos/history-query.dto';
import type { EloPlayerInput, EloPlayerResult } from '../lib/elo';
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
  matchesPlayed: true,
} as const;

const withPlayers = {
  teamAPlayer1: { select: playerFields },
  teamAPlayer2: { select: playerFields },
  teamBPlayer1: { select: playerFields },
  teamBPlayer2: { select: playerFields },
  submittedBy: { select: playerFields },
  validatedBy: { select: playerFields },
} satisfies Prisma.MatchInclude;

const withTournament = {
  ...withPlayers,
  tournamentTie: {
    select: {
      round: true,
      tournament: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.MatchInclude;

type MatchWithPlayers = Prisma.MatchGetPayload<{
  include: typeof withPlayers;
}> & {
  tournamentTie?: {
    round: number;
    tournament: { id: string; name: string };
  } | null;
};

/** Filtre Prisma : matchs où l'utilisateur est l'un des (jusqu'à 4) joueurs. */
const involvesUser = (userId: string): Prisma.MatchWhereInput => ({
  OR: [
    { teamAPlayer1Id: userId },
    { teamAPlayer2Id: userId },
    { teamBPlayer1Id: userId },
    { teamBPlayer2Id: userId },
  ],
});

@Injectable()
export class MatchesRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Crée un match PENDING avec le challenger (et son coéquipier en 2v2) en équipe A et l'adversaire en équipe B. */
  async create(
    format: MatchFormat,
    challengerId: string,
    opponentId: string,
    challengerTeammateId?: string,
  ): Promise<MatchEntity> {
    const match = await this.prisma.match.create({
      data: {
        format,
        teamAPlayer1Id: challengerId,
        teamAPlayer2Id: challengerTeammateId,
        teamBPlayer1Id: opponentId,
      },
      include: withPlayers,
    });
    return this.toEntity(match);
  }

  /** Retrouve un match par son id avec ses joueurs, ou null. */
  async findById(id: string): Promise<MatchEntity | null> {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: withPlayers,
    });
    return match ? this.toEntity(match) : null;
  }

  /** Défis de la ladder (hors manches de tournoi, qui ont leur propre page) et hors défis refusés : une page, les plus récemment modifiés d'abord, plus le total. */
  async listForUser(
    userId: string,
    page: PageQueryDto,
  ): Promise<{ matches: MatchEntity[]; total: number }> {
    const where: Prisma.MatchWhereInput = {
      ...involvesUser(userId),
      tournamentTieId: null,
      status: { not: MatchStatus.DECLINED },
    };
    const [matches, total] = await this.prisma.$transaction([
      this.prisma.match.findMany({
        where,
        include: withPlayers,
        orderBy: { updatedAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.match.count({ where }),
    ]);
    return { matches: matches.map((match) => this.toEntity(match)), total };
  }

  /** Historique : matchs terminés (ladder + manches de tournoi) filtrés par nom de joueur, résultat, format et origine, triés, une page plus le total. */
  async listHistoryForUser(
    userId: string,
    query: HistoryQueryDto,
  ): Promise<{ matches: MatchEntity[]; total: number }> {
    const { q, result, format, source, sort } = query;
    const scoreB = this.prisma.match.fields.scoreB;
    const scoreA = this.prisma.match.fields.scoreA;
    const and: Prisma.MatchWhereInput[] = [
      involvesUser(userId),
      { status: MatchStatus.COMPLETED },
    ];
    if (format) {
      and.push({ format });
    }
    if (source) {
      and.push({ tournamentTieId: source === 'ladder' ? null : { not: null } });
    }
    if (q?.trim()) {
      const name = { contains: q.trim(), mode: 'insensitive' as const };
      const other = { id: { not: userId }, displayname: name };
      and.push({
        OR: [
          { teamAPlayer1: other },
          { teamAPlayer2: other },
          { teamBPlayer1: other },
          { teamBPlayer2: other },
        ],
      });
    }
    if (result) {
      const iAmA = {
        OR: [{ teamAPlayer1Id: userId }, { teamAPlayer2Id: userId }],
      };
      const iAmB = {
        OR: [{ teamBPlayer1Id: userId }, { teamBPlayer2Id: userId }],
      };
      and.push(
        result === 'win'
          ? {
              OR: [
                { AND: [iAmA, { scoreA: { gt: scoreB } }] },
                { AND: [iAmB, { scoreB: { gt: scoreA } }] },
              ],
            }
          : {
              OR: [
                { AND: [iAmA, { scoreA: { lt: scoreB } }] },
                { AND: [iAmB, { scoreB: { lt: scoreA } }] },
              ],
            },
      );
    }
    const where: Prisma.MatchWhereInput = { AND: and };
    const skip = pageOffset(query);

    let matches: MatchWithPlayers[];
    let total: number;
    if (sort === 'score') {
      // Prisma ne trie pas sur une différence de colonnes : on trie en mémoire
      // l'ensemble filtré (historique d'un seul joueur, donc petit), puis on pagine.
      const [all, count] = await this.prisma.$transaction([
        this.prisma.match.findMany({ where, include: withTournament }),
        this.prisma.match.count({ where }),
      ]);
      const gap = (m: { scoreA: number | null; scoreB: number | null }) =>
        Math.abs((m.scoreA ?? 0) - (m.scoreB ?? 0));
      all.sort(
        (a, b) =>
          gap(b) - gap(a) || b.createdAt.getTime() - a.createdAt.getTime(),
      );
      matches = all.slice(skip, skip + query.limit);
      total = count;
    } else {
      [matches, total] = await this.prisma.$transaction([
        this.prisma.match.findMany({
          where,
          include: withTournament,
          orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
          skip,
          take: query.limit,
        }),
        this.prisma.match.count({ where }),
      ]);
    }
    return { matches: matches.map((match) => this.toEntity(match)), total };
  }

  /** Nombre de défis de la ladder qui attendent une action de l'utilisateur : répondre à un défi reçu, jouer un match accepté, ou valider un score soumis par l'équipe adverse. */
  async countActionableForUser(userId: string): Promise<number> {
    const matches = await this.prisma.match.findMany({
      where: {
        ...involvesUser(userId),
        tournamentTieId: null,
        status: {
          in: [
            MatchStatus.PENDING,
            MatchStatus.ACCEPTED,
            MatchStatus.PENDING_VALIDATION,
          ],
        },
      },
      select: {
        status: true,
        teamAPlayer1Id: true,
        teamAPlayer2Id: true,
        teamBPlayer1Id: true,
        submittedById: true,
      },
    });
    return matches.filter((match) => {
      const status = match.status as MatchStatus;
      if (status === MatchStatus.PENDING) {
        return match.teamBPlayer1Id === userId;
      }
      if (status === MatchStatus.ACCEPTED) {
        return true;
      }
      const teamAIds = [match.teamAPlayer1Id, match.teamAPlayer2Id];
      const iAmTeamA = teamAIds.includes(userId);
      const submitterIsTeamA =
        match.submittedById !== null && teamAIds.includes(match.submittedById);
      return match.submittedById !== null && iAmTeamA !== submitterIsTeamA;
    }).length;
  }

  /** Atomique : seul le destinataire du défi peut le refuser, tant qu'il est en attente. */
  async decline(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: { id, teamBPlayer1Id: userId, status: MatchStatus.PENDING },
      data: { status: MatchStatus.DECLINED, respondedAt: new Date() },
    });
    return count === 1;
  }

  /** Atomique : seul le destinataire peut accepter (et fournir son coéquipier en 2v2). */
  async accept(
    id: string,
    userId: string,
    teammateId?: string,
  ): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: { id, teamBPlayer1Id: userId, status: MatchStatus.PENDING },
      data: {
        status: MatchStatus.ACCEPTED,
        teamBPlayer2Id: teammateId,
        respondedAt: new Date(),
      },
    });
    return count === 1;
  }

  /** Atomique : ne réussit que si le match est encore accepté (pas déjà soumis). */
  async submitScore(
    id: string,
    userId: string,
    scoreA: number,
    scoreB: number,
    validationExpiresAt: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: { id, status: MatchStatus.ACCEPTED, ...involvesUser(userId) },
      data: {
        status: MatchStatus.PENDING_VALIDATION,
        scoreA,
        scoreB,
        submittedById: userId,
        submittedAt: new Date(),
        validationExpiresAt,
      },
    });
    return count === 1;
  }

  /** Atomique : ne réussit que si le score est encore en attente de validation. */
  async completeWithValidation(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: { id, status: MatchStatus.PENDING_VALIDATION },
      data: { status: MatchStatus.COMPLETED, validatedById: userId },
    });
    return count === 1;
  }

  /** Atomique : litige, manuel ou après expiration du délai de validation. */
  async dispute(id: string, userId?: string): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: { id, status: MatchStatus.PENDING_VALIDATION },
      data: { status: MatchStatus.DISPUTED, validatedById: userId },
    });
    return count === 1;
  }

  /** Notes + nb de matchs des 4 joueurs, pour le calcul Elo côté service. */
  async getTeamsForElo(
    id: string,
  ): Promise<{ teamA: EloPlayerInput[]; teamB: EloPlayerInput[] } | null> {
    const eloFields = { id: true, rating: true, matchesPlayed: true } as const;
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: {
        teamAPlayer1: { select: eloFields },
        teamAPlayer2: { select: eloFields },
        teamBPlayer1: { select: eloFields },
        teamBPlayer2: { select: eloFields },
      },
    });
    if (!match) {
      return null;
    }
    /** Type guard : écarte les joueurs absents (null), par exemple l'équipier d'un 1v1. */
    const notNull = (player: EloPlayerInput | null): player is EloPlayerInput =>
      player !== null;
    return {
      teamA: [match.teamAPlayer1, match.teamAPlayer2].filter(notNull),
      teamB: [match.teamBPlayer1, match.teamBPlayer2].filter(notNull),
    };
  }

  /** Enregistre en base les nouvelles notes Elo de chaque joueur, en une seule transaction. */
  // matchesPlayed/xp sont gérés exclusivement par BadgesService (recordGameResult) :
  // ne pas les incrémenter ici pour éviter un double comptage.
  async applyEloUpdates(
    matchId: string,
    results: EloPlayerResult[],
  ): Promise<void> {
    const ratingDeltas = Object.fromEntries(
      results.map((result) => [
        result.id,
        result.ratingAfter - result.ratingBefore,
      ]),
    );
    await this.prisma.$transaction([
      ...results.map((result) =>
        this.prisma.user.update({
          where: { id: result.id },
          data: { rating: result.ratingAfter },
        }),
      ),
      this.prisma.match.update({
        where: { id: matchId },
        data: { ratingDeltas },
      }),
    ]);
  }

  /** Convertit une ligne Prisma en MatchEntity (équipes, scores, infos publiques des joueurs, infos de tournoi). */
  private toEntity(match: MatchWithPlayers): MatchEntity {
    /** Réduit un joueur Prisma à ses champs publics (id, nom, avatar, note), ou null. */
    const publicPlayer = (
      player: {
        id: string;
        displayname: string;
        avatarUrl: string | null;
        rating: number;
      } | null,
    ) =>
      player
        ? {
            id: player.id,
            displayname: player.displayname,
            avatarUrl: player.avatarUrl,
            rating: player.rating,
          }
        : null;
    const teamA = [match.teamAPlayer1, match.teamAPlayer2]
      .map(publicPlayer)
      .filter(
        (player): player is NonNullable<typeof player> => player !== null,
      );
    const teamB = [match.teamBPlayer1, match.teamBPlayer2]
      .map(publicPlayer)
      .filter(
        (player): player is NonNullable<typeof player> => player !== null,
      );
    return new MatchEntity({
      id: match.id,
      format: match.format as MatchFormat,
      status: match.status as MatchStatus,
      teamA,
      teamB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      submittedBy: publicPlayer(match.submittedBy),
      validatedBy: publicPlayer(match.validatedBy),
      ratingDeltas:
        (match.ratingDeltas as Record<string, number> | null) ?? null,
      createdAt: match.createdAt,
      respondedAt: match.respondedAt,
      submittedAt: match.submittedAt,
      validationExpiresAt: match.validationExpiresAt,
      tournamentTieId: match.tournamentTieId,
      legNumber: match.legNumber,
      tournamentId: match.tournamentTie?.tournament.id ?? null,
      tournamentName: match.tournamentTie?.tournament.name ?? null,
      tournamentRound: match.tournamentTie?.round ?? null,
      tableId: match.tableId,
    });
  }
}
