import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/services/users.services';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationEntity } from './entities/conversation.entity';
import { MessageEntity } from './entities/message.entity';

type ChatSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  private server!: Server;

  /** Injecte les dépendances : UsersService, JwtService, ConversationRepository. */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  /** Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou invalide. */
  async handleConnection(client: ChatSocket): Promise<void> {
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

  /** Envoie le nouveau message (message:new) aux deux participants de la conversation. */
  emitNewMessage(conversation: ConversationEntity, message: MessageEntity) {
    this.server
      .to([conversation.userAId, conversation.userBId])
      .emit('message:new', message);
  }

  /** Prévient les deux participants (conversation:read) que l'un d'eux a lu la conversation. */
  emitConversationRead(
    conversation: ConversationEntity,
    readerId: string,
    readAt: Date,
  ) {
    this.server
      .to([conversation.userAId, conversation.userBId])
      .emit('conversation:read', {
        conversationId: conversation.id,
        readerId,
        readAt,
      });
  }

  /** Relaye l'indicateur « en train d'écrire » aux deux participants, après avoir vérifié que l'émetteur fait partie de la conversation. */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId?: string; isTyping?: boolean },
  ): Promise<void> {
    const userId = client.data.userId;
    if (!userId || !payload?.conversationId) return;
    const conversation = await this.conversationRepository.findById(
      payload.conversationId,
    );
    if (!conversation) return;
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      return;
    }
    this.server
      .to([conversation.userAId, conversation.userBId])
      .emit('typing', {
        conversationId: payload.conversationId,
        userId,
        isTyping: Boolean(payload.isTyping),
      });
  }
}
