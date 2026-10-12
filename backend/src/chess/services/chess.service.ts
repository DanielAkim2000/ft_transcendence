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
import { join } from 'path';
import { Worker } from 'worker_threads';
import { AiLevel, AiMove } from '../ai/chess-ai';
import {
  PageQueryDto,
  pageOffset,
} from '../../common/pagination/page-query.dto';
import { Paginated, toPaginated } from '../../common/pagination/paginated';
import { CreateAiGameDto } from '../dto/create-ai-game.dto';
import { ChatService } from '../../chat/services/chat.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

const BOT_ID_PREFIX = 'chess-bot-';
export const BOT_EMAIL_DOMAIN = '@bot.local';
const BOT_NAMES: Record<AiLevel, string> = {
  EASY: 'IA Facile',
  MEDIUM: 'IA Moyen',
  HARD: 'IA Difficile',
  EXPERT: 'IA Expert',
};

@Injectable()
export class ChessService {
  private readonly logger = new Logger(ChessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
        status: { in: ['PENDING', 'ACTIVE'] },
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

  /** Historique paginé : les parties terminées de l'utilisateur, les plus récentes d'abord. */
  async listHistory(userId: string, page: PageQueryDto) {
    const where = {
      status: 'FINISHED' as const,
      OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
    };
    const player = { select: { id: true, displayname: true, avatarUrl: true } };
    const [games, total] = await this.prisma.$transaction([
      this.prisma.chessGame.findMany({
        where,
        include: { whitePlayer: player, blackPlayer: player },
        orderBy: { endedAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.chessGame.count({ where }),
    ]);
    return toPaginated(games, total, page);
  }

  async getGame(userId: string, gameId: string) {
    const game = await this.prisma.chessGame.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: {
          select: { id: true, displayname: true, avatarUrl: true },
        },
        blackPlayer: {
          select: { id: true, displayname: true, avatarUrl: true },
        },
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

  /** Abandon : la partie se termine tout de suite, victoire de l'adversaire. */
  async resign(userId: string, gameId: string) {
    const game = await this.getGame(userId, gameId);
    if (game.status !== 'ACTIVE') {
      throw new ConflictException({
        message: 'The game is not active',
        code: 'GAME_NOT_ACTIVE',
      });
    }
    const iAmWhite = userId === game.whitePlayerId;
    return this.prisma.chessGame.update({
      where: { id: gameId },
      data: {
        status: 'FINISHED',
        result: iAmWhite ? 'BLACK_WIN' : 'WHITE_WIN',
        endReason: 'RESIGNATION',
        winnerId: iAmWhite ? game.blackPlayerId : game.whitePlayerId,
        endedAt: new Date(),
      },
    });
  }

  /** Les adversaires IA sont de vrais comptes (clé étrangère des parties) créés à la demande. */
  private botId(level: AiLevel): string {
    return `${BOT_ID_PREFIX}${level.toLowerCase()}`;
  }

  isBot(userId: string): boolean {
    return userId.startsWith(BOT_ID_PREFIX);
  }

  private async ensureBot(level: AiLevel): Promise<string> {
    const id = this.botId(level);
    await this.prisma.user.upsert({
      where: { id },
      create: {
        id,
        email: `${id}${BOT_EMAIL_DOMAIN}`,
        displayname: BOT_NAMES[level],
      },
      update: {},
    });
    return id;
  }

  /** Calcule le coup de l'IA dans un thread à part (la recherche peut durer plusieurs secondes). */
  private computeAiMove(fen: string, level: AiLevel): Promise<AiMove | null> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(__dirname, '../ai/chess-ai.worker.js'), {
        workerData: { fen, level },
      });
      worker.once('message', (move: AiMove | null) => resolve(move));
      worker.once('error', reject);
      worker.once('exit', (code) => {
        if (code !== 0) reject(new Error(`AI worker exited with ${code}`));
      });
    });
  }

  /** Joue le coup de l'IA si c'est son tour dans cette partie ; renvoie la partie mise à jour, sinon null. */
  async playBotTurn(
    gameId: string,
  ): Promise<Awaited<ReturnType<ChessService['playMove']>> | null> {
    const game = await this.prisma.chessGame.findUnique({
      where: { id: gameId },
    });
    if (!game || game.status !== 'ACTIVE') return null;
    const botId =
      game.turn === 'WHITE' ? game.whitePlayerId : game.blackPlayerId;
    if (!this.isBot(botId)) return null;

    const level = botId.slice(BOT_ID_PREFIX.length).toUpperCase() as AiLevel;
    try {
      const move = await this.computeAiMove(game.fen, level);
      if (!move) return null;
      return await this.playMove(
        botId,
        gameId,
        move.from,
        move.to,
        move.promotion,
      );
    } catch (error) {
      this.logger.error(`AI move failed for game ${gameId}: ${String(error)}`);
      return null;
    }
  }

  // --- Partie contre l'IA : démarre tout de suite, sans invitation ---
  async createAiGame(userId: string, dto: CreateAiGameDto) {
    const botId = await this.ensureBot(dto.level);
    const color = dto.color ?? 'RANDOM';
    const iAmWhite =
      color === 'WHITE' || (color === 'RANDOM' && Math.random() < 0.5);
    const now = new Date();
    const game = await this.prisma.chessGame.create({
      data: {
        challengerId: userId,
        whitePlayerId: iAmWhite ? userId : botId,
        blackPlayerId: iAmWhite ? botId : userId,
        status: 'ACTIVE',
        rated: false,
        startedAt: now,
        lastMoveAt: now,
        positionHistory: [
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
        ],
      },
    });
    await this.prisma.chessProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    // L'IA a les blancs : elle ouvre avant que le joueur ne reçoive la partie.
    if (!iAmWhite) return (await this.playBotTurn(game.id)) ?? game;
    return game;
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

    if (this.isBot(opponentId))
      throw new BadRequestException({
        message: 'Use the AI endpoint to play against a bot',
        code: 'CANNOT_CHALLENGE_PLAYER',
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
