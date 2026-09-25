import type { Tournament } from "./tournamentsApi";

const NAMED_ROUNDS = new Set(["FINAL", "SEMI", "QUARTER", "ROUND_OF_16"]);

/** Traduit un roundLabel ("FINAL", "SEMI"...) ; retombe sur "Tour N" pour les tableaux plus grands. */
export function translateRoundLabel(label: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (NAMED_ROUNDS.has(label)) {
    return t(`tournaments.round.${label}`);
  }
  const match = /^ROUND_(\d+)$/.exec(label);
  if (match) {
    return t("tournaments.roundGeneric", { n: match[1] });
  }
  return label;
}

function isInEntry(entry: { player1: { id: string }; player2?: { id: string } | null } | null, userId: string): boolean {
  if (!entry) return false;
  return entry.player1.id === userId || entry.player2?.id === userId;
}

/** Vrai si l'utilisateur a une rencontre de tournoi active (à jouer ou à valider) en ce moment. */
export function hasActiveTournamentAction(tournaments: Tournament[], userId: string): boolean {
  return tournaments.some(
    (tournament) =>
      tournament.status === "IN_PROGRESS" &&
      tournament.ties.some(
        (tie) =>
          !!tie.activeLegId && (isInEntry(tie.entryA, userId) || isInEntry(tie.entryB, userId)),
      ),
  );
}
