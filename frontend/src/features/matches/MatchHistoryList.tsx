import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import { ROUTES } from "@/constants/routes";
import { Input } from "@/components/ui/input";
import { useListMatchHistoryQuery, type HistoryArgs, type Match } from "./matchesApi";
import { teamOf } from "./matchHelpers";
import { TeamAvatar } from "./MatchCard";
import { ListSkeleton } from "@/components/skeletons";

const HISTORY_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Filters = Pick<HistoryArgs, "result" | "format" | "source" | "sort">;

/** Barre de recherche avancée : nom d'un joueur, résultat, format, origine et tri. */
function HistoryFilters({
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
  /** Met à jour un filtre ; la valeur vide (« tous ») le retire. */
  const set = <K extends keyof Filters>(key: K, value: string) =>
    onChange({ ...filters, [key]: value === "" ? undefined : (value as Filters[K]) });
  const active = search !== "" || Object.values(filters).some((value) => value !== undefined);

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
        aria-label={t("matches.filterResult")}
        value={filters.result ?? ""}
        onChange={(e) => set("result", e.target.value)}
      >
        <option value="">{t("matches.filterResult")}</option>
        <option value="win">{t("matches.historyWin")}</option>
        <option value="loss">{t("matches.historyLoss")}</option>
      </select>
      <select
        className={selectClass}
        aria-label={t("matches.filterFormat")}
        value={filters.format ?? ""}
        onChange={(e) => set("format", e.target.value)}
      >
        <option value="">{t("matches.filterFormat")}</option>
        <option value="ONE_V_ONE">{t("matches.oneVOne")}</option>
        <option value="TWO_V_TWO">{t("matches.twoVTwo")}</option>
      </select>
      <select
        className={selectClass}
        aria-label={t("matches.filterSource")}
        value={filters.source ?? ""}
        onChange={(e) => set("source", e.target.value)}
      >
        <option value="">{t("matches.filterSource")}</option>
        <option value="ladder">{t("matches.historyLadder")}</option>
        <option value="tournament">{t("matches.historyTournament")}</option>
      </select>
      <select
        className={selectClass}
        aria-label={t("matches.sortLabel")}
        value={filters.sort ?? "newest"}
        onChange={(e) => set("sort", e.target.value)}
      >
        <option value="newest">{t("matches.sortNewest")}</option>
        <option value="oldest">{t("matches.sortOldest")}</option>
        <option value="score">{t("matches.sortScore")}</option>
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

function HistoryRow({ match, meId }: { match: Match; meId: string }) {
  const { t, i18n } = useTranslation();
  const myTeam = teamOf(match, meId);
  const myScore = myTeam === "A" ? match.scoreA : match.scoreB;
  const theirScore = myTeam === "A" ? match.scoreB : match.scoreA;
  const won = myScore !== null && theirScore !== null && myScore > theirScore;
  const mine = myTeam === "A" ? match.teamA : match.teamB;
  const theirs = myTeam === "A" ? match.teamB : match.teamA;
  const delta = match.ratingDeltas?.[meId] ?? null;
  const names = (team: Match["teamA"]) => team.map((p) => p.displayname).join(" & ");

  return (
    <li className="flex items-center justify-between gap-3 border border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "w-16 shrink-0 text-xs font-bold uppercase tracking-wider",
            won ? "text-primary" : "text-destructive",
          )}
        >
          {won ? t("matches.historyWin") : t("matches.historyLoss")}
        </span>
        <div className="flex shrink-0 -space-x-2">
          {theirs.map((p) => (
            <TeamAvatar key={p.id} player={p} />
          ))}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {names(mine)} {t("matches.vs")} {names(theirs)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {match.tournamentId ? (
              <Link to={ROUTES.tournament(match.tournamentId)} className="underline">
                {t("matches.historyTournament")} · {match.tournamentName}
              </Link>
            ) : (
              t("matches.historyLadder")
            )}
            {match.legNumber ? ` · ${t("matches.historyLeg", { n: match.legNumber })}` : ""}
            {" · "}
            {new Date(match.createdAt).toLocaleDateString(i18n.language)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-mono text-sm font-bold">
          {myScore} - {theirScore}
        </span>
        {delta !== null ? (
          <span
            className={cn(
              "font-mono text-xs font-semibold",
              delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : "text-muted-foreground",
            )}
            title={t("matches.historyPoints")}
          >
            {delta > 0 ? "+" : ""}
            {delta} {t("matches.historyPointsShort")}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function MatchHistoryList({ meId }: { meId: string }) {
  const { t } = useTranslation();
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
  const { data, isLoading, isFetching } = useListMatchHistoryQuery({
    page,
    limit: HISTORY_PAGE_SIZE,
    q: debouncedSearch || undefined,
    ...filters,
  });
  useClampedPage(page, data?.totalPages, setPage);
  const history = data?.items ?? [];
  const filtered = debouncedSearch !== "" || Object.values(filters).some((value) => value !== undefined);

  return (
    <section className="flex flex-col gap-3">
      <HistoryFilters search={search} onSearch={setSearch} filters={filters} onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      {isLoading ? (
        <ListSkeleton count={HISTORY_PAGE_SIZE / 2} action />
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(filtered ? "matches.historyNoMatch" : "matches.historyEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((match) => (
            <HistoryRow key={match.id} match={match} meId={meId} />
          ))}
        </ul>
      )}
      <Pagination
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        disabled={isFetching}
      />
    </section>
  );
}
