import { IsBoolean } from 'class-validator';

export class ValidateScoreDto {
  @IsBoolean()
  accept!: boolean;
}
