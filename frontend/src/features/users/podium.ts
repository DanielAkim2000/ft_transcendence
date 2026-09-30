/** Un rang du podium (1, 2 ou 3) : il faut avoir joué au moins un match pour l'avoir mérité (sinon tous les nouveaux à 1000 seraient « champions »). */
export function isPodium(
  rank: number | null,
  matchesPlayed: number,
): rank is 1 | 2 | 3 {
  return rank !== null && rank >= 1 && rank <= 3 && matchesPlayed > 0;
}
