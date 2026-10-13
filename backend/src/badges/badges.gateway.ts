import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/services/users.services';

type BadgesSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

/** [Major · Temps réel WebSockets] Passerelle WebSocket des badges, de l'XP et des niveaux : namespace socket.io, authentification par access token et diffusion d'événements en temps réel. */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  namespace: 'badges',
})
export class BadgesGateway implements OnGatewayConnection {
  private readonly logger = new Logger(BadgesGateway.name);
  @WebSocketServer()
  private server!: Server;

  /** [Major · Temps réel WebSockets] Injecte les dépendances : UsersService, JwtService. */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** [Major · Temps réel WebSockets] Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou invalide. */
  async handleConnection(client: BadgesSocket): Promise<void> {
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

  /** [Major · Temps réel WebSockets] Envoie un événement (ex. badges:earned) au seul utilisateur ciblé. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userId).emit(event, payload);
  }
}
