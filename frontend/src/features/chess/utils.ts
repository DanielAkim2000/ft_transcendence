export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type PieceColor = "black" | "white";

export type Position = {
  x: number;
  y: number;
};

export type Piece = {
  type: PieceType;
  color: PieceColor;
  isFirstMove: boolean;
  isSelected: boolean;
};

const BISHOP_DIRS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];





/** [Major · Jeu web (Échecs)] Crée une pièce (type, couleur, premier coup non joué) pour le plateau local. */
export function makePiece(type: PieceType, color: PieceColor, isFirstMove = true): Piece {
  return { type, color, isFirstMove, isSelected: false };
}

/** [Major · Jeu web (Échecs)] Construit la grille 8×8 du plateau à partir d'une position FEN (pièces, droits de roque). */
export function boardFromFen(fen: string): (Piece | null)[][] {
  const fenFields = fen.split(" ");
  const rows = fenFields[0].split("/");
  const castlingRights = fenFields[2] ?? "-";
  const pieces: Record<string, PieceType> = {
    p: "pawn",
    r: "rook",
    n: "knight",
    b: "bishop",
    q: "queen",
    k: "king",
  };

  return rows.map((row, rowIndex) => {
    const cells: (Piece | null)[] = [];
    for (const symbol of row) {
      if (/\d/.test(symbol)) {
        cells.push(...Array.from({ length: Number(symbol) }, () => null));
      } else {
        const type = pieces[symbol.toLowerCase()];
        if (!type) continue;
        const color = symbol === symbol.toUpperCase() ? "white" : "black";
        const column = cells.length;
        const canCastle = type === "king"
          ? color === "white" ? castlingRights.includes("K") || castlingRights.includes("Q") : castlingRights.includes("k") || castlingRights.includes("q")
          : type === "rook"
            ? color === "white"
              ? (column === 0 && castlingRights.includes("Q")) || (column === 7 && castlingRights.includes("K"))
              : (column === 0 && castlingRights.includes("q")) || (column === 7 && castlingRights.includes("k"))
            : type === "pawn" && (color === "white" ? rowIndex === 6 : rowIndex === 1);
        cells.push(makePiece(type, color, canCastle));
      }
    }
    return cells;
  });
}

/** [Major · Jeu web (Échecs)] Cases atteignables par une pièce à longue portée (tour, fou, dame) dans des directions données, jusqu'au premier obstacle. */
function slide(piece: Piece, y: number, x: number, directions: [number, number][], board: (Piece | null)[][]): Position[] {
  const positions: Position[] = [];

  for (const [dy, dx] of directions) {
    let ny = y + dy;
    let nx = x + dx;

    while (ny >= 0 && ny <= 7 && nx >= 0 && nx <= 7) {
      const target = board[ny][nx];

      if (target == null) {
        positions.push({ y: ny, x: nx });
      } else {
        if (target.color !== piece.color) {
          positions.push({ y: ny, x: nx });
        }
        break;
      }
      ny += dy;
      nx += dx;
    }
  }

  return positions;
}


/** [Major · Jeu web (Échecs)] Déplacements bruts d'une pièce (sans vérifier l'échec) : pas du pion, prise en passant, sauts du cavalier, roi, glissements. */
function getRawMoves(
  piece: Piece,
  y: number,
  x: number,
  board: (Piece | null)[][],
  enPassantTarget?: Position,
): Position[] {
  const positions: Position[] = [];

  switch (piece.type) {
    case "pawn": {
      const dir = piece.color === "white" ? -1 : 1;
      const startRow = piece.color === "white" ? 6 : 1;

      if (y + dir >= 0 && y + dir <= 7 && board[y + dir][x] == null) {
        positions.push({ y: y + dir, x });
        if (piece.isFirstMove && y === startRow && board[y + 2 * dir][x] == null) {
          positions.push({ y: y + 2 * dir, x });
        }
      }

      for (const dx of [-1, 1]) {
        const ny = y + dir, nx = x + dx;
        if (ny >= 0 && ny <= 7 && nx >= 0 && nx <= 7) {
          const target = board[ny][nx];
          if (target != null && target.color !== piece.color) {
            positions.push({ y: ny, x: nx });
          } else if (target == null && enPassantTarget?.y === ny && enPassantTarget.x === nx) {
            positions.push({ y: ny, x: nx });
          }
        }
      }
      break;
    }
    case "knight": {
      const KNIGHT_OFFSETS: [number, number][] = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dy, dx] of KNIGHT_OFFSETS) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny <= 7 && nx >= 0 && nx <= 7) {
          const target = board[ny][nx];
          if (target == null || target.color !== piece.color) {
            positions.push({ y: ny, x: nx });
          }
        }
      }
      break;
    }
    case "bishop":
      positions.push(...slide(piece, y, x, BISHOP_DIRS, board));
      break;
    case "rook":
      positions.push(...slide(piece, y, x, ROOK_DIRS, board));
      break;
    case "queen":
      positions.push(...slide(piece, y, x, QUEEN_DIRS, board));
      break;
    case "king":
      for (const [dy, dx] of QUEEN_DIRS) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny <= 7 && nx >= 0 && nx <= 7) {
          const target = board[ny][nx];
          if (target == null || target.color !== piece.color) {
            positions.push({ y: ny, x: nx });
          }
        }
      }
      break;
  }

  return positions;
}


