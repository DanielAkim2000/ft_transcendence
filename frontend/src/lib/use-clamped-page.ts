import { useEffect } from "react";

/** [Minor · Recherche avancée] Ramène la page courante sur la dernière page existante quand la liste rétrécit (ex: dernier élément d'une page supprimé). */
export function useClampedPage(
  page: number,
  totalPages: number | undefined,
  setPage: (page: number) => void,
) {
  useEffect(() => {
    if (totalPages !== undefined && page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages, setPage]);
}
