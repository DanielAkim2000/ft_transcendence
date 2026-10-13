import { IsBoolean } from 'class-validator';

/** [Minor · Stats et historique] Corps validé de la validation ou contestation d'un score. */
export class ValidateScoreDto {
  @IsBoolean()
  accept!: boolean;
}
