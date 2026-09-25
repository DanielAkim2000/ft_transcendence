import { ApiProperty } from '@nestjs/swagger';

export enum TableStatus {
  FREE = 'FREE',
  BUSY = 'BUSY',
}

export class TableOccupant {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'John Doe' })
  displayname!: string;
  @ApiProperty({ example: '/uploads/avatars/john.png', nullable: true })
  avatarUrl!: string | null;
}

export class TableTournamentTie {
  id!: string;
  tournamentId!: string;
  tournamentName!: string;
  round!: number;
  roundLabel!: string;
  entryALabel!: string;
  entryBLabel!: string;
}

export class TableEntity {
  @ApiProperty({ description: 'The id of the table', example: 'table_a' })
  id!: string;
  @ApiProperty({ description: 'The name of the table', example: 'Baby A' })
  name!: string;
  @ApiProperty({ enum: TableStatus, example: TableStatus.FREE })
  status!: TableStatus;
  @ApiProperty({
    description: 'Since when the table is occupied',
    example: '2026-01-01T12:00:00.000Z',
    nullable: true,
  })
  occupiedAt!: Date | null;
  @ApiProperty({
    description: 'The player who declared the table occupied',
    type: TableOccupant,
    nullable: true,
  })
  occupiedBy!: TableOccupant | null;
  @ApiProperty({
    description: 'Set while a tournament tie is being played on this table',
    type: TableTournamentTie,
    nullable: true,
  })
  currentTournamentTie!: TableTournamentTie | null;

  constructor(table: Partial<TableEntity>) {
    Object.assign(this, table);
  }
}
