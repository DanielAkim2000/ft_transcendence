import { ApiProperty } from '@nestjs/swagger';
import { MatchFormat } from '../../matches/entities/match.entity';

export enum QueueGroupStatus {
  INVITING = 'INVITING',
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  ON_TABLE = 'ON_TABLE',
  DONE = 'DONE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export class QueuePlayer {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'John Doe' })
  displayname!: string;
  @ApiProperty({ example: '/uploads/avatars/john.png', nullable: true })
  avatarUrl!: string | null;
  @ApiProperty({ description: 'Le joueur qui a créé le groupe' })
  isRequester!: boolean;
  @ApiProperty({
    description: 'false tant que le coéquipier n’a pas accepté l’invitation',
  })
  accepted!: boolean;
}

export class QueueGroupEntity {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'table_a' })
  tableId!: string;
  @ApiProperty({ enum: MatchFormat, example: MatchFormat.TWO_V_TWO })
  format!: MatchFormat;
  @ApiProperty({ enum: QueueGroupStatus, example: QueueGroupStatus.WAITING })
  status!: QueueGroupStatus;
  @ApiProperty({ type: [QueuePlayer], description: 'Demandeur en premier' })
  players!: QueuePlayer[];
  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  joinedAt!: Date;
  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', nullable: true })
  calledAt!: Date | null;
  @ApiProperty({ example: '2026-01-01T12:02:00.000Z', nullable: true })
  expiresAt!: Date | null;
  @ApiProperty({
    description:
      'Position 1-indexée parmi les groupes en file (0 si le groupe n’est pas en file)',
    example: 1,
  })
  position!: number;

  /** Copie dans l'instance les champs fournis. */
  constructor(group: Partial<QueueGroupEntity>) {
    Object.assign(this, group);
  }
}
