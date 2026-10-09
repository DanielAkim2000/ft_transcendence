import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BlockRepository } from '../repositories/block.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { UsersService } from '../../users/services/users.services';
import { UserEntity } from '../../users/entities/user.entity';
import { ConversationEntity } from '../entities/conversation.entity';
import { MessageRepository } from '../repositories/message.repository';
import { MessageEntity } from '../entities/message.entity';
import { PaginationDto } from '../dtos/pagination.dto';
import { ChatGateway } from '../chat.gateway';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { Paginated, toPaginated } from '../../common/pagination/paginated';

@Injectable()
export class ChatService {
  /** Injecte les dépendances : ConversationRepository, BlockRepository, MessageRepository, UsersService, ChatGateway. */
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly blockRepository: BlockRepository,
    private readonly messageRepository: MessageRepository,
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /** Retourne la conversation entre deux utilisateurs ; en l'absence de conversation, ne la crée que s'ils sont amis et non bloqués. */
  async findOrCreateConversation(
    currentUserId: string,
    otherUserId: string,
  ): Promise<ConversationEntity> {
    if (currentUserId === otherUserId) {
      throw new BadRequestException({
        message: 'Cannot create a conversation with yourself',
        code: 'CONVERSATION_WITH_SELF',
      });
    }
    let conversation = await this.conversationRepository.findBetweenUsers(
      currentUserId,
      otherUserId,
    );
    if (conversation) {
      return conversation;
    }
    const verifyFriendship = await this.usersService.getFriendshipStatus(
      currentUserId,
      otherUserId,
    );
    if (verifyFriendship !== 'friends') {
      throw new ForbiddenException({
        message: 'Users are not friends',
        code: 'NOT_FRIENDS',
      });
    }
    if (await this.blockRepository.isBlocked(currentUserId, otherUserId)) {
      throw new ForbiddenException({
        message: 'Users are blocked',
        code: 'USERS_BLOCKED',
      });
    }
    conversation = await this.conversationRepository.create(
      currentUserId,
      otherUserId,
    );
    return conversation;
  }

