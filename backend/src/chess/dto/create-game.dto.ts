import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** [Major · Jeu web (Échecs)] Corps validé d'un défi d'échecs (adversaire, couleur, pendule, incrément, classée). */
export class CreateGameDto {
  @IsString()
  opponentId: string;

  @IsOptional()
  @IsIn(['WHITE', 'BLACK', 'RANDOM'])
  color?: 'WHITE' | 'BLACK' | 'RANDOM';

  // ex: 600000 = 10 min par joueur. Absent = pas de pendule
  @IsOptional()
  @IsInt()
  @Min(30_000)
  timeControlMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  incrementMs?: number;

  @IsOptional()
  @IsBoolean()
  rated?: boolean;
}
