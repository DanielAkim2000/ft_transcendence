import { IsNotEmpty, IsString } from 'class-validator';

export class ReplacePlayerDto {
  /** Joueur de l'entrée à remplacer. */
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  /** Joueur qui prend sa place. */
  @IsString()
  @IsNotEmpty()
  replacementId!: string;
}
