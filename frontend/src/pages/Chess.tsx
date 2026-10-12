import { useSearchParams } from "react-router";
import { boardFromFen, makePiece, type Piece, type Position, canMoove } from "@/features/chess/utils";
import {
    useAcceptChessGameMutation,
    useCreateChessGameMutation,
    useCreateChessAiGameMutation,
    useDeclineChessGameMutation,
    useGetChessGameQuery,
    useListChessGamesQuery,
} from "@/features/chess/chessApi";
import { useListFriendsQuery } from "@/features/users/usersApi";
import { useMeQuery } from "@/features/auth/authApi";
import { selectAccessToken } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";
import { connectChess, disconnectChess } from "@/features/chess/chessSocket";
import type { ChessAiLevel, ChessColor, ChessGame, ChessGameStatus } from "@/features/chess/chessApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { toast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateErrorCode } from "@/lib/get-error-message";
import { ChessBoard3D } from "@/features/chess/ChessBoard3D";
import { ChessPlayerBar } from "@/features/chess/ChessPlayerBar";

const AI_LEVELS: ChessAiLevel[] = ["EASY", "MEDIUM", "HARD", "EXPERT"];
const AI_COLORS: ChessColor[] = ["WHITE", "BLACK", "RANDOM"];

export const Chess = () => {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const [, setSearchParams] = useSearchParams();
    const requestedGameId = searchParams.get("gameId");
    const [friendsPage, setFriendsPage] = useState(1);
    const { data: me } = useMeQuery();
    const accessToken = useAppSelector(selectAccessToken);
    const { data: friendsData, isLoading: friendsLoading } = useListFriendsQuery({ page: friendsPage, limit: 8 });
    const { data: chessGames = [] } = useListChessGamesQuery(undefined, { pollingInterval: 5000 });
    const [createGame, { isLoading: isCreating }] = useCreateChessGameMutation();
    const [createAiGame, { isLoading: isCreatingAi }] = useCreateChessAiGameMutation();
    const [aiLevel, setAiLevel] = useState<ChessAiLevel>("MEDIUM");
    const [aiColor, setAiColor] = useState<ChessColor>("RANDOM");
    const [acceptGame, { isLoading: isAccepting }] = useAcceptChessGameMutation();
    const [declineGame, { isLoading: isDeclining }] = useDeclineChessGameMutation();
    const gameId = requestedGameId;
    const { data: game } = useGetChessGameQuery(gameId ?? "", { skip: !gameId });
    const friends = friendsData?.items ?? [];
    const pendingGames = chessGames.filter((chessGame) => chessGame.status === "PENDING");
    const activeGames = chessGames.filter((chessGame) => chessGame.status === "ACTIVE");
    const finishedGames = chessGames.filter((chessGame) => chessGame.status === "FINISHED");

    const [positions, setPositions] = useState<Position[]>([]);
    const [selected, setSelected] = useState<Piece | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [turn, setTurn] = useState<"WHITE" | "BLACK">("WHITE");
    const [gameStatus, setGameStatus] = useState<ChessGameStatus>("PENDING");
    const [endReason, setEndReason] = useState<ChessGame["endReason"]>(null);
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [promotion, setPromotion] = useState<{ from: string; to: string; color: "white" | "black" } | null>(null);

    const [board, setBoard] = useState<(Piece | null)[][]>([
        [
            makePiece("rook", "black"),
            makePiece("pawn", "white"),
            makePiece("bishop", "black"),
            makePiece("queen", "black"),
            makePiece("king", "black"),
            makePiece("bishop", "black"),
            makePiece("knight", "black"),
            makePiece("rook", "black"),
        ],
        [
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
            makePiece("pawn", "black"),
        ],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
            makePiece("pawn", "white"),
        ],
        [
            makePiece("rook", "white"),
            makePiece("knight", "white"),
            makePiece("bishop", "white"),
            makePiece("queen", "white"),
            makePiece("king", "white"),
            makePiece("bishop", "white"),
            makePiece("knight", "white"),
            makePiece("rook", "white"),
        ],
    ]);

    // Recopie l'état de la partie chargée dès que sa position change (ajustement pendant le rendu, plutôt que dans un effet).
    const [syncedFen, setSyncedFen] = useState<string | undefined>(undefined);
    if (game && game.fen !== syncedFen) {
        setSyncedFen(game.fen);
        if (game.fen) setBoard(boardFromFen(game.fen));
        setTurn(game.turn);
        setGameStatus(game.status);
        setEndReason(game.endReason);
        setWinnerId(game.winnerId);
        setSelected(null);
        setSelectedPosition(null);
        setPositions([]);
        setPromotion(null);
    }

    useEffect(() => {
        if (!accessToken || !gameId || gameStatus !== "ACTIVE") {
            disconnectChess();
            return;
        }

        const socket = connectChess(accessToken);
        const onState = (nextGame: ChessGame) => {
            if (nextGame.id !== gameId) return;
            setBoard(boardFromFen(nextGame.fen));
            setTurn(nextGame.turn);
            setGameStatus(nextGame.status);
            setEndReason(nextGame.endReason);
            setWinnerId(nextGame.winnerId);
            setSelected(null);
            setSelectedPosition(null);
            setPositions([]);
            setPromotion(null);
        };
        const onError = (payload: { message?: string }) => {
            toast.add({ title: translateErrorCode((payload as { code?: string }).code) ?? t("chess.page.moveFailed"), type: "error" });
            setSelected(null);
            setSelectedPosition(null);
            setPositions([]);
        };

        socket.on("chess:state", onState);
        socket.on("chess:error", onError);
        return () => {
            socket.off("chess:state", onState);
            socket.off("chess:error", onError);
            disconnectChess();
        };
    }, [accessToken, gameStatus, gameId, t]);

    function isSelected(rowIndex: number, colIndex: number): boolean {
        const result = positions.some(
            position => position.x === colIndex && position.y === rowIndex
        );

        return result;
    }

    function selectPiece(rowIndex: number, colIndex: number): void {
        if (!game || gameStatus !== "ACTIVE" || !me || !accessToken || !gameId || turn !== playerColor)
            return;
        const currentPiece = board[rowIndex][colIndex];
        if (isSelected(rowIndex, colIndex) && selectedPosition && selected) {
            const from = toSquare(selectedPosition.y, selectedPosition.x);
            const to = toSquare(rowIndex, colIndex);
            if (selected.type === "pawn" && (rowIndex === 0 || rowIndex === 7)) {
                setPromotion({ from, to, color: selected.color });
                return;
            }
            connectChess(accessToken).emit("chess:move", { gameId, from, to });
            setSelected(null);
            setSelectedPosition(null);
            setPositions([]);
            return;
        }

        if (currentPiece?.color !== playerColor.toLowerCase()) {
            setSelected(null);
            setSelectedPosition(null);
            setPositions([]);
            return;
        }

        const available = canMoove(currentPiece, board, fromSquare(game.fen.split(" ")[3]));
        setSelected(currentPiece);
        setSelectedPosition({ y: rowIndex, x: colIndex });
        setPositions(available);
        setBoard((currentBoard) => currentBoard.map((row) =>
            row.map((cell) => cell ? { ...cell, isSelected: cell === currentPiece } : null)
        ));
    }

    function choosePromotion(piece: "q" | "r" | "b" | "n") {
        if (!promotion || !accessToken || !gameId) return;
        connectChess(accessToken).emit("chess:move", { gameId, from: promotion.from, to: promotion.to, promotion: piece });
        setPromotion(null);
        setSelected(null);
        setSelectedPosition(null);
        setPositions([]);
    }

    function toSquare(row: number, col: number): string {
        return `${String.fromCharCode(97 + col)}${8 - row}`;
    }

    function fromSquare(square: string | undefined): Position | undefined {
        if (!square || square === "-") return undefined;
        const file = square.charCodeAt(0) - 97;
        const rank = Number(square[1]);
        if (file < 0 || file > 7 || rank < 1 || rank > 8) return undefined;
        return { x: file, y: 8 - rank };
    }

    const playerColor = me && game
        ? game.whitePlayerId === me.id ? "WHITE" : "BLACK"
        : "WHITE";
    const opponentColor = playerColor === "WHITE" ? "BLACK" : "WHITE";
    const myPlayer = playerColor === "WHITE" ? game?.whitePlayer : game?.blackPlayer;
    const opponentPlayer = playerColor === "WHITE" ? game?.blackPlayer : game?.whitePlayer;
    const boardVisible = Boolean(game && (gameStatus === "ACTIVE" || gameStatus === "FINISHED"));
    const endMessage = endReason === "CHECKMATE"
        ? t(winnerId === me?.id ? "chess.page.end.mateWin" : "chess.page.end.mateLoss")
        : endReason === "STALEMATE"
            ? t("chess.page.end.stalemate")
            : endReason === "THREEFOLD_REPETITION"
                ? t("chess.page.end.repetition")
                : endReason === "INSUFFICIENT_MATERIAL"
                    ? t("chess.page.end.insufficient")
                    : t("chess.page.end.finished");

    function getHistoryResult(chessGame: ChessGame): "draw" | "win" | "aborted" | "loss" {
        if (chessGame.result === "DRAW") return "draw";
        if (chessGame.winnerId === me?.id) return "win";
        if (chessGame.result === "ABORTED") return "aborted";
        return "loss";
    }

    function getHistoryReason(chessGame: ChessGame): string {
        return t(`chess.page.reason.${chessGame.endReason ?? "FINISHED"}`);
    }

    /** L'autre joueur d'une partie (nom d'affichage), « ? » s'il est inconnu. */
    function opponentName(chessGame: ChessGame): string {
        const other = chessGame.whitePlayerId === me?.id ? chessGame.blackPlayer : chessGame.whitePlayer;
        return other?.displayname ?? "?";
    }

    async function handleCreateGame(opponentId: string) {
        try {
            await createGame({ opponentId, color: "RANDOM" }).unwrap();
            toast.add({ title: t("chess.page.inviteSent"), type: "success" });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, t("chess.page.createFailed")), type: "error" });
        }
    }

    async function handleCreateAiGame() {
        try {
            const created = await createAiGame({ level: aiLevel, color: aiColor }).unwrap();
            setSearchParams({ gameId: created.id });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, t("chess.page.createFailed")), type: "error" });
        }
    }

    async function handleAcceptGame(targetGameId: string) {
        try {
            await acceptGame(targetGameId).unwrap();
            setSearchParams({ gameId: targetGameId });
            toast.add({ title: t("chess.page.accepted"), type: "success" });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, t("chess.page.acceptFailed")), type: "error" });
        }
    }

    async function handleDeclineGame(targetGameId: string) {
        try {
            await declineGame(targetGameId).unwrap();
            toast.add({ title: t("chess.page.declined"), type: "info" });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, t("chess.page.declineFailed")), type: "error" });
        }
    }

    return (
        <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-10">
            {!boardVisible ? (
                <>
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{t("chess.page.title")}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">{t("chess.page.subtitle")}</p>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-primary">● {t("chess.page.live")}</span>
                    </header>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("chess.page.ai.title")}</h2>
                        <div className="flex flex-col gap-3 border border-border p-3">
                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("chess.page.ai.level")}>
                                {AI_LEVELS.map((level) => (
                                    <Button key={level} type="button" size="sm" role="radio" aria-checked={aiLevel === level} variant={aiLevel === level ? "default" : "outline"} onClick={() => setAiLevel(level)}>
                                        {t(`chess.page.ai.levels.${level}`)}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("chess.page.ai.color")}>
                                {AI_COLORS.map((color) => (
                                    <Button key={color} type="button" size="sm" role="radio" aria-checked={aiColor === color} variant={aiColor === color ? "default" : "outline"} onClick={() => setAiColor(color)}>
                                        {t(`chess.page.ai.colors.${color}`)}
                                    </Button>
                                ))}
                            </div>
                            <Button type="button" disabled={isCreatingAi} onClick={() => void handleCreateAiGame()}>
                                {isCreatingAi ? t("chess.page.ai.starting") : t("chess.page.ai.play")}
                            </Button>
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("chess.page.friendsTitle")}</h2>
                        {friendsLoading ? (
                            <p className="border border-border p-4 text-sm text-muted-foreground">{t("chess.page.friendsLoading")}</p>
                        ) : friends.length === 0 ? (
                            <p className="border border-border p-4 text-sm text-muted-foreground">{t("chess.page.noFriends")}</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {friends.map((friend) => (
                                    <li key={friend.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar className="size-9 rounded-lg">
                                                <AvatarImage src={resolveAvatarUrl(friend.avatarUrl)} alt={friend.displayname} className="rounded-lg" />
                                                <AvatarFallback className="rounded-lg text-xs">{getInitials(friend.displayname)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{friend.displayname}</p>
                                                <p className="text-xs text-muted-foreground">{friend.isOnline ? t("chess.page.online") : t("chess.page.offline")}</p>
                                            </div>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" disabled={isCreating} onClick={() => void handleCreateGame(friend.id)}>
                                            {isCreating ? t("chess.page.sending") : t("chess.page.challenge")}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Pagination page={friendsData?.page ?? friendsPage} totalPages={friendsData?.totalPages ?? 1} onPageChange={setFriendsPage} />
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("chess.page.challengesTitle")}</h2>
                        {pendingGames.length === 0 && activeGames.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("chess.page.noChallenges")}</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {pendingGames.map((pendingGame) => (
                                    <li key={pendingGame.id} className="flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {pendingGame.challengerId === me?.id ? t("chess.page.challengeSent") : t("chess.page.challengeReceived")}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{t("chess.page.versus", { name: opponentName(pendingGame) })}</p>
                                        </div>
                                        {pendingGame.challengerId !== me?.id ? (
                                            <div className="flex gap-2">
                                                <Button type="button" size="sm" onClick={() => void handleAcceptGame(pendingGame.id)} disabled={isAccepting || isDeclining}>
                                                    {t("chess.page.accept")}
                                                </Button>
                                                <Button type="button" size="sm" variant="destructive" onClick={() => void handleDeclineGame(pendingGame.id)} disabled={isAccepting || isDeclining}>
                                                    {t("chess.page.decline")}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                                {activeGames.map((activeGame) => (
                                    <li key={activeGame.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">{t("chess.page.inProgress")}</p>
                                            <p className="text-xs text-muted-foreground">{t("chess.page.versus", { name: opponentName(activeGame) })}</p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => setSearchParams({ gameId: activeGame.id })}>{t("chess.page.resume")}</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("chess.page.historyTitle")}</h2>
                        {finishedGames.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("chess.page.noHistory")}</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {finishedGames.map((finishedGame) => {
                                    const opponent = finishedGame.whitePlayerId === me?.id
                                        ? finishedGame.blackPlayer
                                        : finishedGame.whitePlayer;
                                    const result = getHistoryResult(finishedGame);
                                    const resultClass = result === "win"
                                        ? "text-primary"
                                        : result === "loss"
                                            ? "text-destructive"
                                            : "text-muted-foreground";

                                    return (
                                        <li key={finishedGame.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                                            <div className="min-w-0">
                                                <p className={`text-xs font-bold uppercase tracking-wider ${resultClass}`}>{t(`chess.page.result.${result}`)}</p>
                                                <p className="truncate text-sm font-medium">{t("chess.page.versus", { name: opponent?.displayname ?? opponentName(finishedGame) })}</p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {getHistoryReason(finishedGame)} · {new Date(finishedGame.endedAt ?? finishedGame.updatedAt).toLocaleDateString(i18n.language)}
                                                </p>
                                            </div>
                                            <span className="font-mono text-xs text-muted-foreground">{finishedGame.id}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </>
            ) : null}
            {boardVisible ? (
                <>
                    <ChessPlayerBar
                        player={opponentPlayer}
                        color={opponentColor}
                        isMe={false}
                        toMove={turn === opponentColor}
                        finished={gameStatus === "FINISHED"}
                    />
                    {gameStatus === "FINISHED" ? (
                        <div className="border border-primary/40 bg-primary/10 px-3 py-3 text-center text-sm font-medium">
                            {endMessage}
                        </div>
                    ) : null}
                    <ChessBoard3D
                        board={board}
                        positions={positions}
                        selectedPosition={selectedPosition}
                        onSquareClick={selectPiece}
                        flipped={playerColor === "BLACK"}
                    />
                    <ChessPlayerBar
                        player={myPlayer}
                        color={playerColor}
                        isMe
                        toMove={turn === playerColor}
                        finished={gameStatus === "FINISHED"}
                    />
                    {promotion ? (
                        <div className="flex items-center justify-center gap-2 border border-border p-3" role="dialog" aria-label={t("chess.page.promotionLabel")}>
                            {(["q", "r", "b", "n"] as const).map((piece) => (
                                <button key={piece} type="button" className="size-14 border border-border p-2 hover:bg-muted" onClick={() => choosePromotion(piece)}>
                                    <img src={`/chess/${promotion.color === "white" ? "w" : "b"}${piece === "n" ? "N" : piece.toUpperCase()}.svg`} alt={t(`chess.page.pieces.${piece}`)} className="h-full w-full" />
                                </button>
                            ))}
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
};


//TODO: add to table page, choice IA/user