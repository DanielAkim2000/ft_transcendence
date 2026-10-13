import { ApiProperty } from '@nestjs/swagger';
import { MatchFormat } from '../../matches/entities/match.entity';

/** [Socle produit babyfoot (hors module)] États d'une table (libre, occupée). */
export enum TableStatus {
  FREE = 'FREE',
  BUSY = 'BUSY',
}

/** [Socle produit babyfoot (hors module)] Joueur à une table. */
export class TablePlayer {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'John Doe' })
  displayname!: string;
  @ApiProperty({ example: '/uploads/avatars/john.png', nullable: true })
  avatarUrl!: string | null;
}

/** [Socle produit babyfoot (hors module)] Groupe (camp) jouant à une table. */
export class TableGroup {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ description: 'Côté de la table (0 ou 1)', example: 0 })
  slot!: number;
  @ApiProperty({ type: [TablePlayer] })
  players!: TablePlayer[];
}

/** [Socle produit babyfoot (hors module)] Confrontation de tournoi en cours sur une table. */
export class TableTournamentTie {
  id!: string;
  tournamentId!: string;
  tournamentName!: string;
  round!: number;
  roundLabel!: string;
  entryALabel!: string;
  entryBLabel!: string;
}

/** [Socle produit babyfoot (hors module)] Table de babyfoot avec son état, ses camps, sa file et son éventuel tournoi. */
export class TableEntity {
  @ApiProperty({ description: 'The id of the table', example: 'table_a' })
  id!: string;
  @ApiProperty({ description: 'The name of the table', example: 'Baby A' })
  name!: string;
  @ApiProperty({ enum: TableStatus, example: TableStatus.FREE })
  status!: TableStatus;
  @ApiProperty({
    enum: MatchFormat,
    nullable: true,
    description:
      'Format fixé par le premier groupe ; null si la table est vide',
  })
  format!: MatchFormat | null;
  @ApiProperty({
    description: 'Since when the table is occupied',
    example: '2026-01-01T12:00:00.000Z',
    nullable: true,
  })
  occupiedAt!: Date | null;
  @ApiProperty({
    type: [TableGroup],
    description: 'Groupes présents sur la table (0 à 2), un par côté',
  })
  groups!: TableGroup[];
  @ApiProperty({
    description: 'Match de table en cours (les 2 côtés sont occupés)',
    nullable: true,
  })
  currentMatchId!: string | null;
  @ApiProperty({
    type: [String],
    description: 'Joueurs ayant demandé la libération de la table',
  })
  releaseVoterIds!: string[];
  @ApiProperty({
    description: 'Défini quand la libération est actée : le score est attendu',
    nullable: true,
  })
  endRequestedAt!: Date | null;
  @ApiProperty({
    description: 'Set while a tournament tie is being played on this table',
    type: TableTournamentTie,
    nullable: true,
  })
  currentTournamentTie!: TableTournamentTie | null;

  /** [Socle produit babyfoot (hors module)] Copie dans l'instance les champs fournis. */
  constructor(table: Partial<TableEntity>) {
    Object.assign(this, table);
  }
}
