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

    return conversations.map((conversation) => this.toEntity(conversation));
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
