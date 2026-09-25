import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RespondMatchDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsString()
  teammateId?: string;
}
