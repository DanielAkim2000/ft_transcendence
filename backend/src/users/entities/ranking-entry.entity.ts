import { ApiProperty } from '@nestjs/swagger';

/** [Major · Gestion des utilisateurs] Ligne du classement (rang, joueur, note, matchs). */
export class RankingEntry {
  @ApiProperty({ example: 'clx123456789' })
  id!: string;
  @ApiProperty({ example: 'John Doe' })
  displayname!: string;
  @ApiProperty({ example: '/uploads/avatars/john.png', nullable: true })
  avatarUrl!: string | null;
  @ApiProperty({
    example: 1,
    description: 'Position au classement général (ex æquo = même rang)',
  })
  rank!: number;
  @ApiProperty({ example: 1000 })
  rating!: number;
  @ApiProperty({ example: 5 })
  matchesPlayed!: number;

  /** [Minor · Stats et historique] Copie dans l'instance les champs fournis. */
  constructor(entry: RankingEntry) {
    Object.assign(this, entry);
  }
}
