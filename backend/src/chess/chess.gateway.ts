import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { UsersService } from '../users/services/users.services';
import { ChessService } from './services/chess.service';

type ChessSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

type ChessMovePayload = {
  gameId?: string;
  from?: string;
  to?: string;
  promotion?: string;
};

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL },
  namespace: 'chess',
})
export class ChessGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChessGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly chessService: ChessService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: ChessSocket): Promise<void> {
    const accessToken = (client.handshake.auth as { access_token?: unknown })
      .access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      client.disconnect(true);
      return;
    }

    try {
      const decoded = await this.jwtService.verifyAsync<{ userId: string }>(
        accessToken,
      );
      const user = await this.usersService.findUserById(decoded.userId);
      if (!user) {
        client.disconnect(true);
        return;
      }
      client.data.userId = user.id;
      await client.join(user.id);
    } catch (error) {
      this.logger.error(`Error verifying token: ${error}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('chess:move')
  async handleMove(
    @ConnectedSocket() client: ChessSocket,
    @MessageBody() payload: ChessMovePayload,
  ): Promise<void> {
    const userId = client.data.userId;
    if (!userId || !payload?.gameId || !payload.from || !payload.to) return;

    try {
      const game = await this.chessService.playMove(
        userId,
        payload.gameId,
        payload.from,
        payload.to,
        payload.promotion,
      );
      this.server
        .to([game.whitePlayerId, game.blackPlayerId])
        .emit('chess:state', game);

      // Contre l'IA : elle répond dès que le coup du joueur est enregistré.
      if (game.status === 'ACTIVE') {
        const reply = await this.chessService.playBotTurn(game.id);
        if (reply)
          this.server
            .to([reply.whitePlayerId, reply.blackPlayerId])
            .emit('chess:state', reply);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Illegal move';
      // Code stable : le client traduit le message dans la langue de l'utilisateur.
      const response =
        error instanceof HttpException ? error.getResponse() : null;
      const code =
        typeof response === 'object' && response !== null && 'code' in response
          ? String(response.code)
          : 'ILLEGAL_MOVE';
      client.emit('chess:error', { message, code });
    }
  }
}