  /** Retrouve une conversation et vérifie que l'utilisateur en est participant (404 / 403 sinon). */
  async getConversation(
    currentUserId: string,
    conversationId: string,
  ): Promise<ConversationEntity> {
    const conversation =
      await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }
    if (
      conversation.userAId !== currentUserId &&
      conversation.userBId !== currentUserId
    ) {
      throw new ForbiddenException({
        message: 'You are not a participant in this conversation',
        code: 'NOT_CONVERSATION_PARTICIPANT',
      });
    }
    return conversation;
  }

  /** Liste les conversations de l'utilisateur en y attachant leur dernier message. */
  async listConversations(
    currentUserId: string,
  ): Promise<ConversationEntity[]> {
    const conversations =
      await this.conversationRepository.listForUser(currentUserId);
    const lastMessages: MessageEntity[] =
      await this.messageRepository.findLastMessageByConversationIds(
        conversations.map((c) => c.id),
      );
    for (const conversation of conversations) {
      const lastMessage = lastMessages.find(
        (m) => m.conversationId === conversation.id,
      );
      if (lastMessage) {
        conversation.lastMessage = lastMessage;
      }
    }
    return conversations;
  }

  /** Marque la conversation comme lue par l'utilisateur et prévient l'autre participant en temps réel. */
  async markConversationRead(
    currentUserId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.getConversation(
      currentUserId,
      conversationId,
    );
    const readAt = new Date();
    await this.conversationRepository.markRead(conversationId, currentUserId);
    this.chatGateway.emitConversationRead(conversation, currentUserId, readAt);
  }

  /** Bloque un utilisateur (pas soi-même, pas deux fois) et supprime l'amitié éventuelle entre les deux. */
  async blockUser(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException({
        message: 'Cannot block yourself',
        code: 'CANNOT_BLOCK_SELF',
      });
    }
    await this.usersService.getProfile(targetUserId);
    if (await this.blockRepository.findBlock(currentUserId, targetUserId)) {
      throw new ConflictException({
        message: 'User already blocked',
        code: 'ALREADY_BLOCKED',
      });
    }
    await this.blockRepository.create(currentUserId, targetUserId);
    await this.usersService.removeFriendshipIfExists(
      currentUserId,
      targetUserId,
    );
  }

  /** Retire le blocage d'un utilisateur ; 404 s'il n'était pas bloqué. */
  async unblockUser(
    currentUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (!(await this.blockRepository.findBlock(currentUserId, targetUserId))) {
      throw new NotFoundException({
        message: 'Block not found',
        code: 'BLOCK_NOT_FOUND',
      });
    }
    await this.blockRepository.remove(currentUserId, targetUserId);
  }

  /** Retourne les profils des utilisateurs bloqués par l'utilisateur. */
  async listBlockedUsers(
    currentUserId: string,
    page: PageQueryDto,
  ): Promise<Paginated<UserEntity>> {
    const { blocks, total } = await this.blockRepository.listBlockedByUser(
      currentUserId,
      page,
    );
    const users = await Promise.all(
      blocks.map((block) => this.usersService.findUserById(block.blockedId)),
    );
    return toPaginated(
      users.filter((user): user is UserEntity => user !== null),
      total,
      page,
    );
  }

  /** Indique si l'utilisateur connecté a bloqué l'utilisateur ciblé. */
  async isBlockedByMe(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ blocked: boolean }> {
    return {
      blocked:
        (await this.blockRepository.findBlock(currentUserId, targetUserId)) !==
        null,
    };
  }

  /** Envoie un message dans une conversation, à condition que les deux soient amis et non bloqués, puis le diffuse en temps réel. */
  async sendMessage(
    currentUserId: string,
    conversationId: string,
    content: string,
  ): Promise<MessageEntity> {
    const conversation = await this.getConversation(
      currentUserId,
      conversationId,
    );
    const otherUserId =
      conversation.userAId === currentUserId
        ? conversation.userBId
        : conversation.userAId;

    const friendshipStatus = await this.usersService.getFriendshipStatus(
      currentUserId,
      otherUserId,
    );
    if (friendshipStatus !== 'friends') {
      throw new ForbiddenException({
        message: 'Users are not friends',
        code: 'NOT_FRIENDS',
      });
    }

    if (await this.blockRepository.isBlocked(currentUserId, otherUserId)) {
      throw new ForbiddenException({
        message: 'Users are blocked',
        code: 'USERS_BLOCKED',
      });
    }
    const message = await this.messageRepository.create(
      conversationId,
      currentUserId,
      content,
    );
    this.chatGateway.emitNewMessage(conversation, message);
    return message;
  }

  /** Poste dans la conversation entre les deux joueurs un message d'invitation à la partie d'échecs donnée (affiché comme une carte côté client). Sans effet si les joueurs ne sont pas amis ou si l'un a bloqué l'autre : l'invitation reste alors visible dans les notifications. */
  async postChessInvite(
    senderId: string,
    recipientId: string,
    chessGameId: string,
  ): Promise<MessageEntity | null> {
    let conversation: ConversationEntity;
    try {
      conversation = await this.findOrCreateConversation(senderId, recipientId);
    } catch (error) {
      if (error instanceof ForbiddenException) return null;
      throw error;
    }
    if (await this.blockRepository.isBlocked(senderId, recipientId)) {
      return null;
    }
    const message = await this.messageRepository.create(
      conversation.id,
      senderId,
      'Chess invitation',
      chessGameId,
    );
    this.chatGateway.emitNewMessage(conversation, message);
    return message;
  }

  /** Retourne une page de messages d'une conversation dont l'utilisateur est participant. */
  async getMessages(
    currentUserId: string,
    conversationId: string,
    pagination: PaginationDto,
  ): Promise<MessageEntity[]> {
    await this.getConversation(currentUserId, conversationId);
    const messages = await this.messageRepository.findByConversation(
      conversationId,
      pagination.limit,
      pagination.cursor,
    );
    return messages;
  }
}
