import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** [Minor · Tournois] Corps validé d'ajout d'une inscription à un tournoi. */
export class AddEntryDto {
  @IsString()
  @IsNotEmpty()
  player1Id!: string;

  @IsOptional()
  @IsString()
  player2Id?: string;
}
