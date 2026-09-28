/** Réponse standard d'une liste paginée par le backend. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Paramètres de pagination acceptés par les listes du backend. */
export interface PageArgs {
  page?: number;
  limit?: number;
}

/** Taille de page par défaut des listes (identique au défaut du backend). */
export const DEFAULT_PAGE_SIZE = 10;

/** Page vide, utilisée tant que la première réponse n'est pas arrivée. */
export const EMPTY_PAGE: Paginated<never> = {
  items: [],
  total: 0,
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  totalPages: 1,
};
