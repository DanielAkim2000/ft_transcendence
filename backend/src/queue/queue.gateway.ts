import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/services/users.services';
import { QueueGroupEntity } from './entities/queue-group.entity';

type QueueSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

/** [Major · Temps réel WebSockets] Passerelle WebSocket de la file d'attente des tables : namespace socket.io, authentification par access token et diffusion d'événements en temps réel. */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  namespace: 'queue',
})
export class QueueGateway implements OnGatewayConnection {
  private readonly logger = new Logger(QueueGateway.name);
  @WebSocketServer()
  private server!: Server;

  /** [Major · Temps réel WebSockets] Injecte les dépendances : UsersService, JwtService. */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** [Major · Temps réel WebSockets] Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est invalide. */
  async handleConnection(client: QueueSocket): Promise<void> {
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

  /** [Major · Temps réel WebSockets] Liste à jour pour tout le monde (page Tables/Queue). */
  emitQueueUpdate(tableId: string, groups: QueueGroupEntity[]) {
    this.server.emit('queue:update', { tableId, groups });
  }

  /** [Major · Temps réel WebSockets] Notification personnelle (c'est ton tour / tu as perdu ta place). */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(userId).emit(event, payload);
  }

  /** [Major · Temps réel WebSockets] Notification personnelle envoyée à plusieurs utilisateurs à la fois. */
  emitToUsers(userIds: string[], event: string, payload: unknown) {
    if (userIds.length === 0) return;
    this.server.to(userIds).emit(event, payload);
  }
}
