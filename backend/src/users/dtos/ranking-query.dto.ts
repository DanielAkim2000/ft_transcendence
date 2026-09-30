import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

export const RANKING_SCOPES = ['all', 'friends'] as const;
export const RANKING_SORTS = ['rank', 'matches', 'name'] as const;
export const RANKING_MIN_MATCHES = [0, 1, 10] as const;

/** Recherche dans le classement : nom, périmètre (tous / mes amis), nombre minimal de matchs, tri, plus la pagination. */
export class RankingQueryDto extends PageQueryDto {
  /** Texte recherché dans le nom du joueur. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(RANKING_SCOPES)
  scope?: (typeof RANKING_SCOPES)[number];

  /** 0 (tous), 1 (a déjà joué) ou 10 (note établie, plus de facteur K « nouveau joueur »). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(RANKING_MIN_MATCHES)
  minMatches?: (typeof RANKING_MIN_MATCHES)[number];

  /** rank (défaut, par note), matches (plus de matchs joués d'abord) ou name (alphabétique). */
  @IsOptional()
  @IsIn(RANKING_SORTS)
  sort?: (typeof RANKING_SORTS)[number];
}
