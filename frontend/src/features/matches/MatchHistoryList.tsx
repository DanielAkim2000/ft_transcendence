import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import { ROUTES } from "@/constants/routes";
import { useListMatchHistoryQuery, type Match } from "./matchesApi";
import { teamOf } from "./matchHelpers";
import { TeamAvatar } from "./MatchCard";
import { ListSkeleton } from "@/components/skeletons";

const HISTORY_PAGE_SIZE = 10;

function HistoryRow({ match, meId }: { match: Match; meId: string }) {
  const { t, i18n } = useTranslation();
  const myTeam = teamOf(match, meId);
  const myScore = myTeam === "A" ? match.scoreA : match.scoreB;
  const theirScore = myTeam === "A" ? match.scoreB : match.scoreA;
  const won = myScore !== null && theirScore !== null && myScore > theirScore;
  const mine = myTeam === "A" ? match.teamA : match.teamB;
  const theirs = myTeam === "A" ? match.teamB : match.teamA;
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
      <span className="shrink-0 font-mono text-sm font-bold">
        {myScore} - {theirScore}
      </span>
    </li>
  );
}

export function MatchHistoryList({ meId }: { meId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListMatchHistoryQuery({
    page,
    limit: HISTORY_PAGE_SIZE,
  });
  useClampedPage(page, data?.totalPages, setPage);
  const history = data?.items ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("matches.history")}
      </h2>
      {isLoading ? (
        <ListSkeleton count={HISTORY_PAGE_SIZE / 2} action />
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("matches.historyEmpty")}</p>
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
