import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { QueueService } from '../../queue/services/queue.service';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { HistoryQueryDto } from '../dtos/history-query.dto';
import { Paginated, toPaginated } from '../../common/pagination/paginated';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

/** Délai pour valider un score soumis (règle métier : litige si non validé à temps). */
export const SCORE_VALIDATION_TIMEOUT_MS = 10 * 60 * 1000;

/** Points nécessaires pour gagner un match, quel qu'il soit (défi, table, manche de tournoi) : le score final est donc toujours 10-x, sans égalité possible. */
export const MATCH_TARGET_SCORE = 10;

/** [Minor · Stats et historique] Service métier des matchs (défis, scores, Elo, historique). */
@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /** [Minor · Stats et historique] Injecte les dépendances : MatchesRepository, MatchesGateway, UsersService, TournamentsService, BadgesService, QueueService, NotificationsService. */
  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly matchesGateway: MatchesGateway,
    private readonly usersService: UsersService,
    private readonly tournamentsService: TournamentsService,
    private readonly badgesService: BadgesService,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** [Minor · Stats et historique] Liste une page des défis de ladder de l'utilisateur (hors manches de tournoi et défis refusés). */
  async listMine(
    userId: string,
    page: PageQueryDto,
  ): Promise<Paginated<MatchEntity>> {
    const { matches, total } = await this.matchesRepository.listForUser(
      userId,
      page,
    );
    return toPaginated(matches, total, page);
  }

  /** [Minor · Recherche avancée] Liste une page des matchs terminés de l'utilisateur, ladder et tournois confondus, avec filtres et tri. */
  async listHistory(
    userId: string,
    query: HistoryQueryDto,
  ): Promise<Paginated<MatchEntity>> {
    const { matches, total } = await this.matchesRepository.listHistoryForUser(
      userId,
      query,
    );
    return toPaginated(matches, total, query);
  }

  /** [Minor · Stats et historique] Nombre de défis en attente d'une action de l'utilisateur (pastille de la barre latérale). */
  async countActionable(userId: string): Promise<{ count: number }> {
    return {
      count: await this.matchesRepository.countActionableForUser(userId),
    };
  }

  /** [Minor · Stats et historique] Retourne un match si l'utilisateur en est participant, sinon lève une erreur 403/404. */
  async getForUser(userId: string, matchId: string): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    this.assertParticipant(match, userId);
    return match;
  }

  /** [Minor · Stats et historique] Crée un défi (PENDING) : vérifie adversaire et coéquipier (obligatoire en 2v2), puis notifie l'adversaire en temps réel. */
  async propose(
    challengerId: string,
    opponentId: string,
    format: MatchFormat,
    teammateId?: string,
  ): Promise<MatchEntity> {
    if (opponentId === challengerId) {
      throw new BadRequestException({
        message: 'You cannot challenge yourself',
        code: 'CANNOT_CHALLENGE_SELF',
      });
    }
    if (!(await this.usersService.findUserById(opponentId))) {
      throw new NotFoundException({
        message: 'Opponent not found',
        code: 'OPPONENT_NOT_FOUND',
      });
    }
    if (format === MatchFormat.TWO_V_TWO) {
      if (!teammateId) {
        throw new BadRequestException({
          message: 'teammateId is required for 2v2',
          code: 'TEAMMATE_REQUIRED',
        });
      }
      if (teammateId === challengerId || teammateId === opponentId) {
        throw new BadRequestException({
          message: 'Invalid teammate',
          code: 'TEAMMATE_INVALID',
        });
      }
      if (!(await this.usersService.findUserById(teammateId))) {
        throw new NotFoundException({
          message: 'Teammate not found',
          code: 'TEAMMATE_NOT_FOUND',
        });
      }
    }
    const match = await this.matchesRepository.create(
      format,
      challengerId,
      opponentId,
      format === MatchFormat.TWO_V_TWO ? teammateId : undefined,
    );
    this.matchesGateway.emitToUser(opponentId, 'match:proposed', match);
    await this.notificationsService.create(
      opponentId,
      NotificationType.MATCH_PROPOSED,
      { matchId: match.id, fromName: match.teamA[0]?.displayname ?? '?' },
    );
    return match;
  }

  /** [Minor · Stats et historique] Traite la réponse du joueur défié : refus, ou acceptation (avec son coéquipier en 2v2) ; diffuse le match mis à jour aux participants. */
  async respond(
    userId: string,
    matchId: string,
    accept: boolean,
    teammateId?: string,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException({
        message: 'This challenge is no longer pending',
        code: 'CHALLENGE_NOT_PENDING',
      });
    }
    if (match.teamB[0]?.id !== userId) {
      throw new ForbiddenException({
        message: 'Only the challenged player can respond',
        code: 'CHALLENGE_ONLY_CHALLENGED_RESPONDS',
      });
    }

    if (!accept) {
      if (!(await this.matchesRepository.decline(matchId, userId))) {
        throw new ConflictException({
          message: 'This challenge is no longer pending',
          code: 'CHALLENGE_NOT_PENDING',
        });
      }
      const updated = await this.getMatch(matchId);
      this.matchesGateway.emitToMatch(updated, 'match:responded', updated);
      // Seul le camp du challenger se soucie d'un refus : le destinataire
      // sait déjà qu'il vient de refuser.
      await this.notificationsService.createForUsers(
        updated.teamA.map((player) => player.id),
        NotificationType.MATCH_DECLINED,
        {
          matchId: updated.id,
          opponentName: updated.teamB[0]?.displayname ?? '?',
        },
      );
      return updated;
    }

    if (match.format === MatchFormat.TWO_V_TWO) {
      if (!teammateId) {
        throw new BadRequestException({
          message: 'teammateId is required for 2v2',
          code: 'TEAMMATE_REQUIRED',
        });
      }
      if (
        teammateId === userId ||
        match.teamA.some((player) => player.id === teammateId)
      ) {
        throw new BadRequestException({
          message: 'Invalid teammate',
          code: 'TEAMMATE_INVALID',
        });
      }
      if (!(await this.usersService.findUserById(teammateId))) {
        throw new NotFoundException({
          message: 'Teammate not found',
          code: 'TEAMMATE_NOT_FOUND',
        });
      }
    }
    if (
      !(await this.matchesRepository.accept(
        matchId,
        userId,
        match.format === MatchFormat.TWO_V_TWO ? teammateId : undefined,
      ))
    ) {
      throw new ConflictException({
        message: 'This challenge is no longer pending',
        code: 'CHALLENGE_NOT_PENDING',
      });
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:responded', updated);
    // Tout le monde sauf celui qui vient d'accepter (challenger, et son
    // éventuel coéquipier ; le sien aussi, si 2v2).
    await this.notificationsService.createForUsers(
      [...updated.teamA, ...updated.teamB]
        .map((player) => player.id)
        .filter((id) => id !== userId),
      NotificationType.MATCH_ACCEPTED,
      {
        matchId: updated.id,
        opponentName: updated.teamB[0]?.displayname ?? '?',
      },
    );
    return updated;
  }

  /** [Minor · Stats et historique] Enregistre le score proposé par un participant, passe le match en attente de validation et arme le délai de validation. */
  async submitScore(
    userId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    this.assertParticipant(match, userId);
    if (match.tournamentTieId) {
      throw new ForbiddenException({
        message: 'Tournament scores are entered by an admin',
        code: 'TOURNAMENT_SCORE_ADMIN_ONLY',
      });
    }
    if (match.status !== MatchStatus.ACCEPTED) {
      throw new ConflictException({
        message: 'Match is not ready for a score',
        code: 'MATCH_NOT_READY_FOR_SCORE',
      });
    }
    this.assertValidScore(scoreA, scoreB);
    const isTableMatch = match.tableId !== null && !match.tournamentTieId;
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
      throw new ConflictException({
        message: 'Match is not ready for a score',
        code: 'MATCH_NOT_READY_FOR_SCORE',
      });
    }
    this.scheduleValidationExpiry(matchId);
    if (isTableMatch) {
      // Le résultat soumis suffit à faire tourner la table : le perdant sort,
      // le gagnant reste et le groupe suivant est appelé.
      try {
        await this.queueService.onMatchScored(matchId);
      } catch (error) {
        this.logger.error(
          `Table rotation failed for match ${matchId}: ${error}`,
        );
      }
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:scoreSubmitted', updated);
    await this.notificationsService.createForUsers(
      [...updated.teamA, ...updated.teamB]
        .map((player) => player.id)
        .filter((id) => id !== userId),
      NotificationType.MATCH_SCORE_SUBMITTED,
      {
        matchId: updated.id,
        scoreA: updated.scoreA ?? 0,
        scoreB: updated.scoreB ?? 0,
      },
    );
    return updated;
  }

  /** [Minor · Tournois] Un administrateur saisit le score d'une manche de tournoi : seul moyen d'en enregistrer un. Le match est terminé immédiatement, le tournoi avance (vainqueur, tableau, tables) et les joueurs sont notifiés. */
  async submitTournamentScoreAsAdmin(
    adminId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    if (!match.tournamentTieId) {
      throw new BadRequestException({
        message: 'Only tournament matches are scored by an admin',
        code: 'ONLY_TOURNAMENT_MATCHES_ADMIN_SCORE',
      });
    }
    if (match.status !== MatchStatus.ACCEPTED) {
      throw new ConflictException({
        message: 'Match is not ready for a score',
        code: 'MATCH_NOT_READY_FOR_SCORE',
      });
    }
    this.assertValidScore(scoreA, scoreB);
    if (
      !(await this.matchesRepository.completeByAdmin(
        matchId,
        adminId,
        scoreA,
        scoreB,
      ))
    ) {
      throw new ConflictException({
        message: 'Match is not ready for a score',
        code: 'MATCH_NOT_READY_FOR_SCORE',
      });
    }
    await this.tournamentsService.handleLegCompleted(matchId);
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:completed', updated);
    await this.notifyCompleted(updated);
    return updated;
  }

  /** [Minor · Tournois] Un administrateur corrige le score déjà saisi d'une manche de tournoi terminée. Le tournoi est recalculé (vainqueur, points, tableau) ou la correction refusée si le tour suivant a déjà commencé ; les joueurs sont prévenus. */
  async correctTournamentScoreAsAdmin(
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    if (!match.tournamentTieId) {
      throw new BadRequestException({
        message: 'Only tournament matches are scored by an admin',
        code: 'ONLY_TOURNAMENT_MATCHES_ADMIN_SCORE',
      });
    }
    if (match.status !== MatchStatus.COMPLETED) {
      throw new ConflictException({
        message: 'This match has no finished score to correct',
        code: 'MATCH_NOT_CORRECTABLE',
      });
    }
    this.assertValidScore(scoreA, scoreB);
    const tournament = await this.tournamentsService.correctLegScore(
      matchId,
      scoreA,
      scoreB,
    );
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:corrected', updated);
    for (const [team, own, opponent] of [
      [updated.teamA, scoreA, scoreB],
      [updated.teamB, scoreB, scoreA],
    ] as const) {
      await this.notificationsService.createForUsers(
        team.map((player) => player.id),
        NotificationType.TOURNAMENT_SCORE_CORRECTED,
        {
          tournamentId: tournament.tournamentId,
          tournamentName: tournament.tournamentName,
          ownScore: own,
          opponentScore: opponent,
        },
      );
    }
    return updated;
  }

  /** [Minor · Stats et historique] Lève une BadRequestException si le score n'est pas valide (un camp à 10 points, l'autre en dessous). */
  private assertValidScore(scoreA: number, scoreB: number): void {
    if (!this.isValidScore(scoreA, scoreB)) {
      throw new BadRequestException({
        message: `A match ends at ${MATCH_TARGET_SCORE} points: the score must be ${MATCH_TARGET_SCORE}-x with x from 0 to ${MATCH_TARGET_SCORE - 1} (no draw)`,
        code: 'INVALID_SCORE',
        params: { target: MATCH_TARGET_SCORE, max: MATCH_TARGET_SCORE - 1 },
      });
    }
  }

  /** [Minor · Stats et historique] Vrai si l'un des deux camps a exactement 10 points et l'autre moins (jamais d'égalité). */
  private isValidScore(scoreA: number, scoreB: number): boolean {
    const target = MATCH_TARGET_SCORE;
    return (
      (scoreA === target && scoreB < target) ||
      (scoreB === target && scoreA < target)
    );
  }

  /** [Minor · Stats et historique] Permet à l'équipe adverse de valider (match terminé, Elo/tournoi mis à jour) ou de contester (litige) le score soumis. */
  async validateScore(
    userId: string,
    matchId: string,
    accept: boolean,
  ): Promise<MatchEntity> {
    const match = await this.getMatch(matchId);
    this.assertParticipant(match, userId);
    if (match.status !== MatchStatus.PENDING_VALIDATION) {
      throw new ConflictException({
        message: 'No score awaiting validation',
        code: 'NO_SCORE_TO_VALIDATE',
      });
    }
    const submitterTeam = this.teamOf(match, match.submittedBy?.id ?? '');
    const validatorTeam = this.teamOf(match, userId);
    if (!submitterTeam || !validatorTeam || submitterTeam === validatorTeam) {
      throw new ForbiddenException({
        message: 'Only the other team can validate this score',
        code: 'ONLY_OTHER_TEAM_VALIDATES',
      });
    }

    if (!accept) {
      this.clearTimer(matchId);
      if (!(await this.matchesRepository.dispute(matchId, userId))) {
        throw new ConflictException({
          message: 'No score awaiting validation',
          code: 'NO_SCORE_TO_VALIDATE',
        });
      }
      const updated = await this.getMatch(matchId);
      this.matchesGateway.emitToMatch(updated, 'match:disputed', updated);
      await this.notifyDisputed(updated);
      if (updated.tournamentTieId) {
        await this.tournamentsService.handleLegDisputed(matchId);
      }
      return updated;
    }

    this.clearTimer(matchId);
    if (
      !(await this.matchesRepository.completeWithValidation(matchId, userId))
    ) {
      throw new ConflictException({
        message: 'No score awaiting validation',
        code: 'NO_SCORE_TO_VALIDATE',
      });
    }
    if (match.tournamentTieId) {
      await this.tournamentsService.handleLegCompleted(matchId);
    } else {
      await this.applyElo(matchId, match);
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:completed', updated);
    await this.notifyCompleted(updated);
    return updated;
  }

  /** [Minor · Stats et historique] Notifie chaque participant du résultat final, victoire ou défaite selon son propre camp. */
  private async notifyCompleted(match: MatchEntity): Promise<void> {
    for (const player of [...match.teamA, ...match.teamB]) {
      const team = this.teamOf(match, player.id);
      const myScore = team === 'A' ? match.scoreA : match.scoreB;
      const otherScore = team === 'A' ? match.scoreB : match.scoreA;
      const won =
        myScore !== null && otherScore !== null && myScore > otherScore;
      await this.notificationsService.create(
        player.id,
        NotificationType.MATCH_COMPLETED,
        {
          matchId: match.id,
          scoreA: match.scoreA ?? 0,
          scoreB: match.scoreB ?? 0,
          won,
        },
      );
    }
  }

  /** [Minor · Stats et historique] Notifie tous les participants du litige (score contesté ou jamais validé à temps). */
  private async notifyDisputed(match: MatchEntity): Promise<void> {
    await this.notificationsService.createForUsers(
      [...match.teamA, ...match.teamB].map((player) => player.id),
      NotificationType.MATCH_DISPUTED,
      { matchId: match.id },
    );
  }

  /** [Minor · Stats et historique] Calcule et applique les nouvelles notes Elo des joueurs, puis enregistre le résultat (victoire, défaite ou nul) pour les badges et l'XP. */
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
    await this.matchesRepository.applyEloUpdates(matchId, results);

    if (outcomeForTeamA === 0.5) {
      await this.badgesService.recordDraw(
        [...teams.teamA, ...teams.teamB].map((p) => p.id),
      );
    } else {
      /** [Minor · Stats et historique] Moyenne des notes d'un groupe de joueurs. */
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

  /** [Minor · Stats et historique] Retourne 'A' ou 'B' selon l'équipe de l'utilisateur dans le match, ou null s'il n'y participe pas. */
  private teamOf(match: MatchEntity, userId: string): 'A' | 'B' | null {
    if (match.teamA.some((player) => player.id === userId)) return 'A';
    if (match.teamB.some((player) => player.id === userId)) return 'B';
    return null;
  }

  /** [Minor · Stats et historique] Lève une ForbiddenException si l'utilisateur ne fait pas partie du match. */
  private assertParticipant(match: MatchEntity, userId: string): void {
    if (!this.teamOf(match, userId)) {
      throw new ForbiddenException({
        message: 'You are not part of this match',
        code: 'NOT_IN_MATCH',
      });
    }
  }

  /** [Minor · Stats et historique] Retrouve un match par id ou lève une NotFoundException. */
  private async getMatch(matchId: string): Promise<MatchEntity> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException({
        message: 'Match not found',
        code: 'MATCH_NOT_FOUND',
      });
    }
    return match;
  }

  /** [Minor · Stats et historique] Programme le passage automatique en litige si le score n'est pas validé dans SCORE_VALIDATION_TIMEOUT_MS. */
  private scheduleValidationExpiry(matchId: string): void {
    this.clearTimer(matchId);
    const timer = setTimeout(() => {
      void this.handleValidationExpiry(matchId);
    }, SCORE_VALIDATION_TIMEOUT_MS);
    this.timers.set(matchId, timer);
  }

  /** [Minor · Stats et historique] À l'expiration du délai, met le match en litige s'il attend toujours une validation, notifie les joueurs et prévient le tournoi le cas échéant. */
  private async handleValidationExpiry(matchId: string): Promise<void> {
    this.timers.delete(matchId);
    if (!(await this.matchesRepository.dispute(matchId))) {
      return;
    }
    const updated = await this.getMatch(matchId);
    this.matchesGateway.emitToMatch(updated, 'match:disputed', updated);
    await this.notifyDisputed(updated);
    if (updated.tournamentTieId) {
      await this.tournamentsService.handleLegDisputed(matchId);
    }
  }

  /** [Minor · Stats et historique] Annule et oublie le minuteur de validation d'un match, s'il existe. */
  private clearTimer(matchId: string): void {
    const timer = this.timers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(matchId);
    }
  }
}
