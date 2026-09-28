import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

/** Barre Précédent / « Page x sur y » / Suivant ; masquée quand il n'y a qu'une page. */
export function Pagination({ page, totalPages, onPageChange, disabled = false }: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between gap-3" aria-label={t("common.pagination")}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t("common.previous")}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t("common.pageOf", { page, total: totalPages })}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t("common.next")}
      </Button>
    </nav>
  );
}
