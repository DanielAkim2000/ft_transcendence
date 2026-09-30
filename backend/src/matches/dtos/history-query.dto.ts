import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { MatchFormat } from '../entities/match.entity';

export const HISTORY_RESULTS = ['win', 'loss'] as const;
export const HISTORY_SOURCES = ['ladder', 'tournament'] as const;
export const HISTORY_SORTS = ['newest', 'oldest', 'score'] as const;

/** Recherche avancée dans l'historique : nom d'un joueur, résultat, format, origine du match, tri, plus la pagination. */
export class HistoryQueryDto extends PageQueryDto {
  /** Texte recherché dans le nom d'un autre joueur du match (adversaire ou coéquipier). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Ne garder que les victoires ou les défaites de l'utilisateur. */
  @IsOptional()
  @IsIn(HISTORY_RESULTS)
  result?: (typeof HISTORY_RESULTS)[number];

  @IsOptional()
  @IsEnum(MatchFormat)
  format?: MatchFormat;

  /** Défi de la ladder ou manche de tournoi. */
  @IsOptional()
  @IsIn(HISTORY_SOURCES)
  source?: (typeof HISTORY_SOURCES)[number];

  /** newest (défaut) / oldest : par date ; score : plus gros écart de score d'abord. */
  @IsOptional()
  @IsIn(HISTORY_SORTS)
  sort?: (typeof HISTORY_SORTS)[number];
}
