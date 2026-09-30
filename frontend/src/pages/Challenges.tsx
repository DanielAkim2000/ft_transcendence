import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ROUTES } from "@/constants/routes";
import { useMeQuery } from "@/features/auth/authApi";
import { useListMatchesQuery } from "@/features/matches/matchesApi";
import { MatchCard } from "@/features/matches/MatchCard";
import { Pagination } from "@/components/pagination";
import { ListSkeleton } from "@/components/skeletons";
import { useClampedPage } from "@/lib/use-clamped-page";

const MATCHES_PAGE_SIZE = 10;

/** Défis de l'utilisateur : ceux reçus (à accepter), à jouer (saisie du score) et à valider. Pour en lancer un, on passe par le classement. */
export const Challenges = () => {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListMatchesQuery({
    page,
    limit: MATCHES_PAGE_SIZE,
  });
  useClampedPage(page, data?.totalPages, setPage);
  const matches = data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("matches.challengesTitle")}
        </h1>
        <div className="flex gap-4 text-xs">
          <Link
            to={ROUTES.RANKING}
            className="text-primary underline-offset-2 hover:underline"
          >
            {t("matches.challengeSomeone")}
          </Link>
          <Link
            to={ROUTES.HISTORY}
            className="text-primary underline-offset-2 hover:underline"
          >
            {t("matches.viewHistory")}
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        {isLoading ? (
          <ListSkeleton count={3} avatar={false} action />
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("matches.noMatches")}
          </p>
        ) : me ? (
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} meId={me.id} />
            ))}
          </ul>
        ) : null}
        <Pagination
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          disabled={isFetching}
        />
      </section>
    </div>
  );
};
