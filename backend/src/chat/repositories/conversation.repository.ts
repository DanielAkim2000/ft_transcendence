import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationEntity } from '../entities/conversation.entity';
import type { Conversation as ConversationPrisma } from '../../generated/prisma/client';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBetweenUsers(
    userIdA: string,
    userIdB: string,
  ): Promise<ConversationEntity | null> {
    const [userAId, userBId] = [userIdA, userIdB].sort();
    const conversation = await this.prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    return conversation ? this.toEntity(conversation) : null;
  }

  async create(userIdA: string, userIdB: string): Promise<ConversationEntity> {
    const [userAId, userBId] = [userIdA, userIdB].sort();
    const conversation = await this.prisma.conversation.create({
      data: { userAId, userBId },
    });

    return this.toEntity(conversation);
  }

  async findById(conversationId: string): Promise<ConversationEntity | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    return conversation ? this.toEntity(conversation) : null;
  }

  async listForUser(userId: string): Promise<ConversationEntity[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const unreadCounts = await Promise.all(
      conversations.map((conversation) =>
        this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            createdAt: {
              gt:
                conversation.userAId === userId
                  ? conversation.userALastReadAt
                  : conversation.userBLastReadAt,
            },
          },
        }),
      ),
    );

    return conversations.map((conversation, index) => {
      const entity = this.toEntity(conversation);
      entity.unreadCount = unreadCounts[index];
      entity.peerLastReadAt =
        conversation.userAId === userId
          ? conversation.userBLastReadAt
          : conversation.userALastReadAt;
      return entity;
    });
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, userAId: userId },
      data: { userALastReadAt: new Date() },
    });
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, userBId: userId },
      data: { userBLastReadAt: new Date() },
    });
  }

  private toEntity(conversation: ConversationPrisma): ConversationEntity {
    return new ConversationEntity({
      id: conversation.id,
      userAId: conversation.userAId,
      userBId: conversation.userBId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  }
}
