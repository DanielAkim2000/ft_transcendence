import { Injectable, NotFoundException } from '@nestjs/common';
import { BadgesRepository } from '../repositories/badges.repository';
import { BadgesGateway } from '../badges.gateway';
import { BadgeCode, PlayerBadgesProfile } from '../entities/badge.entity';
import {
  GIANT_SLAYER_RATING_GAP,
  XP_PER_TOURNAMENT_WIN_BONUS,
} from '../lib/xp';

export interface GameResultInput {
  winnerIds: string[];
  loserIds: string[];
  /** Comparaison de note pertinente uniquement pour les défis du classement (pas les tournois). */
  checkGiantSlayer?: boolean;
  winnerAvgRatingBefore?: number;
  loserAvgRatingBefore?: number;
}

@Injectable()
export class BadgesService {
  /** Injecte les dépendances : BadgesRepository, BadgesGateway. */
  constructor(
    private readonly badgesRepository: BadgesRepository,
    private readonly badgesGateway: BadgesGateway,
  ) {}

  /** Enregistre le résultat d'une partie : stats/XP des gagnants et perdants, badges de jalons, et badge « tombeur » si les gagnants ont battu une équipe nettement mieux classée. */
  async recordGameResult(input: GameResultInput): Promise<void> {
    for (const id of input.winnerIds) {
      await this.badgesRepository.recordWin(id);
    }
    for (const id of input.loserIds) {
      await this.badgesRepository.recordLoss(id);
    }
    for (const id of [...input.winnerIds, ...input.loserIds]) {
      await this.checkMilestones(id);
    }

    if (
      input.checkGiantSlayer &&
      input.winnerAvgRatingBefore !== undefined &&
      input.loserAvgRatingBefore !== undefined &&
      input.loserAvgRatingBefore - input.winnerAvgRatingBefore >=
        GIANT_SLAYER_RATING_GAP
    ) {
      for (const id of input.winnerIds) {
        await this.tryAward(id, BadgeCode.GIANT_SLAYER);
      }
    }
  }

  /** Enregistre un match nul pour chaque joueur (XP de participation, série de victoires remise à zéro) puis vérifie les badges de jalons. */
  async recordDraw(userIds: string[]): Promise<void> {
    for (const id of userIds) {
      await this.badgesRepository.recordDraw(id);
    }
    for (const id of userIds) {
      await this.checkMilestones(id);
    }
  }

  /** Attribue le badge de finaliste de tournoi à chaque joueur donné. */
  async awardTournamentFinalists(userIds: string[]): Promise<void> {
    for (const id of userIds) {
      await this.tryAward(id, BadgeCode.TOURNAMENT_FINALIST);
    }
  }

  /** Donne le bonus d'XP de victoire de tournoi et le badge de champion à chaque joueur donné. */
  async awardTournamentChampion(userIds: string[]): Promise<void> {
    for (const id of userIds) {
      await this.badgesRepository.addBonusXp(id, XP_PER_TOURNAMENT_WIN_BONUS);
      await this.tryAward(id, BadgeCode.TOURNAMENT_CHAMPION);
    }
  }

  /** Retourne le profil de badges/XP d'un joueur ou lève une NotFoundException s'il n'existe pas. */
  async getProfile(userId: string): Promise<PlayerBadgesProfile> {
    const profile = await this.badgesRepository.getProfile(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }

  /** Attribue les badges de jalons atteints (première victoire, 10 victoires, 50 matchs, série de 3 victoires). */
  private async checkMilestones(userId: string): Promise<void> {
    const stats = await this.badgesRepository.getStats(userId);
    if (!stats) return;
    if (stats.wins >= 1) await this.tryAward(userId, BadgeCode.FIRST_WIN);
    if (stats.wins >= 10) await this.tryAward(userId, BadgeCode.TEN_WINS);
    if (stats.matchesPlayed >= 50)
      await this.tryAward(userId, BadgeCode.FIFTY_MATCHES);
    if (stats.currentWinStreak >= 3)
      await this.tryAward(userId, BadgeCode.WIN_STREAK_3);
  }

  /** Attribue un badge et, s'il vient d'être débloqué, notifie le joueur en temps réel (badges:earned). */
  private async tryAward(userId: string, code: BadgeCode): Promise<void> {
    if (await this.badgesRepository.award(userId, code)) {
      this.badgesGateway.emitToUser(userId, 'badges:earned', { code });
    }
  }
}
