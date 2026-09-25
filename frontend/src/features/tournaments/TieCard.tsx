import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useSubmitScoreMutation, useValidateScoreMutation } from "@/features/matches/matchesApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import type { TournamentEntry, TournamentTie } from "./tournamentsApi";
import { translateRoundLabel } from "./tournamentHelpers";

function entryName(entry: TournamentEntry | null, t: (key: string) => string): string {
  if (!entry) return t("tournaments.tbd");
  return entry.player2
    ? `${entry.player1.displayname} + ${entry.player2.displayname}`
    : entry.player1.displayname;
}

function EntrySide({ entry, t }: { entry: TournamentEntry | null; t: (key: string) => string }) {
  if (!entry) {
    return <span className="text-xs text-muted-foreground">{t("tournaments.tbd")}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {[entry.player1, entry.player2].filter((p): p is NonNullable<typeof p> => !!p).map((player) => (
        <span key={player.id} className="flex items-center gap-1">
          <Avatar className="size-6">
            <AvatarImage src={resolveAvatarUrl(player.avatarUrl)} alt={player.displayname} />
            <AvatarFallback className="text-[10px]">{getInitials(player.displayname)}</AvatarFallback>
          </Avatar>
          {player.displayname}
        </span>
      ))}
    </span>
  );
}

export function TieCard({ tie, meId }: { tie: TournamentTie; meId?: string }) {
  const { t } = useTranslation();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [submitScore, { isLoading: submitting }] = useSubmitScoreMutation();
  const [validateScore, { isLoading: validating }] = useValidateScoreMutation();

  const myEntry =
    tie.entryA?.player1.id === meId || tie.entryA?.player2?.id === meId
      ? "A"
      : tie.entryB?.player1.id === meId || tie.entryB?.player2?.id === meId
        ? "B"
        : null;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.add({ title: getErrorMessage(error, t("matches.actionFailed")), type: "error" });
    }
  };

  const submit = () => {
    if (!tie.activeLegId) return;
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return;
    void run(() => submitScore({ matchId: tie.activeLegId!, scoreA: a, scoreB: b }).unwrap());
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-2 border p-3",
        tie.status === "DONE" ? "border-border" : "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 flex-col gap-1">
          <EntrySide entry={tie.entryA} t={t} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("matches.vs")}
          </span>
          <EntrySide entry={tie.entryB} t={t} />
        </div>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {translateRoundLabel(tie.roundLabel, t)}
        </span>
      </div>

      {tie.legsNeeded > 1 || tie.legsPlayed > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t("tournaments.aggregate", {
            a: tie.aggregateScoreA ?? 0,
            b: tie.aggregateScoreB ?? 0,
            played: tie.legsPlayed,
            needed: tie.legsNeeded,
          })}
        </p>
      ) : null}

      {tie.status === "IN_PROGRESS" && tie.activeLegStatus === "ACCEPTED" && myEntry ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              {t("matches.scoreOfTeamA")}
            </Label>
            <Input type="number" min={0} className="w-16" value={scoreA} onChange={(e) => setScoreA(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              {t("matches.scoreOfTeamB")}
            </Label>
            <Input type="number" min={0} className="w-16" value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
          </div>
          <Button type="button" size="sm" disabled={submitting || scoreA === "" || scoreB === ""} onClick={submit}>
            {t("matches.submitScore")}
          </Button>
        </div>
      ) : null}

      {tie.status === "IN_PROGRESS" && tie.activeLegStatus === "PENDING_VALIDATION" ? (
        myEntry ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={validating}
              onClick={() =>
                void run(() =>
                  validateScore({ matchId: tie.activeLegId!, accept: true }).unwrap(),
                )
              }
            >
              {t("matches.validate")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={validating}
              onClick={() =>
                void run(() =>
                  validateScore({ matchId: tie.activeLegId!, accept: false }).unwrap(),
                )
              }
            >
              {t("matches.dispute")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("matches.awaitingValidation")}</p>
        )
      ) : null}

      {tie.status === "DONE" ? (
        <p className="text-xs font-semibold text-primary">
          {t("tournaments.tieWon", {
            name: entryName(tie.winnerEntryId === tie.entryA?.id ? tie.entryA : tie.entryB, t),
            points: tie.pointsAwarded,
          })}
        </p>
      ) : null}
    </li>
  );
}
