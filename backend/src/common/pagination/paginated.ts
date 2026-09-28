import { PageQueryDto } from './page-query.dto';

/** Réponse standard d'une liste paginée par page. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Assemble une page de résultats avec son total ; `totalPages` vaut au moins 1 pour qu'une liste vide reste affichable. */
export function toPaginated<T>(
  items: T[],
  total: number,
  { page, limit }: PageQueryDto,
): Paginated<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
