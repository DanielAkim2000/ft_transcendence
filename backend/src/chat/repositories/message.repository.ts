import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageEntity } from '../entities/message.entity';
import type { Message as MessagePrisma } from '../../generated/prisma/client';

@Injectable()
export class MessageRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Crée un message et met à jour la date de la conversation, dans une même transaction. */
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

  /** Retourne les messages d'une conversation, du plus récent au plus ancien, limités à limit et paginés à partir d'un curseur (id du dernier message reçu). */
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

  /** Retourne le dernier message de chacune des conversations données. */
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

  /** Convertit un message Prisma en MessageEntity. */
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
