import { ApiProperty } from '@nestjs/swagger';

/** [Minor · Stats et historique] Formats de match : 1v1 ou 2v2. */
export enum MatchFormat {
  ONE_V_ONE = 'ONE_V_ONE',
  TWO_V_TWO = 'TWO_V_TWO',
}

/** [Minor · Stats et historique] États du cycle de vie d'un match (proposé, accepté, score soumis, terminé, contesté…). */
export enum MatchStatus {
  PENDING = 'PENDING',
  DECLINED = 'DECLINED',
  ACCEPTED = 'ACCEPTED',
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
}

/** [Minor · Stats et historique] Joueur d'un match (id, nom, avatar, note Elo). */
export class MatchPlayer {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'John Doe' })
  displayname!: string;
  @ApiProperty({ example: '/uploads/avatars/john.png', nullable: true })
  avatarUrl!: string | null;
  @ApiProperty({ example: 1000 })
  rating!: number;
}

/** [Minor · Stats et historique] Match avec ses équipes, scores, deltas Elo et infos de tournoi. */
export class MatchEntity {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ enum: MatchFormat, example: MatchFormat.ONE_V_ONE })
  format!: MatchFormat;
  @ApiProperty({ enum: MatchStatus, example: MatchStatus.PENDING })
  status!: MatchStatus;
  @ApiProperty({ type: [MatchPlayer] })
  teamA!: MatchPlayer[];
  @ApiProperty({ type: [MatchPlayer] })
  teamB!: MatchPlayer[];
  @ApiProperty({ nullable: true, example: 10 })
  scoreA!: number | null;
  @ApiProperty({ nullable: true, example: 7 })
  scoreB!: number | null;
  @ApiProperty({ type: MatchPlayer, nullable: true })
  submittedBy!: MatchPlayer | null;
  @ApiProperty({ type: MatchPlayer, nullable: true })
  validatedBy!: MatchPlayer | null;
  @ApiProperty({
    description: 'Ranking points gained/lost by each player, keyed by user id',
    nullable: true,
    example: { clx123456789: 12 },
  })
  ratingDeltas!: Record<string, number> | null;
  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  createdAt!: Date;
  @ApiProperty({ nullable: true, example: '2026-01-01T12:01:00.000Z' })
  respondedAt!: Date | null;
  @ApiProperty({ nullable: true, example: '2026-01-01T12:30:00.000Z' })
  submittedAt!: Date | null;
  @ApiProperty({ nullable: true, example: '2026-01-01T12:40:00.000Z' })
  validationExpiresAt!: Date | null;
  @ApiProperty({
    description:
      'Set when this match is a tournament tie leg rather than a ladder challenge',
    nullable: true,
  })
  tournamentTieId!: string | null;
  @ApiProperty({ nullable: true, example: 1 })
  legNumber!: number | null;
  @ApiProperty({ nullable: true })
  tournamentId!: string | null;
  @ApiProperty({ nullable: true, example: 'Coupe de la Rentrée' })
  tournamentName!: string | null;
  @ApiProperty({ nullable: true, example: 1 })
  tournamentRound!: number | null;
  @ApiProperty({
    description:
      'Set when the match was played on a table (queue or tournament)',
    nullable: true,
  })
  tableId!: string | null;

  /** [Minor · Stats et historique] Copie dans l'instance les champs fournis. */
  constructor(match: Partial<MatchEntity>) {
    Object.assign(this, match);
  }
}
