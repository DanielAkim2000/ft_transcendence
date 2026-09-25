import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/services/users.services';

type TournamentsSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  namespace: 'tournaments',
})
export class TournamentsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TournamentsGateway.name);
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: TournamentsSocket): Promise<void> {
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

  /** Diffuse à tout le monde (liste des tournois, page publique). */
  broadcast(event: string, payload: unknown): void {
    this.server.emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userId).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    this.server.to(userIds).emit(event, payload);
  }
}
