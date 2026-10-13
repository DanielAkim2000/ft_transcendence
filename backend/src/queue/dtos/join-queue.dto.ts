import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MatchFormat } from '../../matches/entities/match.entity';

/** [Socle produit babyfoot (hors module)] Corps validé pour rejoindre la file (format, coéquipier). */
export class JoinQueueDto {
  /** Obligatoire uniquement si la table est vide : le premier groupe choisit le format. */
  @IsOptional()
  @IsEnum(MatchFormat)
  format?: MatchFormat;

  /** Ami invité comme coéquipier (obligatoire en 2v2). */
  @IsOptional()
  @IsString()
  teammateId?: string;
}
