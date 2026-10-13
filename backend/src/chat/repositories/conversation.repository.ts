import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationEntity } from '../entities/conversation.entity';
import type { Conversation as ConversationPrisma } from '../../generated/prisma/client';

/** [Major · Interaction entre utilisateurs] Dépôt de données du chat (conversations, messages, blocages) : requêtes Prisma et conversion en entités. */
@Injectable()
export class ConversationRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Major · Interaction entre utilisateurs] Retrouve la conversation entre deux utilisateurs (ids triés pour être indépendant de l'ordre), ou null. */
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

  /** [Major · Interaction entre utilisateurs] Crée la conversation entre deux utilisateurs (ids triés). */
  async create(userIdA: string, userIdB: string): Promise<ConversationEntity> {
    const [userAId, userBId] = [userIdA, userIdB].sort();
    const conversation = await this.prisma.conversation.create({
      data: { userAId, userBId },
    });

    return this.toEntity(conversation);
  }

  /** [Major · Interaction entre utilisateurs] Retrouve une conversation par son id, ou null. */
  async findById(conversationId: string): Promise<ConversationEntity | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    return conversation ? this.toEntity(conversation) : null;
  }

  /** [Major · Interaction entre utilisateurs] Liste les conversations de l'utilisateur, la plus récente d'abord, avec le nombre de messages non lus et la date de dernière lecture de l'interlocuteur. */
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

  /** [Minor · Chat avancé] Met à jour la date de dernière lecture de l'utilisateur dans la conversation (côté A ou B selon sa position). */
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

  /** [Major · Interaction entre utilisateurs] Convertit une conversation Prisma en ConversationEntity. */
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
