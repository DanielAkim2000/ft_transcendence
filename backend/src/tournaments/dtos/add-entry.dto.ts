import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddEntryDto {
  @IsString()
  @IsNotEmpty()
  player1Id!: string;

  @IsOptional()
  @IsString()
  player2Id?: string;
}
