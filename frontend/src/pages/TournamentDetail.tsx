import { useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMeQuery } from "@/features/auth/authApi";
import { useSearchUsersQuery } from "@/features/users/usersApi";
import {
  useAddTournamentEntryMutation,
  useCancelTournamentMutation,
  useGetTournamentQuery,
  useLaunchTournamentMutation,
  useRemoveTournamentEntryMutation,
} from "@/features/tournaments/tournamentsApi";
import { TieCard } from "@/features/tournaments/TieCard";
import { translateRoundLabel } from "@/features/tournaments/tournamentHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/get-error-message";

function isPowerOfTwo(n: number): boolean {
  return n >= 4 && (n & (n - 1)) === 0;
}

export const TournamentDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMeQuery();
  const { data: tournament, isLoading } = useGetTournamentQuery(id ?? "", { skip: !id });
  const [addEntry, { isLoading: addingEntry }] = useAddTournamentEntryMutation();
  const [removeEntry] = useRemoveTournamentEntryMutation();
  const [launch, { isLoading: launching }] = useLaunchTournamentMutation();
  const [cancelTournament] = useCancelTournamentMutation();
  const [query, setQuery] = useState("");
  const [pendingPlayer1, setPendingPlayer1] = useState<{ id: string; displayname: string } | null>(null);
  const { data: searchResults = [] } = useSearchUsersQuery(query.trim() || undefined);
  const q = query.trim().toLowerCase();
  const results =
    me && (q === "" || me.displayname.toLowerCase().includes(q))
      ? [me, ...searchResults]
      : searchResults;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.add({ title: getErrorMessage(error, t("tournaments.actionFailed")), type: "error" });
    }
  };

  if (isLoading || !tournament) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const isAdmin = me?.role === "ADMIN";
  const enteredIds = new Set(
    tournament.entries.flatMap((entry) => [entry.player1.id, entry.player2?.id].filter((v): v is string => !!v)),
  );

  const pickUser = (user: { id: string; displayname: string }) => {
    if (!id) return;
    if (tournament.format === "ONE_V_ONE") {
      void run(() => addEntry({ id, player1Id: user.id }).unwrap());
      return;
    }
    if (!pendingPlayer1) {
      setPendingPlayer1(user);
      return;
    }
    void run(() =>
      addEntry({ id, player1Id: pendingPlayer1.id, player2Id: user.id }).unwrap(),
    );
    setPendingPlayer1(null);
  };

  const roundsInOrder = Array.from(new Set(tournament.ties.map((tie) => tie.round))).sort((a, b) => a - b);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t(tournament.format === "ONE_V_ONE" ? "matches.oneVOne" : "matches.twoVTwo")}
            {tournament.twoLegged ? ` · ${t("tournaments.twoLegged")}` : ""}
            {" · "}
            {t(`tournaments.status.${tournament.status}`)}
          </p>
        </div>
        {isAdmin && tournament.status === "IN_PROGRESS" ? (
          <ConfirmDialog
            title={t("tournaments.cancelTitle")}
            description={t("tournaments.cancelDescription")}
            confirmLabel={t("tournaments.cancel")}
            onConfirm={() => run(() => cancelTournament(tournament.id).unwrap())}
          >
            <Button type="button" variant="destructive">
              {t("tournaments.cancel")}
            </Button>
          </ConfirmDialog>
        ) : null}
      </header>

      {tournament.status === "COMPLETED" && tournament.championEntryId ? (
        <p className="border border-primary/50 bg-primary/10 p-3 text-sm font-semibold text-primary">
          {t("tournaments.champion", {
            name: (() => {
              const champion = tournament.entries.find((e) => e.id === tournament.championEntryId);
              return champion
                ? champion.player2
                  ? `${champion.player1.displayname} + ${champion.player2.displayname}`
                  : champion.player1.displayname
                : "?";
            })(),
          })}
        </p>
      ) : null}

      {tournament.status === "DRAFT" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("tournaments.entries")} · {tournament.entries.length}
          </h2>
          <ul className="flex flex-col gap-1">
            {tournament.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 border border-border px-2 py-1 text-sm"
              >
                {entry.player2
                  ? `${entry.player1.displayname} + ${entry.player2.displayname}`
                  : entry.player1.displayname}
                {isAdmin ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => removeEntry({ id: tournament.id, entryId: entry.id }).unwrap())}
                  >
                    {t("tournaments.removeEntry")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          {isAdmin ? (
            <>
              {tournament.format === "TWO_V_TWO" && pendingPlayer1 ? (
                <p className="text-xs text-primary">
                  {t("tournaments.pickSecondPlayer", { name: pendingPlayer1.displayname })}
                </p>
              ) : null}
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("tournaments.searchPlayer")}
                disabled={addingEntry}
              />
              <ul className="flex flex-col gap-1">
                {results
                  .filter((user) => !enteredIds.has(user.id) && pendingPlayer1?.id !== user.id)
                  .map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => pickUser(user)}
                        className="w-full border border-border px-2 py-1 text-left text-sm hover:border-primary/50"
                      >
                        {user.displayname}
                      </button>
                    </li>
                  ))}
              </ul>
              <Button
                type="button"
                disabled={launching || !isPowerOfTwo(tournament.entries.length)}
                onClick={() => void run(() => launch(tournament.id).unwrap())}
              >
                {t("tournaments.launch")}
              </Button>
              {!isPowerOfTwo(tournament.entries.length) ? (
                <p className="text-xs text-muted-foreground">{t("tournaments.needsPowerOfTwo")}</p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {tournament.status !== "DRAFT" ? (
        <div className="flex flex-col gap-6">
          {roundsInOrder.map((round) => {
            const ties = tournament.ties.filter((tie) => tie.round === round);
            return (
              <section key={round} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {ties[0] ? translateRoundLabel(ties[0].roundLabel, t) : ""}
                </h2>
                <ul className="flex flex-col gap-2">
                  {ties.map((tie) => (
                    <TieCard key={tie.id} tie={tie} meId={me?.id} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
