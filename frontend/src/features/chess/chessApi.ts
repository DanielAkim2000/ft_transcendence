import { api } from "@/store/api";
import { API_ROUTES } from "@/constants/apiRoutes";
import { CHESS_ENDPOINTS } from "@/constants/queryEndpoints";
import type { PageArgs, Paginated } from "@/lib/pagination";
import { TAG_TYPES } from "@/constants/tagTypes";

export type ChessColor = "WHITE" | "BLACK" | "RANDOM";
export type ChessGameStatus = "PENDING" | "DECLINED" | "ACTIVE" | "FINISHED";
export type ChessResult = "WHITE_WIN" | "BLACK_WIN" | "DRAW" | "ABORTED";
export type ChessEndReason =
    | "CHECKMATE"
    | "RESIGNATION"
    | "TIMEOUT"
    | "STALEMATE"
    | "AGREEMENT"
    | "INSUFFICIENT_MATERIAL"
    | "THREEFOLD_REPETITION"
    | "FIFTY_MOVE_RULE"
    | "ABANDONED"
    | "ABORTED";

export interface ChessPlayer {
    id: string;
    displayname: string;
    avatarUrl: string | null;
}

export interface ChessGame {
    id: string;
    status: ChessGameStatus;
    challengerId: string;
    whitePlayerId: string;
    blackPlayerId: string;
    whitePlayer?: ChessPlayer;
    blackPlayer?: ChessPlayer;
    fen: string;
    turn: "WHITE" | "BLACK";
    timeControlMs: number | null;
    incrementMs: number;
    rated: boolean;
    moveCount: number;
    result: ChessResult | null;
    endReason: ChessEndReason | null;
    winnerId: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    endedAt: string | null;
}

export interface ChessMoveEntry {
    ply: number;
    color: "WHITE" | "BLACK";
    san: string;
}

export interface CreateChessGameRequest {
    opponentId: string;
    color?: ChessColor;
    timeControlMs?: number;
    incrementMs?: number;
    rated?: boolean;
}

export type ChessAiLevel = "EASY" | "MEDIUM" | "HARD" | "EXPERT";

export interface CreateChessAiGameRequest {
    level: ChessAiLevel;
    color?: ChessColor;
}

/** [Major · Jeu web (Échecs)] Endpoints RTK Query du domaine « chess » (requêtes/mutations typées, cache et invalidation par tags) : LIST_GAMES, LIST_HISTORY, GET_GAME, GET_MOVES, CREATE_GAME, CREATE_AI_GAME, ACCEPT_GAME, DECLINE_GAME. */
export const chessApi = api.injectEndpoints({
    endpoints: (builder) => ({
        [CHESS_ENDPOINTS.LIST_GAMES]: builder.query<ChessGame[], void>({
            query: () => API_ROUTES.CHESS_GAMES_ME,
            providesTags: [TAG_TYPES.CHESS],
        }),
        [CHESS_ENDPOINTS.LIST_HISTORY]: builder.query<Paginated<ChessGame>, PageArgs | void>({
            query: (args) => ({ url: API_ROUTES.CHESS_GAMES_HISTORY, params: { ...args } }),
            providesTags: [TAG_TYPES.CHESS],
        }),
        [CHESS_ENDPOINTS.GET_GAME]: builder.query<ChessGame, string>({
            query: (gameId) => API_ROUTES.chessGame(gameId),
            providesTags: (_result, _error, gameId) => [{ type: TAG_TYPES.CHESS, id: gameId }],
        }),
        // `moveCount` ne sert qu'à relancer la requête après chaque coup (les coups arrivent par socket, pas par le cache).
        [CHESS_ENDPOINTS.GET_MOVES]: builder.query<ChessMoveEntry[], { gameId: string; moveCount: number }>({
            query: ({ gameId }) => API_ROUTES.chessGameMoves(gameId),
        }),
        [CHESS_ENDPOINTS.CREATE_GAME]: builder.mutation<ChessGame, CreateChessGameRequest>({
            query: (body) => ({
                url: API_ROUTES.CHESS_GAMES,
                method: "POST",
                body,
            }),
            invalidatesTags: [TAG_TYPES.CHESS],
        }),
        [CHESS_ENDPOINTS.CREATE_AI_GAME]: builder.mutation<ChessGame, CreateChessAiGameRequest>({
            query: (body) => ({
                url: API_ROUTES.CHESS_GAMES_AI,
                method: "POST",
                body,
            }),
            invalidatesTags: [TAG_TYPES.CHESS],
        }),
        [CHESS_ENDPOINTS.ACCEPT_GAME]: builder.mutation<ChessGame, string>({
            query: (gameId) => ({
                url: API_ROUTES.chessGameAccept(gameId),
                method: "POST",
            }),
            invalidatesTags: [TAG_TYPES.CHESS],
        }),
        [CHESS_ENDPOINTS.DECLINE_GAME]: builder.mutation<ChessGame, string>({
            query: (gameId) => ({
                url: API_ROUTES.chessGameDecline(gameId),
                method: "POST",
            }),
            invalidatesTags: [TAG_TYPES.CHESS],
        }),
    }),
});

export const {
    useListChessGamesQuery,
    useListChessHistoryQuery,
    useGetChessGameQuery,
    useGetChessMovesQuery,
    useCreateChessGameMutation,
    useCreateChessAiGameMutation,
    useAcceptChessGameMutation,
    useDeclineChessGameMutation,
} = chessApi;