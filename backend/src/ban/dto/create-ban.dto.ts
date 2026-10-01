import { IsOptional, IsInt, IsString } from 'class-validator';

export class CreateBanDto {
  @IsOptional()
  @IsInt()
  durationHours?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
