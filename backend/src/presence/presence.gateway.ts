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
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

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

  private async notifyFriends(
    userId: string,
    status: Status.ONLINE | Status.OFFLINE,
  ): Promise<void> {
    const friends = await this.userService.listFriends(userId);

    for (const friend of friends) {
      this.server.to(friend.id).emit('presence:update', {
        userId: userId,
        status,
      });
    }
  }

  private async syncPresence(
    client: PresenceSocket,
    userId: string,
  ): Promise<void> {
    const friends = await this.userService.listFriends(userId);

    const onlineFriends = friends
      .filter((friend) => this.onlineUsers.has(friend.id))
      .map((friend) => ({
        userId: friend.id,
        status: Status.ONLINE,
      }));

    client.emit('presence:sync', { onlineFriends });
  }

  /** Envoie un événement à toutes les sessions ouvertes d'un utilisateur. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userId).emit(event, payload);
  }

  private async setUserPresence(
    userId: string,
    status: Status.ONLINE | Status.OFFLINE,
  ): Promise<void> {
    const isOnline = status === Status.ONLINE;

    await this.userService.updatePresence(userId, isOnline, status);
    await this.notifyFriends(userId, status);
  }
}
