import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGameDto } from '../dto/create-game.dto';
import { Chess } from 'chess.js';

@Injectable()
export class ChessService {
    constructor(private readonly prisma: PrismaService) { }

    async listGames(userId: string) {
        return this.prisma.chessGame.findMany({
            where: {
                OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
                status: { in: ['PENDING', 'ACTIVE', 'FINISHED'] },
            },
            include: {
                whitePlayer: { select: { id: true, displayname: true, avatarUrl: true } },
                blackPlayer: { select: { id: true, displayname: true, avatarUrl: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async getGame(userId: string, gameId: string) {
        const game = await this.prisma.chessGame.findUnique({ where: { id: gameId } });
        if (!game) throw new NotFoundException('Partie introuvable');

        if (userId !== game.whitePlayerId && userId !== game.blackPlayerId) {
            throw new ForbiddenException('Cette partie ne vous appartient pas');
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
            throw new ConflictException('La partie n’est pas active');
        }

        const playerColor = userId === game.whitePlayerId ? 'WHITE' : 'BLACK';
        if (game.turn !== playerColor) {
            throw new ConflictException('Ce n’est pas votre tour');
        }

        const chess = new Chess(game.fen);
        let move: ReturnType<Chess['move']>;
        try {
            move = chess.move({ from, to, promotion });
        } catch {
            throw new BadRequestException('Coup illégal');
        }

        const fen = chess.fen();
        const positionKey = fen.split(' ').slice(0, 4).join(' ');
        const positionHistory = [...game.positionHistory, positionKey];
        const nextTurn = chess.turn() === 'w' ? 'WHITE' : 'BLACK';
        const isCheckmate = chess.isCheckmate();
        const isStalemate = chess.isStalemate();
        const isThreefoldRepetition = positionHistory.filter((position) => position === positionKey).length >= 3;
        const isInsufficientMaterial = chess.isInsufficientMaterial();
        const isFinished = isCheckmate || isStalemate || isThreefoldRepetition || isInsufficientMaterial;
        const result = isCheckmate
            ? playerColor === 'WHITE' ? 'WHITE_WIN' : 'BLACK_WIN'
            : isFinished ? 'DRAW' : null;
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
            throw new BadRequestException('Tu ne peux pas te défier toi-même');
        }

        const opponent = await this.prisma.user.findUnique({
            where: { id: opponentId },
            select: { id: true },
        });
        if (!opponent) throw new NotFoundException('Adversaire introuvable');

        const blocked = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: userId, blockedId: opponentId },
                    { blockerId: opponentId, blockedId: userId },
                ],
            },
        });
        if (blocked) throw new ForbiddenException('Impossible de défier ce joueur');

        const existing = await this.prisma.chessGame.findFirst({
            where: {
                status: { in: ['PENDING', 'ACTIVE'] },
                OR: [
                    { whitePlayerId: userId, blackPlayerId: opponentId },
                    { whitePlayerId: opponentId, blackPlayerId: userId },
                ],
            },
        });
        if (existing) throw new ConflictException('Une partie existe déjà avec ce joueur');

        const color = dto.color ?? 'RANDOM';
        const iAmWhite = color === 'WHITE' || (color === 'RANDOM' && Math.random() < 0.5);

        return this.prisma.chessGame.create({
            data: {
                challengerId: userId,
                whitePlayerId: iAmWhite ? userId : opponentId,
                blackPlayerId: iAmWhite ? opponentId : userId,
                timeControlMs: dto.timeControlMs ?? null,
                incrementMs: dto.incrementMs ?? 0,
                rated: dto.rated ?? true,
            },
        });
    }

    async acceptGame(userId: string, gameId: string) {
        const game = await this.prisma.chessGame.findUnique({ where: { id: gameId } });
        if (!game) throw new NotFoundException('Partie introuvable');

        const isPlayer = userId === game.whitePlayerId || userId === game.blackPlayerId;
        if (!isPlayer || userId === game.challengerId) {
            throw new ForbiddenException("Seul l'adversaire peut accepter");
        }
        if (game.status !== 'PENDING') {
            throw new ConflictException('Ce défi n’est plus en attente');
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
        return updated;
    }

    // --- Refuser ---
    async declineGame(userId: string, gameId: string) {
        const game = await this.prisma.chessGame.findUnique({ where: { id: gameId } });
        if (!game) throw new NotFoundException('Partie introuvable');
        if (
            (userId !== game.whitePlayerId && userId !== game.blackPlayerId) ||
            userId === game.challengerId
        ) {
            throw new ForbiddenException();
        }
        if (game.status !== 'PENDING') throw new ConflictException();

        return this.prisma.chessGame.update({
            where: { id: gameId },
            data: { status: 'DECLINED' },
        });
    }
}