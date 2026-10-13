import { IsInt, Max, Min } from 'class-validator';

/** [Minor · Stats et historique] Corps validé d'une saisie de score (deux scores entiers). */
export class SubmitScoreDto {
  @IsInt()
  @Min(0)
  @Max(10)
  scoreA!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  scoreB!: number;
}
