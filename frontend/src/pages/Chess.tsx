import { useSearchParams } from "react-router";
import { boardFromFen, makePiece, type PieceType, type Piece, type Position, canMoove } from "@/features/chess/utils";
import {
    useAcceptChessGameMutation,
    useCreateChessGameMutation,
    useDeclineChessGameMutation,
    useGetChessGameQuery,
    useListChessGamesQuery,
} from "@/features/chess/chessApi";
import { useListFriendsQuery } from "@/features/users/usersApi";
import { useMeQuery } from "@/features/auth/authApi";
import { selectAccessToken } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";
import { connectChess, disconnectChess } from "@/features/chess/chessSocket";
import type { ChessGame, ChessGameStatus } from "@/features/chess/chessApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { toast } from "@/components/ui/toast";
import { useEffect, useState } from "react";

export const Chess = () => {
    const [searchParams] = useSearchParams();
    const [, setSearchParams] = useSearchParams();
    const requestedGameId = searchParams.get("gameId");
    const [friendsPage, setFriendsPage] = useState(1);
    const { data: me } = useMeQuery();
    const accessToken = useAppSelector(selectAccessToken);
    const { data: friendsData, isLoading: friendsLoading } = useListFriendsQuery({ page: friendsPage, limit: 8 });
    const { data: chessGames = [] } = useListChessGamesQuery(undefined, { pollingInterval: 5000 });
    const [createGame, { isLoading: isCreating }] = useCreateChessGameMutation();
    const [acceptGame, { isLoading: isAccepting }] = useAcceptChessGameMutation();
    const [declineGame, { isLoading: isDeclining }] = useDeclineChessGameMutation();
    const gameId = requestedGameId;
    const { data: game } = useGetChessGameQuery(gameId ?? "", { skip: !gameId });
    const friends = friendsData?.items ?? [];
    const pendingGames = chessGames.filter((chessGame) => chessGame.status === "PENDING");
    const activeGames = chessGames.filter((chessGame) => chessGame.status === "ACTIVE");
    const finishedGames = chessGames.filter((chessGame) => chessGame.status === "FINISHED");

    const PIECE_LETTER: Record<PieceType, string> = {
        pawn: "P",
        rook: "R",
        knight: "N",
        bishop: "B",
        queen: "Q",
        king: "K",
    };

    function getPieceImage(piece: Piece) {
        const colorLetter = piece.color === "black" ? "b" : "w";
        return `/chess/${colorLetter}${PIECE_LETTER[piece.type]}.svg`;
    }


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

    useEffect(() => {
        if (!game) return;
        if (game.fen) setBoard(boardFromFen(game.fen));
        setTurn(game.turn);
        setGameStatus(game.status);
        setEndReason(game.endReason);
        setWinnerId(game.winnerId);
        setSelected(null);
        setSelectedPosition(null);
        setPositions([]);
        setPromotion(null);
    }, [game?.fen]);

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
            toast.add({ title: payload.message ?? "Coup impossible", type: "error" });
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
    }, [accessToken, gameStatus, gameId]);

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
    const playerColorLabel = playerColor === "WHITE" ? "blanc" : "noir";
    const turnLabel = turn === "WHITE" ? "blancs" : "noirs";
    const boardVisible = Boolean(game && (gameStatus === "ACTIVE" || gameStatus === "FINISHED"));
    const endMessage = endReason === "CHECKMATE"
        ? winnerId === me?.id ? "Échec et mat : tu as gagné." : "Échec et mat : tu as perdu."
        : endReason === "STALEMATE"
            ? "Partie nulle : pat."
            : endReason === "THREEFOLD_REPETITION"
                ? "Partie nulle : répétition de position."
                : endReason === "INSUFFICIENT_MATERIAL"
                    ? "Partie nulle : matériel insuffisant."
                    : "Partie terminée.";

    function getHistoryResult(chessGame: ChessGame): string {
        if (chessGame.result === "DRAW") return "Nulle";
        if (chessGame.winnerId === me?.id) return "Victoire";
        if (chessGame.result === "ABORTED") return "Abandonnée";
        return "Défaite";
    }

    function getHistoryReason(chessGame: ChessGame): string {
        switch (chessGame.endReason) {
            case "CHECKMATE": return "Échec et mat";
            case "RESIGNATION": return "Abandon";
            case "TIMEOUT": return "Temps écoulé";
            case "STALEMATE": return "Pat";
            case "AGREEMENT": return "Accord mutuel";
            case "INSUFFICIENT_MATERIAL": return "Matériel insuffisant";
            case "THREEFOLD_REPETITION": return "Répétition";
            case "FIFTY_MOVE_RULE": return "Règle des 50 coups";
            case "ABANDONED": return "Abandonnée";
            case "ABORTED": return "Interrompue";
            default: return "Partie terminée";
        }
    }

    /*
     * The board is server-authoritative: a move is only rendered after the
     * websocket sends back the updated FEN.
     */
    function renderBoard() {
        return board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0;
                return (
                    <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`flex items-center justify-center aspect-square cursor-pointer ${isSelected(rowIndex, colIndex)
                            ? "bg-primary"
                            : cell?.isSelected
                                ? "bg-muted-foreground"
                                : isLight
                                    ? "bg-chart-5"
                                    : "bg-muted"
                            }`}
                        onClick={() => selectPiece(rowIndex, colIndex)}
                    >
                        {cell && (
                            <img
                                src={getPieceImage(cell)}
                                alt=""
                                className="w-4/5 h-4/5 select-none pointer-events-none"
                            />
                        )}
                    </div>
                );
            })
        );
    }

    async function handleCreateGame(opponentId: string) {
        try {
            const game = await createGame({ opponentId, color: "RANDOM" }).unwrap();
            toast.add({ title: `Défi chess envoyé (${game.id})`, type: "success" });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, "Impossible de créer la partie"), type: "error" });
        }
    }

    async function handleAcceptGame(targetGameId: string) {
        try {
            await acceptGame(targetGameId).unwrap();
            setSearchParams({ gameId: targetGameId });
            toast.add({ title: "Partie chess acceptée", type: "success" });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, "Impossible d'accepter la partie"), type: "error" });
        }
    }

    async function handleDeclineGame(targetGameId: string) {
        try {
            await declineGame(targetGameId).unwrap();
            toast.add({ title: "Défi chess refusé", type: "info" });
        } catch (error) {
            toast.add({ title: getErrorMessage(error, "Impossible de refuser la partie"), type: "error" });
        }
    }

    return (
        <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-10">
            {!boardVisible ? (
                <>
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Chess</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Défie un ami et prends ta place sur l’échiquier.</p>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-primary">● En ligne</span>
                    </header>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mes amis</h2>
                        {friendsLoading ? (
                            <p className="border border-border p-4 text-sm text-muted-foreground">Chargement des amis...</p>
                        ) : friends.length === 0 ? (
                            <p className="border border-border p-4 text-sm text-muted-foreground">Tu n’as pas encore d’ami à défier.</p>
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
                                                <p className="text-xs text-muted-foreground">{friend.isOnline ? "En ligne" : "Hors ligne"}</p>
                                            </div>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" disabled={isCreating} onClick={() => void handleCreateGame(friend.id)}>
                                            {isCreating ? "Envoi..." : "Défier"}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Pagination page={friendsData?.page ?? friendsPage} totalPages={friendsData?.totalPages ?? 1} onPageChange={setFriendsPage} />
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Défis chess</h2>
                        {pendingGames.length === 0 && activeGames.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucun défi en attente.</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {pendingGames.map((pendingGame) => (
                                    <li key={pendingGame.id} className="flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {pendingGame.challengerId === me?.id ? "Défi envoyé" : "Défi reçu"}
                                            </p>
                                            <p className="font-mono text-xs text-muted-foreground">{pendingGame.id}</p>
                                        </div>
                                        {pendingGame.challengerId !== me?.id ? (
                                            <div className="flex gap-2">
                                                <Button type="button" size="sm" onClick={() => void handleAcceptGame(pendingGame.id)} disabled={isAccepting || isDeclining}>
                                                    Accepter
                                                </Button>
                                                <Button type="button" size="sm" variant="destructive" onClick={() => void handleDeclineGame(pendingGame.id)} disabled={isAccepting || isDeclining}>
                                                    Refuser
                                                </Button>
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                                {activeGames.map((activeGame) => (
                                    <li key={activeGame.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">Partie en cours</p>
                                            <p className="font-mono text-xs text-muted-foreground">{activeGame.id}</p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => setSearchParams({ gameId: activeGame.id })}>Reprendre</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Historique</h2>
                        {finishedGames.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucune partie terminée.</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {finishedGames.map((finishedGame) => {
                                    const opponent = finishedGame.whitePlayerId === me?.id
                                        ? finishedGame.blackPlayer
                                        : finishedGame.whitePlayer;
                                    const result = getHistoryResult(finishedGame);
                                    const resultClass = result === "Victoire"
                                        ? "text-primary"
                                        : result === "Défaite"
                                            ? "text-destructive"
                                            : "text-muted-foreground";

                                    return (
                                        <li key={finishedGame.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                                            <div className="min-w-0">
                                                <p className={`text-xs font-bold uppercase tracking-wider ${resultClass}`}>{result}</p>
                                                <p className="truncate text-sm font-medium">contre {opponent?.displayname ?? (finishedGame.whitePlayerId === me?.id ? finishedGame.blackPlayerId : finishedGame.whitePlayerId)}</p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {getHistoryReason(finishedGame)} · {new Date(finishedGame.endedAt ?? finishedGame.updatedAt).toLocaleDateString()}
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
                    <div className="flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-2">
                        <p className="text-sm font-medium">Tu joues les {playerColorLabel}s</p>
                        <p className={`text-xs uppercase tracking-[0.16em] ${turn === playerColor ? "text-primary" : "text-muted-foreground"}`}>
                            Tour des {turnLabel}
                        </p>
                    </div>
                    {gameStatus === "FINISHED" ? (
                        <div className="border border-primary/40 bg-primary/10 px-3 py-3 text-center text-sm font-medium">
                            {endMessage}
                        </div>
                    ) : null}
                    <div className="grid grid-cols-8 aspect-square w-full border-neutral-800">
                        {renderBoard()}
                    </div>
                    {promotion ? (
                        <div className="flex items-center justify-center gap-2 border border-border p-3" role="dialog" aria-label="Choisir une pièce pour la promotion">
                            {(["q", "r", "b", "n"] as const).map((piece) => (
                                <button key={piece} type="button" className="size-14 border border-border p-2 hover:bg-muted" onClick={() => choosePromotion(piece)}>
                                    <img src={`/chess/${promotion.color === "white" ? "w" : "b"}${piece === "n" ? "N" : piece.toUpperCase()}.svg`} alt={piece === "q" ? "Dame" : piece === "r" ? "Tour" : piece === "b" ? "Fou" : "Cavalier"} className="h-full w-full" />
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