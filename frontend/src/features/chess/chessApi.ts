import { api } from "@/store/api";
import { API_ROUTES } from "@/constants/apiRoutes";
import { CHESS_ENDPOINTS } from "@/constants/queryEndpoints";
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

export interface ChessGame {
    id: string;
    status: ChessGameStatus;
    challengerId: string;
    whitePlayerId: string;
    blackPlayerId: string;
    fen: string;
    turn: "WHITE" | "BLACK";
    timeControlMs: number | null;
    incrementMs: number;
    rated: boolean;
    result: ChessResult | null;
    endReason: ChessEndReason | null;
    winnerId: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    endedAt: string | null;
}

export interface CreateChessGameRequest {
    opponentId: string;
    color?: ChessColor;
    timeControlMs?: number;
    incrementMs?: number;
    rated?: boolean;
}

export const chessApi = api.injectEndpoints({
    endpoints: (builder) => ({
        [CHESS_ENDPOINTS.LIST_GAMES]: builder.query<ChessGame[], void>({
            query: () => API_ROUTES.CHESS_GAMES_ME,
            providesTags: [TAG_TYPES.CHESS],
        }),
        [CHESS_ENDPOINTS.GET_GAME]: builder.query<ChessGame, string>({
            query: (gameId) => API_ROUTES.chessGame(gameId),
            providesTags: (_result, _error, gameId) => [{ type: TAG_TYPES.CHESS, id: gameId }],
        }),
        [CHESS_ENDPOINTS.CREATE_GAME]: builder.mutation<ChessGame, CreateChessGameRequest>({
            query: (body) => ({
                url: API_ROUTES.CHESS_GAMES,
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
    useGetChessGameQuery,
    useCreateChessGameMutation,
    useAcceptChessGameMutation,
    useDeclineChessGameMutation,
} = chessApi;