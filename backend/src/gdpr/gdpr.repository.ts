import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const names = { select: { id: true, displayname: true } } as const;

/** Nom affiché à la place d'un joueur dont le compte a été supprimé. */
export const ANONYMOUS_NAME = 'Deleted user';

@Injectable()
export class GdprRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Toutes les données personnelles d'un utilisateur, sans secrets (hash du mot de passe, secrets 2FA, jetons) ni contenu d'autres personnes (seuls les messages qu'il a écrits). */
  async collectUserData(userId: string) {
    const involved = [
      { teamAPlayer1Id: userId },
      { teamAPlayer2Id: userId },
      { teamBPlayer1Id: userId },
      { teamBPlayer2Id: userId },
    ];
    const [
      profile,
      friendships,
      matches,
      badges,
      notifications,
      conversations,
      blocks,
      tournamentEntries,
      tournamentsCreated,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          login42: true,
          email: true,
          displayname: true,
          avatarUrl: true,
          twoFactorEnabled: true,
          role: true,
          theme: true,
          language: true,
          rating: true,
          matchesPlayed: true,
          wins: true,
          xp: true,
          currentWinStreak: true,
          bestWinStreak: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        select: {
          status: true,
          createdAt: true,
          requester: names,
          addressee: names,
        },
      }),
      this.prisma.match.findMany({
        where: { OR: involved },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          format: true,
          status: true,
          scoreA: true,
          scoreB: true,
          ratingDeltas: true,
          createdAt: true,
          legNumber: true,
          teamAPlayer1: names,
          teamAPlayer2: names,
          teamBPlayer1: names,
          teamBPlayer2: names,
        },
      }),
      this.prisma.userBadge.findMany({
        where: { userId },
        select: { code: true, earnedAt: true },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { type: true, data: true, read: true, createdAt: true },
      }),
      this.prisma.conversation.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: {
          userA: names,
          userB: names,
          messages: {
            where: { senderId: userId },
            orderBy: { createdAt: 'asc' },
            select: { content: true, createdAt: true },
          },
        },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { createdAt: true, blocked: names },
      }),
      this.prisma.tournamentEntry.findMany({
        where: { OR: [{ player1Id: userId }, { player2Id: userId }] },
        select: {
          seed: true,
          eliminatedRound: true,
          tournament: { select: { name: true, status: true } },
        },
      }),
      this.prisma.tournament.findMany({
        where: { createdById: userId },
        select: { name: true, status: true, createdAt: true },
      }),
    ]);
    return {
      profile,
      friendships,
      matches,
      badges,
      notifications,
      conversations,
      blocks,
      tournamentEntries,
      tournamentsCreated,
    };
  }

  /** Raisons qui empêchent de supprimer le compte : tournois créés encore ouverts, participation à un tournoi non terminé (le tableau serait cassé) ou partie de babyfoot en cours. */
  async findDeletionBlockers(userId: string): Promise<{
    openTournamentsCreated: number;
    openTournamentsJoined: number;
    onTable: number;
  }> {
    const open: ('DRAFT' | 'IN_PROGRESS')[] = ['DRAFT', 'IN_PROGRESS'];
    const [openTournamentsCreated, openTournamentsJoined, onTable] =
      await Promise.all([
        this.prisma.tournament.count({
          where: { createdById: userId, status: { in: open } },
        }),
        this.prisma.tournament.count({
          where: {
            status: { in: open },
            entries: {
              some: { OR: [{ player1Id: userId }, { player2Id: userId }] },
            },
          },
        }),
        this.prisma.queueGroupMember.count({
          where: { userId, group: { status: 'ON_TABLE' } },
        }),
      ]);
    return { openTournamentsCreated, openTournamentsJoined, onTable };
  }

  /**
   * Efface les données personnelles et anonymise le compte, en une transaction.
   * La ligne User est conservée (sous un nom neutre, sans email ni identifiant)
   * pour que les matchs terminés, les notes Elo et les tournois des autres
   * joueurs restent intacts ; tout le reste (amis, conversations, badges,
   * notifications, file d'attente, défis non terminés, sessions) est supprimé.
   */
  async anonymizeUser(userId: string): Promise<void> {
    const involved = [
      { teamAPlayer1Id: userId },
      { teamAPlayer2Id: userId },
      { teamBPlayer1Id: userId },
      { teamBPlayer2Id: userId },
    ];
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      }),
      // Les messages partent avec la conversation (cascade).
      this.prisma.conversation.deleteMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }),
      this.prisma.block.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.userBadge.deleteMany({ where: { userId } }),
      this.prisma.tableReleaseVote.deleteMany({ where: { userId } }),
      this.prisma.queueGroup.deleteMany({
        where: { members: { some: { userId } } },
      }),
      // Défis en cours ou refusés : sans intérêt pour l'historique des autres.
      this.prisma.match.deleteMany({
        where: {
          OR: involved,
          tournamentTieId: null,
          status: {
            in: ['PENDING', 'ACCEPTED', 'PENDING_VALIDATION', 'DECLINED'],
          },
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          displayname: ANONYMOUS_NAME,
          email: `deleted+${userId}@deleted.invalid`,
          login42: null,
          avatarUrl: null,
          passwordHash: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
          isOnline: false,
          status: 'OFFLINE',
          role: 'USER',
        },
      }),
    ]);
  }
}
