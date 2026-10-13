import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** [Minor · Stats et historique] Corps validé de la réponse à un défi (accepter/refuser, coéquipier). */
export class RespondMatchDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsString()
  teammateId?: string;
}
