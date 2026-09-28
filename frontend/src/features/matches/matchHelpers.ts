import type { Match } from "./matchesApi";

export function teamOf(match: Match, userId: string): "A" | "B" | null {
  if (match.teamA.some((player) => player.id === userId)) return "A";
  if (match.teamB.some((player) => player.id === userId)) return "B";
  return null;
}
