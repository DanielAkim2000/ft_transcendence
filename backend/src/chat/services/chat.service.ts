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

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly blockRepository: BlockRepository,
    private readonly messageRepository: MessageRepository,
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async findOrCreateConversation(
    currentUserId: string,
    otherUserId: string,
  ): Promise<ConversationEntity> {
    if (currentUserId === otherUserId) {
      throw new BadRequestException(
        'Cannot create a conversation with yourself',
      );
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
      throw new ForbiddenException('Users are not friends');
    }
    if (await this.blockRepository.isBlocked(currentUserId, otherUserId)) {
      throw new ForbiddenException('Users are blocked');
    }
    conversation = await this.conversationRepository.create(
      currentUserId,
      otherUserId,
    );
    return conversation;
  }

  async getConversation(
    currentUserId: string,
    conversationId: string,
  ): Promise<ConversationEntity> {
    const conversation =
      await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (
      conversation.userAId !== currentUserId &&
      conversation.userBId !== currentUserId
    ) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }
    return conversation;
  }

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

  async blockUser(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }
    await this.usersService.getProfile(targetUserId);
    if (await this.blockRepository.findBlock(currentUserId, targetUserId)) {
      throw new ConflictException('User already blocked');
    }
    await this.blockRepository.create(currentUserId, targetUserId);
    await this.usersService.removeFriendshipIfExists(
      currentUserId,
      targetUserId,
    );
  }

  async unblockUser(
    currentUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (!(await this.blockRepository.findBlock(currentUserId, targetUserId))) {
      throw new NotFoundException('Block not found');
    }
    await this.blockRepository.remove(currentUserId, targetUserId);
  }

  async listBlockedUsers(currentUserId: string): Promise<UserEntity[]> {
    const blocks = await this.blockRepository.listBlockedByUser(currentUserId);
    const users = await Promise.all(
      blocks.map((block) => this.usersService.findUserById(block.blockedId)),
    );
    return users.filter((user): user is UserEntity => user !== null);
  }

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
      throw new ForbiddenException('Users are not friends');
    }

    if (await this.blockRepository.isBlocked(currentUserId, otherUserId)) {
      throw new ForbiddenException('Users are blocked');
    }
    const message = await this.messageRepository.create(
      conversationId,
      currentUserId,
      content,
    );
    this.chatGateway.emitNewMessage(conversation, message);
    return message;
  }

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
