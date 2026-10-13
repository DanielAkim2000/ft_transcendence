import type { Match } from "./matchesApi";

/** [Minor · Stats et historique] Équipe (A ou B) d'un utilisateur dans un match, null s'il n'y participe pas. */
export function teamOf(match: Match, userId: string): "A" | "B" | null {
  if (match.teamA.some((player) => player.id === userId)) return "A";
  if (match.teamB.some((player) => player.id === userId)) return "B";
  return null;
}
