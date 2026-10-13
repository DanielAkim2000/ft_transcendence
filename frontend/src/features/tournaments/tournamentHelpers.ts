const NAMED_ROUNDS = new Set(["FINAL", "SEMI", "QUARTER", "ROUND_OF_16"]);

/** [Minor · Tournois] Traduit un roundLabel ("FINAL", "SEMI"...) ; retombe sur "Tour N" pour les tableaux plus grands. */
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

/** [Minor · Tournois] Nom d'une équipe de tournoi (« Joueur1 + Joueur2 » en double), ou le libellé « à déterminer » si elle n'est pas encore connue. */
export function entryLabel(
  entry: {
    player1: { displayname: string };
    player2: { displayname: string } | null;
  } | null,
  t: (key: string) => string,
): string {
  if (!entry) return t("tournaments.tbd");
  return entry.player2
    ? `${entry.player1.displayname} + ${entry.player2.displayname}`
    : entry.player1.displayname;
}
