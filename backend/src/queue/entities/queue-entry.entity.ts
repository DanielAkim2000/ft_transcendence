import { ApiProperty } from '@nestjs/swagger';

export enum QueueEntryStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  DONE = 'DONE',
}

export class QueuePlayer {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'John Doe' })
  displayname!: string;
  @ApiProperty({ example: '/uploads/avatars/john.png', nullable: true })
  avatarUrl!: string | null;
}

export class QueueEntryEntity {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'table_a' })
  tableId!: string;
  @ApiProperty({ enum: QueueEntryStatus, example: QueueEntryStatus.WAITING })
  status!: QueueEntryStatus;
  @ApiProperty({ type: QueuePlayer })
  requester!: QueuePlayer;
  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  joinedAt!: Date;
  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', nullable: true })
  calledAt!: Date | null;
  @ApiProperty({ example: '2026-01-01T12:02:00.000Z', nullable: true })
  expiresAt!: Date | null;
  @ApiProperty({
    description: 'Position 1-indexée parmi les entrées en attente',
    example: 1,
  })
  position!: number;

  constructor(entry: Partial<QueueEntryEntity>) {
    Object.assign(this, entry);
  }
}
