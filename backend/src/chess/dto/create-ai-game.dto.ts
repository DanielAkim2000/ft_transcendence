import { IsIn, IsOptional } from 'class-validator';
import { AI_LEVELS, type AiLevel } from '../ai/chess-ai';

export class CreateAiGameDto {
  @IsIn(AI_LEVELS)
  level: AiLevel;

  @IsOptional()
  @IsIn(['WHITE', 'BLACK', 'RANDOM'])
  color?: 'WHITE' | 'BLACK' | 'RANDOM';
}
