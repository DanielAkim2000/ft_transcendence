import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMeQuery } from "@/features/auth/authApi";
import { useListTournamentsQuery } from "@/features/tournaments/tournamentsApi";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/skeletons";

const TOURNAMENTS_PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "text-muted-foreground",
  QUEUED: "text-chart-3",
  IN_PROGRESS: "text-primary",
  COMPLETED: "text-chart-3",
  CANCELLED: "text-destructive",
};

export const Tournaments = () => {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListTournamentsQuery({
    page,
    limit: TOURNAMENTS_PAGE_SIZE,
  });
  useClampedPage(page, data?.totalPages, setPage);
  const tournaments = data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("tournaments.title")}</h1>
        {me?.role === "ADMIN" ? (
          <Button type="button" render={<Link to={ROUTES.TOURNAMENTS_NEW} />}>
            {t("tournaments.create")}
          </Button>
        ) : null}
      </header>

      {isLoading ? (
        <ListSkeleton count={4} avatar={false} action className="py-3" />
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tournaments.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tournaments.map((tournament) => (
            <li key={tournament.id}>
              <Link
                to={ROUTES.tournament(tournament.id)}
                className="flex items-center justify-between gap-3 border border-border px-3 py-3 hover:border-primary/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{tournament.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(tournament.format === "ONE_V_ONE" ? "matches.oneVOne" : "matches.twoVTwo")}
                    {" · "}
                    {t("tournaments.entryCount", { count: tournament.entries.length })}
                    {tournament.twoLegged ? ` · ${t("tournaments.twoLegged")}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em]",
                    STATUS_STYLES[tournament.status],
                  )}
                >
                  {t(`tournaments.status.${tournament.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        disabled={isFetching}
      />
    </div>
  );
};
