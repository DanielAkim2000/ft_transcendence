import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from '../repositories/notifications.repository';
import {
  NotificationDataMap,
  NotificationEntity,
  NotificationType,
} from '../entities/notification.entity';
import { NotificationsGateway } from '../notifications.gateway';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { Paginated, toPaginated } from '../../common/pagination/paginated';

/** [Minor · Notifications] Service métier des notifications. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /** [Minor · Notifications] Injecte les dépendances : NotificationsRepository, NotificationsGateway. */
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /** [Minor · Notifications] Crée une notification pour un utilisateur et le prévient en temps réel (compteur de non-lus à jour). N'échoue jamais l'appelant : une erreur ici est journalisée, pas propagée. */
  async create<T extends NotificationType>(
    userId: string,
    type: T,
    data: NotificationDataMap[T],
  ): Promise<void> {
    try {
      await this.notificationsRepository.create(userId, type, data);
      const unread = await this.notificationsRepository.countUnread(userId);
      this.notificationsGateway.emitToUser(userId, 'notifications:new', {
        unread,
      });
    } catch (error) {
      this.logger.error(
        `Could not create notification ${type} for ${userId}: ${String(error)}`,
      );
    }
  }

  /** [Minor · Notifications] Même notification (payload identique) pour plusieurs destinataires. */
  async createForUsers<T extends NotificationType>(
    userIds: string[],
    type: T,
    data: NotificationDataMap[T],
  ): Promise<void> {
    await Promise.all(userIds.map((userId) => this.create(userId, type, data)));
  }

  /** [Minor · Notifications] Liste une page des notifications de l'utilisateur, les plus récentes d'abord. */
  async listPage(
    userId: string,
    page: PageQueryDto,
  ): Promise<Paginated<NotificationEntity>> {
    const { notifications, total } =
      await this.notificationsRepository.listPage(userId, page);
    return toPaginated(notifications, total, page);
  }

  /** [Minor · Notifications] Nombre de notifications non lues (pastille de la barre latérale). */
  async countUnread(userId: string): Promise<{ count: number }> {
    return { count: await this.notificationsRepository.countUnread(userId) };
  }

  /** [Minor · Notifications] Marque toutes les notifications de l'utilisateur comme lues. */
  async markAllRead(userId: string): Promise<{ count: number }> {
    await this.notificationsRepository.markAllRead(userId);
    this.notificationsGateway.emitToUser(userId, 'notifications:read', {
      unread: 0,
    });
    return { count: 0 };
  }
}
