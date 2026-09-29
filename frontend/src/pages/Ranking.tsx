import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@base-ui/react/dialog";
import { Link } from "react-router";
import { ROUTES } from "@/constants/routes";
import { useMeQuery } from "@/features/auth/authApi";
import { useGetRankingQuery, type RankingEntry } from "@/features/users/usersApi";
import { FriendPicker } from "@/features/users/FriendPicker";
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import { useListMatchesQuery, useProposeMatchMutation, type MatchFormat } from "@/features/matches/matchesApi";
import { MatchCard } from "@/features/matches/MatchCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ListSkeleton } from "@/components/skeletons";

const RANKING_PAGE_SIZE = 10;
const MATCHES_PAGE_SIZE = 10;

function ChallengeDialog({
  opponent,
  children,
}: {
  opponent: RankingEntry;
  children: React.ReactElement;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<MatchFormat>("ONE_V_ONE");
  const [teammateId, setTeammateId] = useState("");
  const [propose, { isLoading }] = useProposeMatchMutation();

  const submit = async () => {
    if (format === "TWO_V_TWO" && !teammateId) return;
    try {
      await propose({
        opponentId: opponent.id,
        format,
        teammateId: format === "TWO_V_TWO" ? teammateId : undefined,
      }).unwrap();
      setOpen(false);
      setFormat("ONE_V_ONE");
      setTeammateId("");
      toast.add({ title: t("matches.challengeSentToast", { name: opponent.displayname }), type: "success" });
    } catch (error) {
      toast.add({ title: getErrorMessage(error, t("matches.actionFailed")), type: "error" });
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (isLoading && !next) return;
        setOpen(next);
      }}
    >
      <Dialog.Trigger render={children} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-bold uppercase tracking-wider">
            {t("matches.challengeTitle", { name: opponent.displayname })}
          </Dialog.Title>
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as MatchFormat)}
            className="mt-4 flex flex-col gap-2"
          >
            <Label className="flex items-center gap-2 border border-border p-2 text-sm">
              <RadioGroupItem value="ONE_V_ONE" />
              {t("matches.oneVOne")}
            </Label>
            <Label className="flex items-center gap-2 border border-border p-2 text-sm">
              <RadioGroupItem value="TWO_V_TWO" />
              {t("matches.twoVTwo")}
            </Label>
          </RadioGroup>
          {format === "TWO_V_TWO" ? (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("matches.pickTeammateTitle")}
              </p>
              <FriendPicker value={teammateId} onChange={setTeammateId} excludeIds={[opponent.id]} />
            </div>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close disabled={isLoading} render={<Button type="button" variant="outline" />}>
              {t("common.cancel")}
            </Dialog.Close>
            <Button
              type="button"
              disabled={isLoading || (format === "TWO_V_TWO" && !teammateId)}
              onClick={() => void submit()}
            >
              {t("matches.sendChallenge")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const Ranking = () => {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const { data: ranking = [], isLoading: rankingLoading } = useGetRankingQuery();
  const [matchesPage, setMatchesPage] = useState(1);
  const { data: matches, isLoading: matchesLoading, isFetching: matchesFetching } =
    useListMatchesQuery({ page: matchesPage, limit: MATCHES_PAGE_SIZE });
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(ranking.length / RANKING_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstRank = (currentPage - 1) * RANKING_PAGE_SIZE;
  const pageEntries = ranking.slice(firstRank, firstRank + RANKING_PAGE_SIZE);

  useClampedPage(matchesPage, matches?.totalPages, setMatchesPage);
  const activeMatches = matches?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("matches.rankingTitle")}</h1>
        <span className="text-[11px] uppercase tracking-[0.2em] text-primary">
          ● {t("tables.realtime")}
        </span>
      </header>

      <section className="flex flex-col gap-3">
        {rankingLoading ? (
          <ListSkeleton count={RANKING_PAGE_SIZE} lead action />
        ) : (
          <ol className="flex flex-col gap-2">
            {pageEntries.map((entry, index) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-xs font-bold text-muted-foreground">
                    {firstRank + index + 1}
                  </span>
                  <Avatar className="size-9 rounded-lg">
                    <AvatarImage src={resolveAvatarUrl(entry.avatarUrl)} alt={entry.displayname} className="rounded-lg" />
                    <AvatarFallback className="rounded-lg text-xs">{getInitials(entry.displayname)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.displayname}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("matches.matchesPlayed", { count: entry.matchesPlayed })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-bold">{entry.rating}</span>
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
        <Pagination page={currentPage} totalPages={pageCount} onPageChange={setPage} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("matches.myMatches")}
          </h2>
          <Link
            to={ROUTES.HISTORY}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {t("matches.viewHistory")}
          </Link>
        </div>
        {matchesLoading ? (
          <ListSkeleton count={3} avatar={false} action />
        ) : activeMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("matches.noMatches")}</p>
        ) : me ? (
          <ul className="flex flex-col gap-2">
            {activeMatches.map((match) => (
              <MatchCard key={match.id} match={match} meId={me.id} />
            ))}
          </ul>
        ) : null}
        <Pagination
          page={matches?.page ?? matchesPage}
          totalPages={matches?.totalPages ?? 1}
          onPageChange={setMatchesPage}
          disabled={matchesFetching}
        />
      </section>
    </div>
  );
};
