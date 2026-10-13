import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useCorrectTournamentScoreMutation } from "@/features/matches/matchesApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { ScoreConfirmDialog } from "@/components/score-confirm-dialog";
import type { TournamentTie } from "./tournamentsApi";
import { entryLabel } from "./tournamentHelpers";

const TARGET_SCORE = 10;

type Leg = TournamentTie["completedLegs"][number];

/** [Minor · Tournois] Ligne d'une manche (leg) : score, statut et bouton de correction pour un administrateur. */
function LegRow({
  leg,
  single,
  teamA,
  teamB,
}: {
  leg: Leg;
  single: boolean;
  teamA: string;
  teamB: string;
}) {
  const { t } = useTranslation();
  const [correct, { isLoading }] = useCorrectTournamentScoreMutation();
  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(String(leg.scoreA));
  const [scoreB, setScoreB] = useState(String(leg.scoreB));

  const a = Number(scoreA);
  const b = Number(scoreB);
  const filled = scoreA !== "" && scoreB !== "";
  const valid =
    filled &&
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    ((a === TARGET_SCORE && b < TARGET_SCORE) ||
      (b === TARGET_SCORE && a < TARGET_SCORE));
  const unchanged = a === leg.scoreA && b === leg.scoreB;

  /** [Minor · Tournois] Ouvre l'édition d'un score en pré-remplissant les champs. */
  const open = () => {
    setScoreA(String(leg.scoreA));
    setScoreB(String(leg.scoreB));
    setEditing(true);
  };

  /** [Minor · Tournois] Envoie la correction du score (administrateur) et confirme ; le bracket est recalculé côté serveur. */
  const submit = async () => {
    try {
      await correct({ matchId: leg.id, scoreA: a, scoreB: b }).unwrap();
      toast.add({
        title: t("tournaments.correction.doneToast", { a, b }),
        type: "success",
      });
      setEditing(false);
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("tournaments.correction.failed")),
        type: "error",
      });
    }
  };

  return (
    <li className="flex flex-col gap-2 border border-border px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span>
          <span className="text-muted-foreground">
            {single
              ? t("tournaments.correction.finalScore")
              : t("tournaments.correction.leg", { n: leg.legNumber })}
            {" · "}
          </span>
          <span className="font-semibold">
            {leg.scoreA} – {leg.scoreB}
          </span>
        </span>
        {editing ? null : (
          <Button type="button" size="xs" variant="outline" onClick={open}>
            {t("tournaments.correction.correct")}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <Input
              type="number"
              min={0}
              max={TARGET_SCORE}
              className="w-16"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              aria-label={t("matches.scoreOfTeamA")}
            />
            <span className="pb-2">–</span>
            <Input
              type="number"
              min={0}
              max={TARGET_SCORE}
              className="w-16"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              aria-label={t("matches.scoreOfTeamB")}
            />
            <ScoreConfirmDialog
              kind="correction"
              teamA={teamA}
              teamB={teamB}
              scoreA={a}
              scoreB={b}
              onConfirm={submit}
            >
              <Button
                type="button"
                size="sm"
                loading={isLoading} disabled={!valid || unchanged}
              >
                {isLoading
                  ? t("tournaments.correction.saving")
                  : t("tournaments.correction.save")}
              </Button>
            </ScoreConfirmDialog>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={isLoading}
              onClick={() => setEditing(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
          <p
            className={cn(
              "text-[11px]",
              filled && !valid ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {filled && !valid
              ? t("tables.scoreInvalid")
              : t("tournaments.correction.hint")}
          </p>
        </div>
      ) : null}
    </li>
  );
}

/** [Minor · Tournois] Admin : liste les manches terminées d'une rencontre et permet d'en corriger le score (le tableau est recalculé par le backend). */
export function LegCorrection({ tie }: { tie: TournamentTie }) {
  const { t } = useTranslation();
  if (tie.completedLegs.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("tournaments.correction.title")}
      </p>
      <ul className="flex flex-col gap-1">
        {tie.completedLegs.map((leg) => (
          <LegRow
            key={leg.id}
            leg={leg}
            single={tie.completedLegs.length === 1}
            teamA={entryLabel(tie.entryA, t)}
            teamB={entryLabel(tie.entryB, t)}
          />
        ))}
      </ul>
    </div>
  );
}
