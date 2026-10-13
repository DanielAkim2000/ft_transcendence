import { IsNotEmpty, IsString } from 'class-validator';

/** [Minor · Tournois] Corps validé du remplacement d'un joueur d'une inscription. */
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
