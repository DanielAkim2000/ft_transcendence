import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BadgeCode,
  PlayerBadgesProfile,
  UserBadgeEntity,
} from '../entities/badge.entity';
import {
  levelForXp,
  xpIntoLevel,
  xpPerLevel,
  XP_PER_MATCH_PLAYED,
  XP_PER_MATCH_WIN_BONUS,
} from '../lib/xp';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class BadgesRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre une victoire : +1 match, +1 victoire, XP de partie et de victoire, série de victoires incrémentée (et meilleure série mise à jour). */
  async recordWin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentWinStreak: true, bestWinStreak: true },
    });
    const nextStreak = user.currentWinStreak + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        matchesPlayed: { increment: 1 },
        wins: { increment: 1 },
        xp: { increment: XP_PER_MATCH_PLAYED + XP_PER_MATCH_WIN_BONUS },
        currentWinStreak: nextStreak,
        bestWinStreak: Math.max(nextStreak, user.bestWinStreak),
      },
    });
  }

  /** Enregistre une défaite : +1 match, XP de participation, série de victoires remise à zéro. */
  async recordLoss(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        matchesPlayed: { increment: 1 },
        xp: { increment: XP_PER_MATCH_PLAYED },
        currentWinStreak: 0,
      },
    });
  }

  /** Enregistre un match nul : +1 match, XP de participation, série de victoires remise à zéro. */
  async recordDraw(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        matchesPlayed: { increment: 1 },
        xp: { increment: XP_PER_MATCH_PLAYED },
        currentWinStreak: 0,
      },
    });
  }

  /** Ajoute un montant d'XP bonus à l'utilisateur. */
  async addBonusXp(userId: string, amount: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
    });
  }

  /** Retourne les statistiques de jeu de l'utilisateur (victoires, matchs, séries), ou null s'il n'existe pas. */
  async getStats(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        wins: true,
        matchesPlayed: true,
        currentWinStreak: true,
        bestWinStreak: true,
      },
    });
  }

  /** Retourne true si le badge vient d'être débloqué (false s'il l'était déjà). */
  async award(userId: string, code: BadgeCode): Promise<boolean> {
    try {
      await this.prisma.userBadge.create({ data: { userId, code } });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  /** Construit le profil complet du joueur (XP, niveau, progression, stats, badges obtenus), ou null s'il n'existe pas. */
  async getProfile(userId: string): Promise<PlayerBadgesProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        xp: true,
        wins: true,
        matchesPlayed: true,
        currentWinStreak: true,
        bestWinStreak: true,
        rating: true,
        deletedAt: true,
        badges: { orderBy: { earnedAt: 'asc' } },
      },
    });
    if (!user) {
      return null;
    }
    const active = { deletedAt: null };
    const [better, totalPlayers] = await Promise.all([
      this.prisma.user.count({
        where: { ...active, rating: { gt: user.rating } },
      }),
      this.prisma.user.count({ where: active }),
    ]);
    return new PlayerBadgesProfile({
      userId,
      xp: user.xp,
      level: levelForXp(user.xp),
      xpIntoLevel: xpIntoLevel(user.xp),
      xpPerLevel: xpPerLevel(),
      wins: user.wins,
      matchesPlayed: user.matchesPlayed,
      currentWinStreak: user.currentWinStreak,
      bestWinStreak: user.bestWinStreak,
      rating: user.rating,
      rank: user.deletedAt ? null : better + 1,
      totalPlayers,
      badges: user.badges.map(
        (badge) =>
          new UserBadgeEntity({
            code: badge.code as BadgeCode,
            earnedAt: badge.earnedAt,
          }),
      ),
    });
  }
}
