/** Mélange Fisher-Yates, pour le tirage au sort du tableau. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** round est 1-indexé depuis le 1er tour ; totalRounds = log2(nombre d'entrées). */
export function roundLabel(round: number, totalRounds: number): string {
  const distanceFromFinal = totalRounds - round;
  if (distanceFromFinal === 0) return 'FINAL';
  if (distanceFromFinal === 1) return 'SEMI';
  if (distanceFromFinal === 2) return 'QUARTER';
  if (distanceFromFinal === 3) return 'ROUND_OF_16';
  return `ROUND_${round}`;
}

/** Points fixes gagnés par le vainqueur d'une rencontre, selon le tour (même barème pour tous, pas d'Elo relatif). */
const POINTS_PER_ROUND_BASE = 10;
/** Points gagnés par le vainqueur d'une rencontre : 10 × numéro du tour. */
export function pointsForRound(round: number): number {
  return POINTS_PER_ROUND_BASE * round;
}

/** Indique si n est une puissance de 2 supérieure ou égale à 2 (taille valide pour un tableau). */
export function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/** Logarithme base 2 arrondi : nombre de tours d'un tableau de n entrées. */
export function log2(n: number): number {
  return Math.round(Math.log2(n));
}

export interface TieLeg {
  legNumber: number;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
}

export interface TieResolution {
  /** true si la rencontre est décidée (plus de manche à jouer). */
  done: boolean;
  winnerSide: 'A' | 'B' | null;
  /** Numéro de la prochaine manche à jouer si done=false, sinon null. */
  nextLegNumber: number | null;
}

/**
 * Détermine si une rencontre est terminée et qui l'emporte, à partir des
 * manches déjà validées (COMPLETED). Aller-retour : décision à l'addition
 * des scores ; égalité après 2 manches -> 3e manche (belle) qui tranche seule.
 */
export function resolveTie(twoLegged: boolean, legs: TieLeg[]): TieResolution {
  const completed = legs
    .filter((leg) => leg.status === 'COMPLETED')
    .sort((a, b) => a.legNumber - b.legNumber);

  if (!twoLegged) {
    const leg = completed[0];
    if (!leg || leg.scoreA === null || leg.scoreB === null) {
      return { done: false, winnerSide: null, nextLegNumber: 1 };
    }
    return {
      done: true,
      winnerSide: leg.scoreA > leg.scoreB ? 'A' : 'B',
      nextLegNumber: null,
    };
  }

  if (completed.length < 2) {
    return {
      done: false,
      winnerSide: null,
      nextLegNumber: completed.length + 1,
    };
  }

  const aggregateA = completed
    .slice(0, 2)
    .reduce((sum, leg) => sum + (leg.scoreA ?? 0), 0);
  const aggregateB = completed
    .slice(0, 2)
    .reduce((sum, leg) => sum + (leg.scoreB ?? 0), 0);

  if (aggregateA !== aggregateB) {
    return {
      done: true,
      winnerSide: aggregateA > aggregateB ? 'A' : 'B',
      nextLegNumber: null,
    };
  }

  // Égalité après 2 manches : la belle (3e manche) tranche seule, sans addition.
  const decider = completed.find((leg) => leg.legNumber === 3);
  if (!decider || decider.scoreA === null || decider.scoreB === null) {
    return { done: false, winnerSide: null, nextLegNumber: 3 };
  }
  return {
    done: true,
    winnerSide: decider.scoreA > decider.scoreB ? 'A' : 'B',
    nextLegNumber: null,
  };
}

export interface LegCorrectionPlan {
  /** Résolution de la rencontre avec le score actuel. */
  before: TieResolution;
  /** Résolution de la rencontre avec le score corrigé. */
  after: TieResolution;
  /** L'équipe qui gagne la manche change (le score corrigé inverse le résultat de la manche). */
  legWinnerFlipped: boolean;
  /** Le sort de la rencontre change : décidée ↔ à rejouer, ou autre vainqueur. */
  tieOutcomeChanged: boolean;
}

/** Prévoit l'effet de la correction du score d'une manche terminée sur sa rencontre (sans rien modifier). */
export function planLegCorrection(
  twoLegged: boolean,
  legs: TieLeg[],
  legNumber: number,
  scoreA: number,
  scoreB: number,
): LegCorrectionPlan {
  const target = legs.find((leg) => leg.legNumber === legNumber);
  const before = resolveTie(twoLegged, legs);
  const after = resolveTie(
    twoLegged,
    legs.map((leg) =>
      leg.legNumber === legNumber ? { ...leg, scoreA, scoreB } : leg,
    ),
  );
  const oldSide =
    target && target.scoreA !== null && target.scoreB !== null
      ? target.scoreA > target.scoreB
        ? 'A'
        : 'B'
      : null;
  const newSide = scoreA > scoreB ? 'A' : 'B';
  return {
    before,
    after,
    legWinnerFlipped: oldSide !== null && oldSide !== newSide,
    tieOutcomeChanged:
      before.done !== after.done || before.winnerSide !== after.winnerSide,
  };
}
