import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  useSubmitTournamentScoreMutation,
  useValidateScoreMutation,
} from "@/features/matches/matchesApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import type { TournamentEntry, TournamentTie } from "./tournamentsApi";
import { translateRoundLabel } from "./tournamentHelpers";
import { LegCorrection } from "./LegCorrection";
import { ScoreConfirmDialog } from "@/components/score-confirm-dialog";

const TARGET_SCORE = 10;

function entryName(
  entry: TournamentEntry | null,
  t: (key: string) => string,
): string {
  if (!entry) return t("tournaments.tbd");
  return entry.player2
    ? `${entry.player1.displayname} + ${entry.player2.displayname}`
    : entry.player1.displayname;
}

function EntrySide({
  entry,
  t,
}: {
  entry: TournamentEntry | null;
  t: (key: string) => string;
}) {
  if (!entry) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("tournaments.tbd")}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {[entry.player1, entry.player2]
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((player) => (
          <span key={player.id} className="flex items-center gap-1">
            <Avatar className="size-6">
              <AvatarImage
                src={resolveAvatarUrl(player.avatarUrl)}
                alt={player.displayname}
              />
              <AvatarFallback className="text-[10px]">
                {getInitials(player.displayname)}
              </AvatarFallback>
            </Avatar>
            {player.displayname}
          </span>
        ))}
    </span>
  );
}

export function TieCard({
  tie,
  meId,
  isAdmin = false,
  canCorrect = false,
}: {
  tie: TournamentTie;
  meId?: string;
  /** Seuls les admins saisissent les scores d'un tournoi. */
  isAdmin?: boolean;
  /** Admin sur un tournoi en cours ou terminé : peut corriger les scores déjà saisis. */
  canCorrect?: boolean;
}) {
  const { t } = useTranslation();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [submitScore, { isLoading: submitting }] =
    useSubmitTournamentScoreMutation();
  const [validateScore, { isLoading: validating }] = useValidateScoreMutation();

  const myEntry =
    tie.entryA?.player1.id === meId || tie.entryA?.player2?.id === meId
      ? "A"
      : tie.entryB?.player1.id === meId || tie.entryB?.player2?.id === meId
        ? "B"
        : null;

  // Côté de la rencontre (A ou B) du joueur qui a soumis le score : l'autre côté valide.
  const isIn = (entry: TournamentEntry | null, id: string | null) =>
    id !== null && (entry?.player1.id === id || entry?.player2?.id === id);
  const submitterSide = isIn(tie.entryA, tie.activeLegSubmittedById)
    ? "A"
    : isIn(tie.entryB, tie.activeLegSubmittedById)
      ? "B"
      : null;
  const canValidate =
    myEntry !== null && submitterSide !== null && myEntry !== submitterSide;

  const run = async (
    action: () => Promise<unknown>,
    successMessage?: string,
  ) => {
    try {
      await action();
      if (successMessage) toast.add({ title: successMessage, type: "success" });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("matches.actionFailed")),
        type: "error",
      });
    }
  };

  const a = Number(scoreA);
  const b = Number(scoreB);
  const scoreFilled = scoreA !== "" && scoreB !== "";
  const scoreValid =
    scoreFilled &&
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    ((a === TARGET_SCORE && b < TARGET_SCORE) ||
      (b === TARGET_SCORE && a < TARGET_SCORE));

  const submit = () => {
    if (!tie.activeLegId || !scoreValid) return;
    return run(
      () =>
        submitScore({
          matchId: tie.activeLegId!,
          scoreA: a,
          scoreB: b,
        }).unwrap(),
      t("tournaments.scoreRecordedToast", { a, b }),
    );
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-2 border p-3",
        tie.status === "DONE"
          ? "border-border"
          : "border-primary/40 bg-primary/5",
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

      {tie.status === "IN_PROGRESS" &&
      tie.activeLegStatus === "ACCEPTED" &&
      !isAdmin &&
      myEntry ? (
        <p className="text-xs text-muted-foreground">
          {t("tournaments.scoreByAdmin")}
        </p>
      ) : null}

      {tie.status === "IN_PROGRESS" &&
      tie.activeLegStatus === "ACCEPTED" &&
      isAdmin ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">
                {t("matches.scoreOfTeamA")}
              </Label>
              <Input
                type="number"
                min={0}
                max={TARGET_SCORE}
                className="w-16"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">
                {t("matches.scoreOfTeamB")}
              </Label>
              <Input
                type="number"
                min={0}
                max={TARGET_SCORE}
                className="w-16"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
              />
            </div>
            <ScoreConfirmDialog
              kind="tournament"
              teamA={entryName(tie.entryA, t)}
              teamB={entryName(tie.entryB, t)}
              scoreA={a}
              scoreB={b}
              onConfirm={submit}
            >
              <Button
                type="button"
                size="sm"
                disabled={submitting || !scoreValid}
              >
                {t("matches.submitScore")}
              </Button>
            </ScoreConfirmDialog>
          </div>
          <p
            className={cn(
              "text-[11px]",
              scoreFilled && !scoreValid
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {scoreFilled && !scoreValid
              ? t("tables.scoreInvalid")
              : t("tournaments.adminScoreHint")}
          </p>
        </div>
      ) : null}

      {tie.status === "IN_PROGRESS" &&
      tie.activeLegStatus === "PENDING_VALIDATION" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs">
            {t("matches.scoreSubmitted", {
              a: tie.activeLegScoreA,
              b: tie.activeLegScoreB,
            })}
          </p>
          {canValidate ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={validating}
                onClick={() =>
                  void run(
                    () =>
                      validateScore({
                        matchId: tie.activeLegId!,
                        accept: true,
                      }).unwrap(),
                    t("matches.validatedToast"),
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
                  void run(
                    () =>
                      validateScore({
                        matchId: tie.activeLegId!,
                        accept: false,
                      }).unwrap(),
                    t("matches.disputedToast"),
                  )
                }
              >
                {t("matches.dispute")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("matches.awaitingValidation")}
            </p>
          )}
        </div>
      ) : null}

      {tie.status === "DONE" ? (
        <p className="text-xs font-semibold text-primary">
          {t("tournaments.tieWon", {
            name: entryName(
              tie.winnerEntryId === tie.entryA?.id ? tie.entryA : tie.entryB,
              t,
            ),
            points: tie.pointsAwarded,
          })}
        </p>
      ) : null}
      {canCorrect ? <LegCorrection tie={tie} /> : null}
    </li>
  );
}
