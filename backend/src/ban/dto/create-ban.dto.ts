import { Min, IsOptional, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateBanDto {
  @IsInt()
  @Min(0)
  durationHours!: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;
}
