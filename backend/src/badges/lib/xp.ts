/** XP fixe par partie jouée (ladder ou manche de tournoi), bonus si victoire. */
export const XP_PER_MATCH_PLAYED = 10;
export const XP_PER_MATCH_WIN_BONUS = 20;
export const XP_PER_TOURNAMENT_WIN_BONUS = 50;

/** Écart de note minimum pour qu'une victoire compte comme un exploit (badge "tombeur"). */
export const GIANT_SLAYER_RATING_GAP = 150;

const LEVEL_XP_STEP = 100;

/** Niveau du joueur (à partir de 1) pour un total d'XP donné. */
export function levelForXp(xp: number): number {
  return Math.floor(xp / LEVEL_XP_STEP) + 1;
}

/** XP accumulée dans le niveau courant. */
export function xpIntoLevel(xp: number): number {
  return xp % LEVEL_XP_STEP;
}

/** Nombre d'XP nécessaires pour passer un niveau. */
export function xpPerLevel(): number {
  return LEVEL_XP_STEP;
}
