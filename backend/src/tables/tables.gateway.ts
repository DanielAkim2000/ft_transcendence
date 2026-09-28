import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/services/users.services';
import { TableEntity } from './entities/table.entity';

type TablesSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  namespace: 'tables',
})
export class TablesGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TablesGateway.name);
  @WebSocketServer()
  private server!: Server;

  /** Injecte les dépendances : UsersService, JwtService. */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Authentifie la connexion WebSocket via le JWT ; déconnecte le client si le token est absent, invalide ou si l'utilisateur n'existe pas. */
  async handleConnection(client: TablesSocket): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Error verifying token: ${error}`);
      client.disconnect(true);
    }
  }

  /** Diffuse l'état à jour d'une table à tous les clients connectés (événement table:update). */
  emitTableUpdate(table: TableEntity) {
    this.server.emit('table:update', table);
  }
}
