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

/** [Minor · Gamification] Dépôt de données des badges, de l'XP et des niveaux : requêtes Prisma et conversion en entités. */
@Injectable()
export class BadgesRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Minor · Gamification] Enregistre une victoire : +1 match, +1 victoire, XP de partie et de victoire, série de victoires incrémentée (et meilleure série mise à jour). */
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

  /** [Minor · Gamification] Enregistre une défaite : +1 match, XP de participation, série de victoires remise à zéro. */
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

  /** [Minor · Gamification] Enregistre un match nul : +1 match, XP de participation, série de victoires remise à zéro. */
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

  /** [Minor · Gamification] Ajuste le décompte de victoires d'un joueur après la correction d'un résultat (+1 ou −1 victoire, avec l'XP de victoire correspondante). */
  async shiftWin(userId: string, delta: 1 | -1): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        wins: { increment: delta },
        xp: { increment: delta * XP_PER_MATCH_WIN_BONUS },
      },
    });
  }

  /** [Minor · Gamification] Recalcule la série de victoires en cours et la meilleure série d'un joueur à partir de ses matchs terminés (dans l'ordre où ils ont été joués). */
  async recomputeStreaks(userId: string): Promise<void> {
    const matches = await this.prisma.match.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { teamAPlayer1Id: userId },
          { teamAPlayer2Id: userId },
          { teamBPlayer1Id: userId },
          { teamBPlayer2Id: userId },
        ],
      },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        scoreA: true,
        scoreB: true,
        teamAPlayer1Id: true,
        teamAPlayer2Id: true,
      },
    });
    let current = 0;
    let best = 0;
    for (const match of matches) {
      if (match.scoreA === null || match.scoreB === null) continue;
      const inTeamA =
        match.teamAPlayer1Id === userId || match.teamAPlayer2Id === userId;
      const won = inTeamA
        ? match.scoreA > match.scoreB
        : match.scoreB > match.scoreA;
      current = won ? current + 1 : 0;
      best = Math.max(best, current);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { currentWinStreak: current, bestWinStreak: best },
    });
  }

  /** [Minor · Gamification] Ajoute un montant d'XP bonus à l'utilisateur. */
  async addBonusXp(userId: string, amount: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
    });
  }

  /** [Minor · Gamification] Retourne les statistiques de jeu de l'utilisateur (victoires, matchs, séries), ou null s'il n'existe pas. */
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

  /** [Minor · Gamification] Retourne true si le badge vient d'être débloqué (false s'il l'était déjà). */
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

  /** [Minor · Gamification] Construit le profil complet du joueur (XP, niveau, progression, stats, badges obtenus), ou null s'il n'existe pas. */
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
