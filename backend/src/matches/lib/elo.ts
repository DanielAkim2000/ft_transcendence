/**
 * Elo par équipe (1v1 ou 2v2) : l'issue attendue se calcule sur la moyenne
 * des notes de chaque équipe, puis le même delta s'applique à chacun des
 * coéquipiers. K plus haut pour les nouveaux joueurs (moins de 10 matchs),
 * pour qu'ils trouvent leur niveau plus vite, comme prévu dans le plan.
 */
const NEW_PLAYER_MATCH_THRESHOLD = 10;
const K_NEW_PLAYER = 40;
const K_ESTABLISHED = 20;

export type MatchOutcome = 0 | 0.5 | 1;

export interface EloPlayerInput {
  id: string;
  rating: number;
  matchesPlayed: number;
}

export interface EloPlayerResult {
  id: string;
  ratingBefore: number;
  ratingAfter: number;
}

/** Retourne le facteur K d'Elo : 40 pour un joueur de moins de 10 matchs, 20 sinon. */
export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < NEW_PLAYER_MATCH_THRESHOLD
    ? K_NEW_PLAYER
    : K_ESTABLISHED;
}

/** Probabilité de victoire attendue (0 à 1) d'une équipe face à une autre, selon la formule Elo. */
function expectedScore(teamRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - teamRating) / 400));
}

/** Moyenne des notes d'une équipe. */
function average(players: EloPlayerInput[]): number {
  return (
    players.reduce((sum, player) => sum + player.rating, 0) / players.length
  );
}

/** outcomeForTeamA : 1 si l'équipe A a gagné, 0 si elle a perdu, 0.5 en cas d'égalité. */
export function computeEloUpdates(
  teamA: EloPlayerInput[],
  teamB: EloPlayerInput[],
  outcomeForTeamA: MatchOutcome,
): EloPlayerResult[] {
  const teamARating = average(teamA);
  const teamBRating = average(teamB);
  const expectedA = expectedScore(teamARating, teamBRating);
  const expectedB = 1 - expectedA;
  const outcomeForTeamB = (1 - outcomeForTeamA) as MatchOutcome;

  /** Calcule la nouvelle note de chaque joueur d'une équipe selon le résultat attendu et obtenu, avec son propre facteur K. */
  const applyTeam = (
    players: EloPlayerInput[],
    expected: number,
    outcome: MatchOutcome,
  ): EloPlayerResult[] =>
    players.map((player) => ({
      id: player.id,
      ratingBefore: player.rating,
      ratingAfter: Math.round(
        player.rating + kFactor(player.matchesPlayed) * (outcome - expected),
      ),
    }));

  return [
    ...applyTeam(teamA, expectedA, outcomeForTeamA),
    ...applyTeam(teamB, expectedB, outcomeForTeamB),
  ];
}
