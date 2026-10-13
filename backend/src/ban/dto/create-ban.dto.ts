import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Durée maximale d'un ban temporaire : 10 ans (au-delà, utiliser un ban permanent). */
export const MAX_BAN_HOURS = 24 * 365 * 10;

/** [Major · Permissions avancées] Corps validé d'un bannissement (durée en heures, motif). */
export class CreateBanDto {
  /** Durée en heures ; 0 = ban permanent. */
  @IsInt()
  @Min(0)
  @Max(MAX_BAN_HOURS)
  durationHours!: number;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
