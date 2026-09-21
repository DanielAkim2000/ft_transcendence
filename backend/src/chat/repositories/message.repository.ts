import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageEntity } from '../entities/message.entity';
import type { Message as MessagePrisma } from '../../generated/prisma/client';

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<MessageEntity> {
    const message = await this.prisma.$transaction(async (transaction) => {
      const createdMessage = await transaction.message.create({
        data: { conversationId, senderId, content },
      });

      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return createdMessage;
    });

    return this.toEntity(message);
  }

  async findByConversation(
    conversationId: string,
    limit: number,
    cursor?: string,
  ): Promise<MessageEntity[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return messages.map((message) => this.toEntity(message));
  }

  async findLastMessageByConversationIds(
    conversationIds: string[],
  ): Promise<MessageEntity[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['conversationId'],
    });

    return messages.map((message) => this.toEntity(message));
  }

  private toEntity(message: MessagePrisma): MessageEntity {
    return new MessageEntity({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    });
  }
}
