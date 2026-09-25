import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchesRepository } from '../repositories/matches.repository';
import {
  MatchEntity,
  MatchFormat,
  MatchStatus,
} from '../entities/match.entity';
import { MatchesGateway } from '../matches.gateway';
import { UsersService } from '../../users/services/users.services';
import { computeEloUpdates, type MatchOutcome } from '../lib/elo';
import { TournamentsService } from '../../tournaments/services/tournaments.service';
import { BadgesService } from '../../badges/services/badges.service';

/** Délai pour valider un score soumis (règle métier : litige si non validé à temps). */
export const SCORE_VALIDATION_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class MatchesService {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly matchesGateway: MatchesGateway,
    private readonly usersService: UsersService,
    private readonly tournamentsService: TournamentsService,
    private readonly badgesService: BadgesService,
  ) {}

  listMine(userId: string): Promise<MatchEntity[]> {
    return this.matchesRepository.listForUser(userId);
  }

  listHistory(userId: string): Promise<MatchEntity[]> {
    return this.matchesRepository.listHistoryForUser(userId);
  }

  async getForUser(userId: string, matchId: string): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    this.assertParticipant(match, userId);
    return match;
  }

  async propose(
    challengerId: string,
    opponentId: string,
    format: MatchFormat,
    teammateId?: string,
  ): Promise<MatchEntity> {
    if (opponentId === challengerId) {
      throw new BadRequestException('You cannot challenge yourself');
    }
    if (!(await this.usersService.findUserById(opponentId))) {
      throw new NotFoundException('Opponent not found');
    }
    if (format === MatchFormat.TWO_V_TWO) {
      if (!teammateId) {
        throw new BadRequestException('teammateId is required for 2v2');
      }
      if (teammateId === challengerId || teammateId === opponentId) {
        throw new BadRequestException('Invalid teammate');
      }
      if (!(await this.usersService.findUserById(teammateId))) {
        throw new NotFoundException('Teammate not found');
      }
    }
    const match = await this.matchesRepository.create(
      format,
      challengerId,
      opponentId,
      format === MatchFormat.TWO_V_TWO ? teammateId : undefined,
    );
    this.matchesGateway.emitToUser(opponentId, 'match:proposed', match);
    return match;
  }

  async respond(
    userId: string,
    matchId: string,
    accept: boolean,
    teammateId?: string,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException('This challenge is no longer pending');
    }
    if (match.teamB[0]?.id !== userId) {
      throw new ForbiddenException('Only the challenged player can respond');
    }

    if (!accept) {
      if (!(await this.matchesRepository.decline(matchId, userId))) {
        throw new ConflictException('This challenge is no longer pending');
      }
      const updated = await this.getMatch(matchId);
      this.matchesGateway.emitToMatch(updated, 'match:responded', updated);
      return updated;
    }

    if (match.format === MatchFormat.TWO_V_TWO) {
      if (!teammateId) {
        throw new BadRequestException('teammateId is required for 2v2');
      }
      if (
        teammateId === userId ||
        match.teamA.some((player) => player.id === teammateId)
      ) {
        throw new BadRequestException('Invalid teammate');
      }
      if (!(await this.usersService.findUserById(teammateId))) {
        throw new NotFoundException('Teammate not found');
      }
    }
    if (
      !(await this.matchesRepository.accept(
        matchId,
        userId,
        match.format === MatchFormat.TWO_V_TWO ? teammateId : undefined,
      ))
    ) {
      throw new ConflictException('This challenge is no longer pending');
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:responded', updated);
    return updated;
  }

  async submitScore(
    userId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    this.assertParticipant(match, userId);
    if (match.status !== MatchStatus.ACCEPTED) {
      throw new ConflictException('Match is not ready for a score');
    }
    const validationExpiresAt = new Date(
      Date.now() + SCORE_VALIDATION_TIMEOUT_MS,
    );
    if (
      !(await this.matchesRepository.submitScore(
        matchId,
        userId,
        scoreA,
        scoreB,
        validationExpiresAt,
      ))
    ) {
      throw new ConflictException('Match is not ready for a score');
    }
    this.scheduleValidationExpiry(matchId);
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:scoreSubmitted', updated);
    return updated;
  }

  async validateScore(
    userId: string,
    matchId: string,
    accept: boolean,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    this.assertParticipant(match, userId);
    if (match.status !== MatchStatus.PENDING_VALIDATION) {
      throw new ConflictException('No score awaiting validation');
    }
    const submitterTeam = this.teamOf(match, match.submittedBy?.id ?? '');
    const validatorTeam = this.teamOf(match, userId);
    if (!submitterTeam || !validatorTeam || submitterTeam === validatorTeam) {
      throw new ForbiddenException(
        'Only the other team can validate this score',
      );
    }

    if (!accept) {
      this.clearTimer(matchId);
      if (!(await this.matchesRepository.dispute(matchId, userId))) {
        throw new ConflictException('No score awaiting validation');
      }
      const updated = await this.getMatch(matchId);
      this.matchesGateway.emitToMatch(updated, 'match:disputed', updated);
      if (updated.tournamentTieId) {
        await this.tournamentsService.handleLegDisputed(matchId);
      }
      return updated;
    }

    this.clearTimer(matchId);
    if (
      !(await this.matchesRepository.completeWithValidation(matchId, userId))
    ) {
      throw new ConflictException('No score awaiting validation');
    }
    if (match.tournamentTieId) {
      await this.tournamentsService.handleLegCompleted(matchId);
    } else {
      await this.applyElo(matchId, match);
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:completed', updated);
    return updated;
  }

  private async applyElo(matchId: string, match: MatchEntity): Promise<void> {
    const teams = await this.matchesRepository.getTeamsForElo(matchId);
    if (!teams || match.scoreA === null || match.scoreB === null) {
      return;
    }
    const outcomeForTeamA: MatchOutcome =
      match.scoreA === match.scoreB ? 0.5 : match.scoreA > match.scoreB ? 1 : 0;
    const results = computeEloUpdates(
      teams.teamA,
      teams.teamB,
      outcomeForTeamA,
    );
    await this.matchesRepository.applyEloUpdates(results);

    if (outcomeForTeamA === 0.5) {
      await this.badgesService.recordDraw(
        [...teams.teamA, ...teams.teamB].map((p) => p.id),
      );
    } else {
      const average = (players: { rating: number }[]) =>
        players.reduce((sum, p) => sum + p.rating, 0) / players.length;
      const [winners, losers] =
        outcomeForTeamA === 1
          ? [teams.teamA, teams.teamB]
          : [teams.teamB, teams.teamA];
      await this.badgesService.recordGameResult({
        winnerIds: winners.map((p) => p.id),
        loserIds: losers.map((p) => p.id),
        checkGiantSlayer: true,
        winnerAvgRatingBefore: average(winners),
        loserAvgRatingBefore: average(losers),
      });
    }
  }

  private teamOf(match: MatchEntity, userId: string): 'A' | 'B' | null {
    if (match.teamA.some((player) => player.id === userId)) return 'A';
    if (match.teamB.some((player) => player.id === userId)) return 'B';
    return null;
  }

  private assertParticipant(match: MatchEntity, userId: string): void {
    if (!this.teamOf(match, userId)) {
      throw new ForbiddenException('You are not part of this match');
    }
  }

  private async getMatch(matchId: string): Promise<MatchEntity> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  private scheduleValidationExpiry(matchId: string): void {
    this.clearTimer(matchId);
    const timer = setTimeout(() => {
      void this.handleValidationExpiry(matchId);
    }, SCORE_VALIDATION_TIMEOUT_MS);
    this.timers.set(matchId, timer);
  }

  private async handleValidationExpiry(matchId: string): Promise<void> {
    this.timers.delete(matchId);
    if (!(await this.matchesRepository.dispute(matchId))) {
      return;
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:disputed', updated);
    if (updated.tournamentTieId) {
      await this.tournamentsService.handleLegDisputed(matchId);
    }
  }

  private clearTimer(matchId: string): void {
    const timer = this.timers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(matchId);
    }
  }
}
