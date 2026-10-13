import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Largeurs du nom (une par ligne) pour que la liste ne ressemble pas à un bloc uniforme. */
const NAME_WIDTHS = ["w-32", "w-40", "w-28", "w-36", "w-24"];

type RowSkeletonProps = {
  /** Position dans la liste, pour varier la largeur du texte. */
  index?: number;
  /** Numéro de rang à gauche (classement). */
  lead?: boolean;
  avatar?: boolean;
  /** Bouton ou valeur à droite. */
  action?: boolean;
  /** `bordered` : ligne encadrée ; `flush` : ligne sans cadre (liste de conversations). */
  variant?: "bordered" | "flush";
  className?: string;
};

/** [Minor · Design system] Ligne fantôme à la place d'une ligne de liste (avatar, deux lignes de texte, action) : mêmes marges que les vraies lignes pour éviter tout saut de mise en page. */
export function RowSkeleton({
  index = 0,
  lead = false,
  avatar = true,
  action = false,
  variant = "bordered",
  className,
}: RowSkeletonProps) {
  return (
    <li
      aria-hidden
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2",
        variant === "bordered" ? "border border-border" : "py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {lead ? <Skeleton className="h-4 w-6 shrink-0" /> : null}
        {avatar ? <Skeleton className="size-9 shrink-0" /> : null}
        <div className="flex flex-col gap-1.5">
          <Skeleton className={cn("h-3.5", NAME_WIDTHS[index % NAME_WIDTHS.length])} />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {action ? <Skeleton className="h-7 w-16 shrink-0" /> : null}
    </li>
  );
}

type ListSkeletonProps = Omit<RowSkeletonProps, "index"> & {
  count?: number;
  listClassName?: string;
};

/** [Minor · Design system] Liste de lignes fantômes, annoncée « chargement » aux lecteurs d'écran. */
export function ListSkeleton({ count = 5, listClassName, ...row }: ListSkeletonProps) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t("common.loading")}</span>
      <ul className={cn("flex flex-col gap-2", listClassName)}>
        {Array.from({ length: count }, (_, index) => (
          <RowSkeleton key={index} index={index} {...row} />
        ))}
      </ul>
    </div>
  );
}

/** [Minor · Design system] Bloc fantôme d'une carte (titre + quelques lignes), pour les cartes de match, de table ou de profil. */
export function CardSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col gap-3 border border-border p-5", className)}
    >
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-3", index === lines - 1 ? "w-1/2" : "w-full")} />
      ))}
    </div>
  );
}