/** [Major · Jeu web (Échecs)] Vrai si une case est attaquée par une couleur (sert à interdire les roques et les coups qui laissent le roi en échec). */
function isSquareAttacked(y: number, x: number, byColor: string, board: (Piece | null)[][]): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row][col];
      if (p && p.color === byColor) {
        if (p.type === "pawn") {
          const direction = p.color === "white" ? -1 : 1;
          if (row + direction === y && Math.abs(col - x) === 1) return true;
          continue;
        }
        const moves = getRawMoves(p, row, col, board);
        if (moves.some(m => m.y === y && m.x === x)) {
          return true;
        }
      }
    }
  }
  return false;
}


/** [Major · Jeu web (Échecs)] Couleur adverse. */
function opponentColor(color: string): string {
  return color === "white" ? "black" : "white";
}

/** [Major · Jeu web (Échecs)] Coups légaux d'une pièce : coups bruts filtrés pour ne pas laisser son roi en échec, plus les roques ; sert à afficher les destinations. */
export function canMoove(piece: Piece, board: (Piece | null)[][], enPassantTarget?: Position): Position[] {
  const y = board.findIndex(row => row.includes(piece));
  const x = board[y].findIndex(cell => cell === piece);

  const rawMoves = [...getRawMoves(piece, y, x, board, enPassantTarget)];
  if (piece.type === "king" && piece.isFirstMove && x === 4 && (y === 0 || y === 7) && !isSquareAttacked(y, x, opponentColor(piece.color), board)) {
    const rook = board[y][7];
    if (rook?.type === "rook" && rook.color === piece.color && rook.isFirstMove && board[y][5] == null && board[y][6] == null
      && !isSquareAttacked(y, 5, opponentColor(piece.color), board) && !isSquareAttacked(y, 6, opponentColor(piece.color), board)) {
      rawMoves.push({ y, x: 6 });
    }
    const queenSideRook = board[y][0];
    if (queenSideRook?.type === "rook" && queenSideRook.color === piece.color && queenSideRook.isFirstMove && board[y][1] == null && board[y][2] == null && board[y][3] == null
      && !isSquareAttacked(y, 3, opponentColor(piece.color), board) && !isSquareAttacked(y, 2, opponentColor(piece.color), board)) {
      rawMoves.push({ y, x: 2 });
    }
  }

  return rawMoves.filter(move => {
    const simBoard = board.map(row => [...row]);
    simBoard[y][x] = null;
    simBoard[move.y][move.x] = piece;
    if (piece.type === "pawn" && enPassantTarget?.y === move.y && enPassantTarget.x === move.x && board[move.y][move.x] == null) {
      simBoard[move.y + (piece.color === "white" ? 1 : -1)][move.x] = null;
    }
    if (piece.type === "king" && Math.abs(move.x - x) === 2) {
      const rookFromX = move.x > x ? 7 : 0;
      const rookToX = move.x > x ? 5 : 3;
      simBoard[y][rookToX] = simBoard[y][rookFromX];
      simBoard[y][rookFromX] = null;
    }

    let kingY = -1, kingX = -1;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = simBoard[row][col];
        if (p && p.type === "king" && p.color === piece.color) {
          kingY = row;
          kingX = col;
        }
      }
    }

    return !isSquareAttacked(kingY, kingX, opponentColor(piece.color), simBoard);
  });
}
