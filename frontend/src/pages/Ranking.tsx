import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ROUTES } from "@/constants/routes";
import { useMeQuery } from "@/features/auth/authApi";
import {
  useGetRankingQuery,
  type RankingArgs,
} from "@/features/users/usersApi";
import { Pagination } from "@/components/pagination";
import { RankTrophy } from "@/features/users/RankTrophy";
import { isPodium } from "@/features/users/podium";
import { ChallengeDialog } from "@/features/matches/ChallengeDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import { useClampedPage } from "@/lib/use-clamped-page";
import { ListSkeleton } from "@/components/skeletons";

const RANKING_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Filters = Pick<RankingArgs, "scope" | "minMatches" | "sort">;

/** Barre de recherche du classement : nom, périmètre (tous / mes amis), matchs minimum et tri. */
function RankingFilters({
  search,
  onSearch,
  filters,
  onChange,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const { t } = useTranslation();
  const active =
    search !== "" ||
    filters.scope !== undefined ||
    filters.minMatches !== undefined ||
    filters.sort !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        className="w-full sm:w-56"
        placeholder={t("matches.filterSearch")}
        aria-label={t("matches.filterSearch")}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <select
        className={selectClass}
        aria-label={t("matches.rankingScope")}
        value={filters.scope ?? "all"}
        onChange={(e) =>
          onChange({
            ...filters,
            scope: e.target.value === "friends" ? "friends" : undefined,
          })
        }
      >
        <option value="all">{t("matches.scopeAll")}</option>
        <option value="friends">{t("matches.scopeFriends")}</option>
      </select>
      <select
        className={selectClass}
        aria-label={t("matches.filterMinMatches")}
        value={String(filters.minMatches ?? 0)}
        onChange={(e) => {
          const value = Number(e.target.value);
          onChange({
            ...filters,
            minMatches: value === 1 || value === 10 ? value : undefined,
          });
        }}
      >
        <option value="0">{t("matches.minMatchesAny")}</option>
        <option value="1">{t("matches.minMatchesPlayed")}</option>
        <option value="10">{t("matches.minMatchesEstablished")}</option>
      </select>
      <select
        className={selectClass}
        aria-label={t("matches.sortLabel")}
        value={filters.sort ?? "rank"}
        onChange={(e) =>
          onChange({
            ...filters,
            sort:
              e.target.value === "rank"
                ? undefined
                : (e.target.value as Filters["sort"]),
          })
        }
      >
        <option value="rank">{t("matches.sortRank")}</option>
        <option value="matches">{t("matches.sortMatches")}</option>
        <option value="name">{t("matches.sortName")}</option>
      </select>
      {active ? (
        <button
          type="button"
          className="text-xs uppercase tracking-wider text-muted-foreground underline"
          onClick={() => {
            onSearch("");
            onChange({});
          }}
        >
          {t("matches.filterReset")}
        </button>
      ) : null}
    </div>
  );
}

export const Ranking = () => {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  useEffect(() => {
    // Toute modification de recherche ou de filtre revient à la première page.
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, isLoading, isFetching } = useGetRankingQuery({
    page,
    limit: RANKING_PAGE_SIZE,
    q: debouncedSearch || undefined,
    ...filters,
  });
  useClampedPage(page, data?.totalPages, setPage);
  const entries = data?.items ?? [];
  const filtered =
    debouncedSearch !== "" ||
    filters.scope !== undefined ||
    filters.minMatches !== undefined;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("matches.rankingTitle")}
        </h1>
        <Link
          to={ROUTES.CHALLENGES}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {t("matches.myChallengesLink")}
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <RankingFilters
          search={search}
          onSearch={setSearch}
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        {isLoading ? (
          <ListSkeleton count={RANKING_PAGE_SIZE} lead action />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(filtered ? "matches.rankingNoMatch" : "matches.rankingEmpty")}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  "flex items-center justify-between gap-3 border border-border px-3 py-2",
                  entry.id === me?.id && "border-primary/60 bg-primary/5",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-8 shrink-0 text-right text-xs font-bold text-muted-foreground">
                    {entry.rank}
                  </span>
                  <Avatar className="size-9 rounded-lg">
                    <AvatarImage
                      src={resolveAvatarUrl(entry.avatarUrl)}
                      alt={entry.displayname}
                      className="rounded-lg"
                    />
                    <AvatarFallback className="rounded-lg text-xs">
                      {getInitials(entry.displayname)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link
                      to={ROUTES.profile(entry.id)}
                      className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline"
                    >
                      <span className="truncate">{entry.displayname}</span>
                      {isPodium(entry.rank, entry.matchesPlayed) ? (
                        <RankTrophy rank={entry.rank} className="size-4" />
                      ) : null}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("matches.matchesPlayed", {
                        count: entry.matchesPlayed,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-bold">
                    {entry.rating}
                  </span>
                  {entry.id !== me?.id ? (
                    <ChallengeDialog opponent={entry}>
                      <Button type="button" size="sm" variant="outline">
                        {t("matches.challenge")}
                      </Button>
                    </ChallengeDialog>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
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
