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
  constructor(private readonly prisma: PrismaService) {}

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

  async addBonusXp(userId: string, amount: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
    });
  }

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

  async getProfile(userId: string): Promise<PlayerBadgesProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        xp: true,
        wins: true,
        matchesPlayed: true,
        currentWinStreak: true,
        bestWinStreak: true,
        badges: { orderBy: { earnedAt: 'asc' } },
      },
    });
    if (!user) {
      return null;
    }
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
