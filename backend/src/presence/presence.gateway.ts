import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { UsersService } from '../users/services/users.services';
import { JwtService } from '@nestjs/jwt';
import { Status } from '../users/entities/users.entity';

type PresenceSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  namespace: 'presence',
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PresenceGateway.name);
  private onlineUsers: Map<string, Set<string>> = new Map();
  @WebSocketServer()
  private server!: Server;
  /** Injecte les dépendances : UsersService, JwtService. */
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Authentifie la connexion WebSocket via le JWT, enregistre la session, envoie au client la présence de ses amis et passe l'utilisateur en ligne à sa première session. */
  async handleConnection(client: PresenceSocket): Promise<void> {
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
      const user = await this.userService.findUserById(decoded.userId);
      if (!user) {
        client.disconnect(true);
        return;
      }
      const wasOffline = !this.onlineUsers.has(user.id);
      if (!this.onlineUsers.has(user.id)) {
        this.onlineUsers.set(user.id, new Set([client.id]));
      } else {
        this.onlineUsers.get(user.id)?.add(client.id);
      }
      client.data.userId = user.id;
      await client.join(user.id);
      await this.syncPresence(client, user.id);
      if (wasOffline) {
        await this.setUserPresence(user.id, Status.ONLINE);
      }
    } catch (error) {
      this.logger.error(`Error verifying token: ${error}`);
      client.disconnect(true);
    }
  }

  /** Retire la session fermée ; quand la dernière session de l'utilisateur se ferme, il passe hors ligne. */
  async handleDisconnect(client: PresenceSocket): Promise<void> {
    const userId = client.data.userId;
    if (typeof userId !== 'string' || !userId) {
      return;
    }
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) {
      return;
    }
    sockets.delete(client.id);
    if (sockets.size > 0) {
      return;
    }
    await this.setUserPresence(userId, Status.OFFLINE);
    this.onlineUsers.delete(userId);
  }

  /** Prévient tous les amis de l'utilisateur de son changement de statut (presence:update). */
  private async notifyFriends(
    userId: string,
    status: Status.ONLINE | Status.OFFLINE,
  ): Promise<void> {
    const friendIds = await this.userService.listFriendIds(userId);

    for (const friendId of friendIds) {
      this.server.to(friendId).emit('presence:update', {
        userId: userId,
        status,
      });
    }
  }

  /** Envoie au client la liste de ses amis actuellement en ligne (presence:sync). */
  private async syncPresence(
    client: PresenceSocket,
    userId: string,
  ): Promise<void> {
    const friendIds = await this.userService.listFriendIds(userId);

    const onlineFriends = friendIds
      .filter((friendId) => this.onlineUsers.has(friendId))
      .map((friendId) => ({
        userId: friendId,
        status: Status.ONLINE,
      }));

    client.emit('presence:sync', { onlineFriends });
  }

  /** Envoie un événement à toutes les sessions ouvertes d'un utilisateur. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userId).emit(event, payload);
  }

  /** Prévient un utilisateur qu'il vient d'être banni (auth:banned, avec motif et date de fin) puis ferme toutes ses sessions WebSocket : il passe hors ligne. */
  kickBannedUser(
    userId: string,
    payload: { reason: string; endTime: Date | null },
  ): void {
    this.server.to(userId).emit('auth:banned', payload);
    this.server.in(userId).disconnectSockets(true);
  }

  /** Enregistre le statut en ligne/hors ligne en base puis prévient les amis. */
  private async setUserPresence(
    userId: string,
    status: Status.ONLINE | Status.OFFLINE,
  ): Promise<void> {
    const isOnline = status === Status.ONLINE;

    await this.userService.updatePresence(userId, isOnline, status);
    await this.notifyFriends(userId, status);
  }
}
