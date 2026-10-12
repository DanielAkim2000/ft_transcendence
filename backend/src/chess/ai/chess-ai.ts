import { Chess, Move } from 'chess.js';

export const AI_LEVELS = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export type AiMove = { from: string; to: string; promotion?: string };

type LevelConfig = {
  maxDepth: number;
  timeMs: number;
  /** Bruit ajouté au score de chaque coup racine : rend l'IA faillible. */
  noise: number;
  /** Probabilité de jouer un coup légal au hasard. */
  randomChance: number;
  quiescence: boolean;
};

const LEVELS: Record<AiLevel, LevelConfig> = {
  EASY: {
    maxDepth: 1,
    timeMs: 500,
    noise: 200,
    randomChance: 0.25,
    quiescence: false,
  },
  MEDIUM: {
    maxDepth: 2,
    timeMs: 1000,
    noise: 40,
    randomChance: 0,
    quiescence: false,
  },
  HARD: {
    maxDepth: 4,
    timeMs: 1500,
    noise: 0,
    randomChance: 0,
    quiescence: true,
  },
  EXPERT: {
    maxDepth: 8,
    timeMs: 3500,
    noise: 0,
    randomChance: 0,
    quiescence: true,
  },
};

const MATE = 100_000;
const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Tables de valeur par case (point de vue des blancs, ligne 0 = rang 8).
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
    20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5,
    -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0,
    0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
    0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20,
    20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20,
    -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0,
    5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10,
    0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20,
    -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0,
    -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
    5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5,
    5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
    -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
    -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

class TimeUp extends Error {}

/** Évaluation statique, du point de vue du camp au trait. */
function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const white = piece.color === 'w';
      const index = white ? row * 8 + col : (7 - row) * 8 + col;
      const value = PIECE_VALUE[piece.type] + PST[piece.type][index];
      score += white ? value : -value;
    }
  }
  return chess.turn() === 'w' ? score : -score;
}

/** Captures et promotions d'abord (MVV-LVA) : l'élagage coupe bien plus tôt. */
function orderMoves(moves: Move[]): Move[] {
  const weight = (move: Move) =>
    (move.captured
      ? 10 * PIECE_VALUE[move.captured] - PIECE_VALUE[move.piece] / 10
      : 0) + (move.promotion ? PIECE_VALUE[move.promotion] : 0);
  return moves.sort((a, b) => weight(b) - weight(a));
}

class Searcher {
  private nodes = 0;
  private deadline = 0;

  constructor(
    private readonly chess: Chess,
    private readonly config: LevelConfig,
  ) {}

  private checkTime(): void {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline)
      throw new TimeUp();
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    this.checkTime();
    const standPat = evaluate(this.chess);
    if (ply >= 8) return standPat;
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const captures = orderMoves(
      this.chess.moves({ verbose: true }).filter((move) => move.captured),
    );
    for (const move of captures) {
      this.chess.move(move);
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      this.chess.undo();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private negamax(
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    this.checkTime();
    if (this.chess.isCheckmate()) return -MATE + ply;
    if (this.chess.isDraw()) return 0;
    if (depth <= 0)
      return this.config.quiescence
        ? this.quiesce(alpha, beta, 0)
        : evaluate(this.chess);

    let best = -Infinity;
    for (const move of orderMoves(this.chess.moves({ verbose: true }))) {
      this.chess.move(move);
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.chess.undo();
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Recherche itérative : la dernière profondeur terminée fait foi si le temps est écoulé. */
  search(rootMoves: Move[]): Move {
    this.deadline = Date.now() + this.config.timeMs;
    const rootFen = this.chess.fen();
    let ordered = orderMoves([...rootMoves]);
    let best = ordered[0];

    for (let depth = 1; depth <= this.config.maxDepth; depth++) {
      const scored: { move: Move; score: number }[] = [];
      let alpha = -Infinity;
      try {
        for (const move of ordered) {
          this.chess.move(move);
          // Avec du bruit, chaque coup doit avoir un vrai score : fenêtre complète.
          const score = -this.negamax(
            depth - 1,
            -Infinity,
            this.config.noise > 0 ? Infinity : -alpha,
            1,
          );
          this.chess.undo();
          scored.push({ move, score });
          if (score > alpha) alpha = score;
        }
      } catch (error) {
        if (!(error instanceof TimeUp)) throw error;
        // Des coups d'analyse sont restés joués : on repart de la position racine.
        this.chess.load(rootFen);
        break;
      }

      for (const entry of scored)
        entry.score += (Math.random() * 2 - 1) * this.config.noise;
      scored.sort((a, b) => b.score - a.score);
      best = scored[0].move;
      ordered = scored.map((entry) => entry.move);
      if (scored[0].score > MATE - 100) break; // mat forcé trouvé
    }
    return best;
  }
}

/** Choisit le coup de l'IA pour la position `fen` au niveau demandé. */
export function chooseMove(fen: string, level: AiLevel): AiMove | null {
  const config = LEVELS[level];
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  const chosen =
    Math.random() < config.randomChance
      ? moves[Math.floor(Math.random() * moves.length)]
      : new Searcher(chess, config).search(moves);
  return { from: chosen.from, to: chosen.to, promotion: chosen.promotion };
}
