import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MatchFormat } from '../entities/match.entity';

/** [Minor · Stats et historique] Corps validé d'un défi (adversaire, format, coéquipier). */
export class ProposeMatchDto {
  @IsNotEmpty()
  @IsString()
  opponentId!: string;

  @IsEnum(MatchFormat)
  format!: MatchFormat;

  @IsOptional()
  @IsString()
  teammateId?: string;
}
