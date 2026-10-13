import { IsIn, IsOptional } from 'class-validator';
import { AI_LEVELS, type AiLevel } from '../ai/chess-ai';

/** [Major · Jeu web (Échecs)] Corps validé de création d'une partie contre l'IA (niveau, couleur). */
export class CreateAiGameDto {
  @IsIn(AI_LEVELS)
  level: AiLevel;

  @IsOptional()
  @IsIn(['WHITE', 'BLACK', 'RANDOM'])
  color?: 'WHITE' | 'BLACK' | 'RANDOM';
}
