import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

type Kind = "ladder" | "table" | "tournament" | "correction";

type Props = {
  /** Bouton qui ouvre la confirmation (désactivé tant que le score n'est pas valide). */
  children: ReactElement;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  /** Contexte : détermine le rappel affiché sous le score. */
  kind: Kind;
  onConfirm: () => void | Promise<void>;
};

/** Récapitulatif du score (équipes, score, vainqueur) : on relit ce qu'on a saisi avant d'enregistrer. */
function ScoreRecap({
  teamA,
  teamB,
  scoreA,
  scoreB,
}: Pick<Props, "teamA" | "teamB" | "scoreA" | "scoreB">) {
  const aWins = scoreA > scoreB;
  const side = (name: string, score: number, wins: boolean) => (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 border px-2 py-3 text-center",
        wins ? "border-primary/60 bg-primary/10" : "border-border",
      )}
    >
      <span className="w-full truncate font-sans text-xs text-muted-foreground">
        {name}
      </span>
      <span
        className={cn(
          "font-heading text-3xl font-bold",
          wins ? "text-primary" : "text-foreground",
        )}
      >
        {score}
      </span>
    </div>
  );
  return (
    <div className="mt-4 flex items-stretch gap-2" aria-live="polite">
      {side(teamA, scoreA, aWins)}
      <span className="self-center text-sm text-muted-foreground">–</span>
      {side(teamB, scoreB, !aWins)}
    </div>
  );
}

/** Demande de confirmation avant d'enregistrer un score : rappelle le score saisi, qui gagne, et ce qui se passera ensuite. */
export function ScoreConfirmDialog({
  children,
  teamA,
  teamB,
  scoreA,
  scoreB,
  kind,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const winner = scoreA > scoreB ? teamA : teamB;
  return (
    <ConfirmDialog
      title={t("scoreConfirm.title")}
      description={t(`scoreConfirm.description.${kind}`, { winner })}
      body={
        <ScoreRecap
          teamA={teamA}
          teamB={teamB}
          scoreA={scoreA}
          scoreB={scoreB}
        />
      }
      confirmLabel={t("scoreConfirm.confirm")}
      cancelLabel={t("scoreConfirm.edit")}
      variant="default"
      onConfirm={onConfirm}
    >
      {children}
    </ConfirmDialog>
  );
}
