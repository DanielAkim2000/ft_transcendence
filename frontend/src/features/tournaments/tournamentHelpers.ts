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
