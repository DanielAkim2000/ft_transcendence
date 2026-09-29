import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationEntity,
  NotificationType,
} from '../entities/notification.entity';
import type { Prisma } from '../../generated/prisma/client';
import {
  PageQueryDto,
  pageOffset,
} from '../../common/pagination/page-query.dto';

@Injectable()
export class NotificationsRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Crée une notification pour un utilisateur. */
  async create(
    userId: string,
    type: NotificationType,
    data: Record<string, unknown>,
  ): Promise<NotificationEntity> {
    const row = await this.prisma.notification.create({
      data: { userId, type, data: data as Prisma.InputJsonValue },
    });
    return this.toEntity(row);
  }

  /** Liste une page des notifications d'un utilisateur, les plus récentes d'abord, plus le total. */
  async listPage(
    userId: string,
    page: PageQueryDto,
  ): Promise<{ notifications: NotificationEntity[]; total: number }> {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { notifications: rows.map((row) => this.toEntity(row)), total };
  }

  /** Nombre de notifications non lues de l'utilisateur. */
  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  /** Marque toutes les notifications de l'utilisateur comme lues. */
  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  /** Convertit une ligne Prisma en NotificationEntity. */
  private toEntity(row: {
    id: string;
    type: string;
    data: Prisma.JsonValue;
    read: boolean;
    createdAt: Date;
  }): NotificationEntity {
    return new NotificationEntity({
      id: row.id,
      type: row.type as NotificationType,
      data: row.data as Record<string, unknown>,
      read: row.read,
      createdAt: row.createdAt,
    });
  }
}
