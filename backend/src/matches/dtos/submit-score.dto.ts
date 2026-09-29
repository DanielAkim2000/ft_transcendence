import { IsInt, Max, Min } from 'class-validator';

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
