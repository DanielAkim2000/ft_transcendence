import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MatchFormat } from '../entities/match.entity';

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
