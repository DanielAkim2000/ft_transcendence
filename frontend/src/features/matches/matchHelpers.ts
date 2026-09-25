import type { Match } from "./matchesApi";

export function teamOf(match: Match, userId: string): "A" | "B" | null {
  if (match.teamA.some((player) => player.id === userId)) return "A";
  if (match.teamB.some((player) => player.id === userId)) return "B";
  return null;
}

/** Vrai si l'utilisateur a une action à faire sur ce match (répondre, jouer, valider). */
export function needsMyAction(match: Match, userId: string): boolean {
  if (match.status === "PENDING") {
    return match.teamB[0]?.id === userId;
  }
  if (match.status === "ACCEPTED") {
    return teamOf(match, userId) !== null;
  }
  if (match.status === "PENDING_VALIDATION") {
    const submitterTeam = match.submittedBy
      ? teamOf(match, match.submittedBy.id)
      : null;
    const myTeam = teamOf(match, userId);
    return submitterTeam !== null && myTeam !== null && submitterTeam !== myTeam;
  }
  return false;
}
