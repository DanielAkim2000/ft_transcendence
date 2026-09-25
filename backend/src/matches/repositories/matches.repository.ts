import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MatchEntity,
  MatchFormat,
  MatchStatus,
} from '../entities/match.entity';
import type { EloPlayerInput, EloPlayerResult } from '../lib/elo';
import type { Prisma } from '../../generated/prisma/client';

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

type MatchWithPlayers = Prisma.MatchGetPayload<{ include: typeof withPlayers }> & {
  tournamentTie?: {
    round: number;
    tournament: { id: string; name: string };
  } | null;
};

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
  constructor(private readonly prisma: PrismaService) {}

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

  async findById(id: string): Promise<MatchEntity | null> {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: withPlayers,
    });
    return match ? this.toEntity(match) : null;
  }

  /** Historique de la ladder (défis) uniquement : les manches de tournoi ont leur propre page. */
  async listForUser(userId: string): Promise<MatchEntity[]> {
    const matches = await this.prisma.match.findMany({
      where: { ...involvesUser(userId), tournamentTieId: null },
      include: withPlayers,
      orderBy: { updatedAt: 'desc' },
    });
    return matches.map((match) => this.toEntity(match));
  }

  /** Historique complet : tous les matchs terminés (ladder + manches de tournoi). */
  async listHistoryForUser(userId: string): Promise<MatchEntity[]> {
    const matches = await this.prisma.match.findMany({
      where: { ...involvesUser(userId), status: MatchStatus.COMPLETED },
      include: withTournament,
      orderBy: { createdAt: 'desc' },
    });
    return matches.map((match) => this.toEntity(match));
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
    const notNull = (player: EloPlayerInput | null): player is EloPlayerInput =>
      player !== null;
    return {
      teamA: [match.teamAPlayer1, match.teamAPlayer2].filter(notNull),
      teamB: [match.teamBPlayer1, match.teamBPlayer2].filter(notNull),
    };
  }

  // matchesPlayed/xp sont gérés exclusivement par BadgesService (recordGameResult) :
  // ne pas les incrémenter ici pour éviter un double comptage.
  async applyEloUpdates(results: EloPlayerResult[]): Promise<void> {
    await this.prisma.$transaction(
      results.map((result) =>
        this.prisma.user.update({
          where: { id: result.id },
          data: { rating: result.ratingAfter },
        }),
      ),
    );
  }

  private toEntity(match: MatchWithPlayers): MatchEntity {
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
      createdAt: match.createdAt,
      respondedAt: match.respondedAt,
      submittedAt: match.submittedAt,
      validationExpiresAt: match.validationExpiresAt,
      tournamentTieId: match.tournamentTieId,
      legNumber: match.legNumber,
      tournamentId: match.tournamentTie?.tournament.id ?? null,
      tournamentName: match.tournamentTie?.tournament.name ?? null,
      tournamentRound: match.tournamentTie?.round ?? null,
    });
  }
}
