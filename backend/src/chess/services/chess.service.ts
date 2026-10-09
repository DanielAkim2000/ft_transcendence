import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGameDto } from '../dto/create-game.dto';
import { Chess } from 'chess.js';
import { ChatService } from '../../chat/services/chat.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

@Injectable()
export class ChessService {
    private readonly logger = new Logger(ChessService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly chatService: ChatService,
        private readonly notificationsService: NotificationsService,
    ) { }

    /** Nom d'affichage d'un joueur (pour les notifications), « ? » s'il est introuvable. */
    private async displayName(userId: string): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { displayname: true },
        });
        return user?.displayname ?? '?';
    }

    async listGames(userId: string) {
        return this.prisma.chessGame.findMany({
            where: {
                OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
                status: { in: ['PENDING', 'ACTIVE', 'FINISHED'] },
            },
            include: {
                whitePlayer: {
                    select: { id: true, displayname: true, avatarUrl: true },
                },
                blackPlayer: {
                    select: { id: true, displayname: true, avatarUrl: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async getGame(userId: string, gameId: string) {
        const game = await this.prisma.chessGame.findUnique({
            where: { id: gameId },
            include: {
                whitePlayer: { select: { id: true, displayname: true, avatarUrl: true } },
                blackPlayer: { select: { id: true, displayname: true, avatarUrl: true } },
            },
        });
        if (!game)
            throw new NotFoundException({
                message: 'Game not found',
                code: 'GAME_NOT_FOUND',
            });

        if (userId !== game.whitePlayerId && userId !== game.blackPlayerId) {
            throw new ForbiddenException({
                message: 'You are not a player of this game',
                code: 'NOT_YOUR_GAME',
            });
        }

        return game;
    }

    async playMove(
        userId: string,
        gameId: string,
        from: string,
        to: string,
        promotion = 'q',
    ) {
        const game = await this.getGame(userId, gameId);
        if (game.status !== 'ACTIVE') {
            throw new ConflictException({
                message: 'The game is not active',
                code: 'GAME_NOT_ACTIVE',
            });
        }

        const playerColor = userId === game.whitePlayerId ? 'WHITE' : 'BLACK';
        if (game.turn !== playerColor) {
            throw new ConflictException({
                message: "It's not your turn",
                code: 'NOT_YOUR_TURN',
            });
        }

        const chess = new Chess(game.fen);
        let move: ReturnType<Chess['move']>;
        try {
            move = chess.move({ from, to, promotion });
        } catch {
            throw new BadRequestException({
                message: 'Illegal move',
                code: 'ILLEGAL_MOVE',
            });
        }

        const fen = chess.fen();
        const positionKey = fen.split(' ').slice(0, 4).join(' ');
        const positionHistory = [...game.positionHistory, positionKey];
        const nextTurn = chess.turn() === 'w' ? 'WHITE' : 'BLACK';
        const isCheckmate = chess.isCheckmate();
        const isStalemate = chess.isStalemate();
        const isThreefoldRepetition =
            positionHistory.filter((position) => position === positionKey).length >=
            3;
        const isInsufficientMaterial = chess.isInsufficientMaterial();
        const isFinished =
            isCheckmate ||
            isStalemate ||
            isThreefoldRepetition ||
            isInsufficientMaterial;
        const result = isCheckmate
            ? playerColor === 'WHITE'
                ? 'WHITE_WIN'
                : 'BLACK_WIN'
            : isFinished
                ? 'DRAW'
                : null;
        const endReason = isCheckmate
            ? 'CHECKMATE'
            : isStalemate
                ? 'STALEMATE'
                : isThreefoldRepetition
                    ? 'THREEFOLD_REPETITION'
                    : isInsufficientMaterial
                        ? 'INSUFFICIENT_MATERIAL'
                        : null;
        const [updated] = await this.prisma.$transaction([
            this.prisma.chessGame.update({
                where: { id: gameId },
                data: {
                    fen,
                    status: isFinished ? 'FINISHED' : 'ACTIVE',
                    turn: nextTurn,
                    moveCount: { increment: 1 },
                    lastMoveAt: new Date(),
                    result,
                    endReason,
                    winnerId: isCheckmate ? userId : null,
                    endedAt: isFinished ? new Date() : null,
                    positionHistory,
                },
            }),
            this.prisma.chessMove.create({
                data: {
                    gameId,
                    ply: game.moveCount + 1,
                    color: playerColor,
                    playerId: userId,
                    san: move.san,
                    from,
                    to,
                    promotion: promotion === 'q' ? null : promotion,
                    fenAfter: fen,
                },
            }),
        ]);

        return updated;
    }

    // --- Envoyer un défi ---
    async createGame(userId: string, dto: CreateGameDto) {
        const { opponentId } = dto;

        if (opponentId === userId) {
            throw new BadRequestException({
                message: 'You cannot challenge yourself',
                code: 'CANNOT_CHALLENGE_SELF',
            });
        }

        const opponent = await this.prisma.user.findUnique({
            where: { id: opponentId },
            select: { id: true },
        });
        if (!opponent)
            throw new NotFoundException({
                message: 'Opponent not found',
                code: 'OPPONENT_NOT_FOUND',
            });

        const blocked = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: userId, blockedId: opponentId },
                    { blockerId: opponentId, blockedId: userId },
                ],
            },
        });
        if (blocked)
            throw new ForbiddenException({
                message: 'You cannot challenge this player',
                code: 'CANNOT_CHALLENGE_PLAYER',
            });

        const existing = await this.prisma.chessGame.findFirst({
            where: {
                status: { in: ['PENDING', 'ACTIVE'] },
                OR: [
                    { whitePlayerId: userId, blackPlayerId: opponentId },
                    { whitePlayerId: opponentId, blackPlayerId: userId },
                ],
            },
        });
        if (existing)
            throw new ConflictException({
                message: 'A game already exists with this player',
                code: 'CHESS_GAME_ALREADY_EXISTS',
            });

        const color = dto.color ?? 'RANDOM';
        const iAmWhite =
            color === 'WHITE' || (color === 'RANDOM' && Math.random() < 0.5);

        const game = await this.prisma.chessGame.create({
            data: {
                challengerId: userId,
                whitePlayerId: iAmWhite ? userId : opponentId,
                blackPlayerId: iAmWhite ? opponentId : userId,
                timeControlMs: dto.timeControlMs ?? null,
                incrementMs: dto.incrementMs ?? 0,
                rated: dto.rated ?? true,
            },
        });

        // L'invitation apparaît dans le chat (entre amis) et dans les notifications de l'adversaire ; aucun des deux ne doit faire échouer la création.
        try {
            await this.chatService.postChessInvite(userId, opponentId, game.id);
        } catch (error) {
            this.logger.error(
                `Chess invite message failed for game ${game.id}: ${String(error)}`,
            );
        }
        await this.notificationsService.create(
            opponentId,
            NotificationType.CHESS_INVITE,
            {
                gameId: game.id,
                fromName: await this.displayName(userId),
            },
        );
        return game;
    }

    async acceptGame(userId: string, gameId: string) {
        const game = await this.prisma.chessGame.findUnique({
            where: { id: gameId },
        });
        if (!game)
            throw new NotFoundException({
                message: 'Game not found',
                code: 'GAME_NOT_FOUND',
            });

        const isPlayer =
            userId === game.whitePlayerId || userId === game.blackPlayerId;
        if (!isPlayer || userId === game.challengerId) {
            throw new ForbiddenException({
                message: 'Only the opponent can accept',
                code: 'ONLY_OPPONENT_ACCEPTS',
            });
        }
        if (game.status !== 'PENDING') {
            throw new ConflictException({
                message: 'This challenge is no longer pending',
                code: 'CHALLENGE_NOT_PENDING',
            });
        }

        const now = new Date();
        const [updated] = await this.prisma.$transaction([
            this.prisma.chessGame.update({
                where: { id: gameId },
                data: {
                    status: 'ACTIVE',
                    startedAt: now,
                    lastMoveAt: now,
                    whiteTimeMs: game.timeControlMs,
                    blackTimeMs: game.timeControlMs,
                    positionHistory: [game.fen.split(' ').slice(0, 4).join(' ')],
                },
            }),
            this.prisma.chessProfile.upsert({
                where: { userId: game.whitePlayerId },
                create: { userId: game.whitePlayerId },
                update: {},
            }),
            this.prisma.chessProfile.upsert({
                where: { userId: game.blackPlayerId },
                create: { userId: game.blackPlayerId },
                update: {},
            }),
        ]);
        await this.notificationsService.create(
            game.challengerId,
            NotificationType.CHESS_INVITE_ACCEPTED,
            {
                gameId,
                opponentName: await this.displayName(userId),
            },
        );
        return updated;
    }

    // --- Refuser ---
    async declineGame(userId: string, gameId: string) {
        const game = await this.prisma.chessGame.findUnique({
            where: { id: gameId },
        });
        if (!game)
            throw new NotFoundException({
                message: 'Game not found',
                code: 'GAME_NOT_FOUND',
            });
        if (
            (userId !== game.whitePlayerId && userId !== game.blackPlayerId) ||
            userId === game.challengerId
        ) {
            throw new ForbiddenException({
                message: 'Only the opponent can decline',
                code: 'ONLY_OPPONENT_DECLINES',
            });
        }
        if (game.status !== 'PENDING')
            throw new ConflictException({
                message: 'This challenge is no longer pending',
                code: 'CHALLENGE_NOT_PENDING',
            });

        const declined = await this.prisma.chessGame.update({
            where: { id: gameId },
            data: { status: 'DECLINED' },
        });
        await this.notificationsService.create(
            game.challengerId,
            NotificationType.CHESS_INVITE_DECLINED,
            {
                gameId,
                opponentName: await this.displayName(userId),
            },
        );
        return declined;
    }
}
