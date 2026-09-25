import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@base-ui/react/dialog";
import { useMeQuery } from "@/features/auth/authApi";
import { useGetRankingQuery, useListFriendsQuery, type RankingEntry } from "@/features/users/usersApi";
import { useListMatchesQuery, useProposeMatchMutation, type MatchFormat } from "@/features/matches/matchesApi";
import { MatchCard } from "@/features/matches/MatchCard";
import { MatchHistoryList } from "@/features/matches/MatchHistoryList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";

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
  const { data: allFriends = [] } = useListFriendsQuery();
  const friends = allFriends.filter((friend) => friend.id !== opponent.id);
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
              <RadioGroup value={teammateId} onValueChange={setTeammateId} className="flex flex-col gap-2">
                {friends.map((friend) => (
                  <Label key={friend.id} className="flex items-center gap-2 border border-border p-2 text-sm">
                    <RadioGroupItem value={friend.id} />
                    {friend.displayname}
                  </Label>
                ))}
                {friends.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("matches.noFriends")}</p>
                ) : null}
              </RadioGroup>
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
  const { data: matches = [], isLoading: matchesLoading } = useListMatchesQuery();

  const activeMatches = matches.filter((m) => m.status !== "DECLINED");

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
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((entry, index) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-xs font-bold text-muted-foreground">
                    {index + 1}
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("matches.myMatches")}
        </h2>
        {matchesLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : activeMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("matches.noMatches")}</p>
        ) : me ? (
          <ul className="flex flex-col gap-2">
            {activeMatches.map((match) => (
              <MatchCard key={match.id} match={match} meId={me.id} />
            ))}
          </ul>
        ) : null}
      </section>

      {me ? <MatchHistoryList meId={me.id} /> : null}
    </div>
  );
};
