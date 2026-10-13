import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Nombre d'éléments par page par défaut et maximum autorisé. */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

/** Paramètres de pagination par page (`?page=2&limit=10`), à étendre pour ajouter des filtres. */
export class PageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;
}

/** [Minor · Recherche avancée] Nombre d'éléments à sauter pour atteindre la page demandée. */
export function pageOffset({ page, limit }: PageQueryDto): number {
  return (page - 1) * limit;
}
