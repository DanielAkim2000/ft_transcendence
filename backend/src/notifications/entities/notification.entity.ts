import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  MATCH_PROPOSED = 'MATCH_PROPOSED',
  MATCH_ACCEPTED = 'MATCH_ACCEPTED',
  MATCH_DECLINED = 'MATCH_DECLINED',
  MATCH_SCORE_SUBMITTED = 'MATCH_SCORE_SUBMITTED',
  MATCH_COMPLETED = 'MATCH_COMPLETED',
  MATCH_DISPUTED = 'MATCH_DISPUTED',
  QUEUE_INVITE = 'QUEUE_INVITE',
  QUEUE_INVITE_DECLINED = 'QUEUE_INVITE_DECLINED',
  QUEUE_GROUP_CLOSED = 'QUEUE_GROUP_CLOSED',
  QUEUE_CALLED = 'QUEUE_CALLED',
  QUEUE_EXPIRED = 'QUEUE_EXPIRED',
  TABLE_MATCH_STARTED = 'TABLE_MATCH_STARTED',
  TABLE_SCORE_REQUIRED = 'TABLE_SCORE_REQUIRED',
  TABLE_MATCH_ENDED = 'TABLE_MATCH_ENDED',
  TABLE_MATCH_CANCELLED = 'TABLE_MATCH_CANCELLED',
  TOURNAMENT_LAUNCHED = 'TOURNAMENT_LAUNCHED',
  TOURNAMENT_TABLE_RECLAIMED = 'TOURNAMENT_TABLE_RECLAIMED',
  TOURNAMENT_TIE_STARTED = 'TOURNAMENT_TIE_STARTED',
  TOURNAMENT_TIE_WON = 'TOURNAMENT_TIE_WON',
  TOURNAMENT_ELIMINATED = 'TOURNAMENT_ELIMINATED',
  TOURNAMENT_COMPLETED = 'TOURNAMENT_COMPLETED',
  BADGE_EARNED = 'BADGE_EARNED',
  CHESS_INVITE = 'CHESS_INVITE',
  CHESS_INVITE_ACCEPTED = 'CHESS_INVITE_ACCEPTED',
  CHESS_INVITE_DECLINED = 'CHESS_INVITE_DECLINED',
  TOURNAMENT_SCORE_CORRECTED = 'TOURNAMENT_SCORE_CORRECTED',
  TOURNAMENT_TIE_RESET = 'TOURNAMENT_TIE_RESET',
}

/**
 * Payload propre à chaque type de notification : tout ce qu'il faut pour
 * l'afficher (noms déjà résolus, ids pour les liens) sans requête
 * supplémentaire côté front. Tenu à jour avec chaque site d'émission.
 */
export interface NotificationDataMap {
  [NotificationType.FRIEND_REQUEST]: { fromId: string; fromName: string };
  [NotificationType.MATCH_PROPOSED]: { matchId: string; fromName: string };
  [NotificationType.MATCH_ACCEPTED]: { matchId: string; opponentName: string };
  [NotificationType.MATCH_DECLINED]: { matchId: string; opponentName: string };
  [NotificationType.MATCH_SCORE_SUBMITTED]: {
    matchId: string;
    scoreA: number;
    scoreB: number;
  };
  [NotificationType.MATCH_COMPLETED]: {
    matchId: string;
    scoreA: number;
    scoreB: number;
    won: boolean;
  };
  [NotificationType.MATCH_DISPUTED]: { matchId: string };
  [NotificationType.QUEUE_INVITE]: {
    tableId: string;
    tableName: string;
    fromName: string;
    groupId: string;
  };
  [NotificationType.QUEUE_INVITE_DECLINED]: {
    tableId: string;
    tableName: string;
    byName: string;
  };
  [NotificationType.QUEUE_GROUP_CLOSED]: {
    tableId: string;
    tableName: string;
    byName: string;
  };
  [NotificationType.QUEUE_CALLED]: { tableId: string; tableName: string };
  [NotificationType.QUEUE_EXPIRED]: {
    tableId: string;
    tableName: string;
    reason?: 'invite' | 'tournament' | 'admin';
  };
  [NotificationType.TABLE_MATCH_STARTED]: {
    tableId: string;
    tableName: string;
    matchId: string;
  };
  [NotificationType.TABLE_SCORE_REQUIRED]: {
    tableId: string;
    tableName: string;
    matchId: string;
  };
  [NotificationType.TABLE_MATCH_ENDED]: {
    tableId: string;
    tableName: string;
    stays: boolean;
  };
  [NotificationType.TABLE_MATCH_CANCELLED]: {
    tableId: string;
    tableName: string;
    reason: 'timeout' | 'externalRelease' | 'admin';
  };
  [NotificationType.TOURNAMENT_LAUNCHED]: {
    tournamentId: string;
    tournamentName: string;
  };
  [NotificationType.TOURNAMENT_TABLE_RECLAIMED]: {
    tableId: string;
    tableName: string;
    tournamentId: string;
    tournamentName: string;
  };
  [NotificationType.TOURNAMENT_TIE_STARTED]: {
    tournamentId: string;
    tournamentName: string;
  };
  [NotificationType.TOURNAMENT_TIE_WON]: {
    tournamentId: string;
    tournamentName: string;
    round: number;
  };
  [NotificationType.TOURNAMENT_ELIMINATED]: {
    tournamentId: string;
    tournamentName: string;
    round: number;
  };
  [NotificationType.TOURNAMENT_COMPLETED]: {
    tournamentId: string;
    tournamentName: string;
  };
  [NotificationType.BADGE_EARNED]: { code: string };
  [NotificationType.TOURNAMENT_TIE_RESET]: {
    tournamentId: string;
    tournamentName: string;
    round: number;
  };
  [NotificationType.TOURNAMENT_SCORE_CORRECTED]: {
    tournamentId: string;
    tournamentName: string;
    ownScore: number;
    opponentScore: number;
  };
  [NotificationType.CHESS_INVITE]: { gameId: string; fromName: string };
  [NotificationType.CHESS_INVITE_ACCEPTED]: {
    gameId: string;
    opponentName: string;
  };
  [NotificationType.CHESS_INVITE_DECLINED]: {
    gameId: string;
    opponentName: string;
  };
}

export class NotificationEntity {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.BADGE_EARNED,
  })
  type!: NotificationType;
  @ApiProperty({
    description: 'Payload propre au type, voir NotificationDataMap',
    example: { code: 'FIRST_WIN' },
  })
  data!: Record<string, unknown>;
  @ApiProperty({ example: false })
  read!: boolean;
  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  createdAt!: Date;

  /** Copie dans l'instance les champs fournis. */
  constructor(notification: Partial<NotificationEntity>) {
    Object.assign(this, notification);
  }
}
