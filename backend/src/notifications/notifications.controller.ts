import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationsService } from './services/notifications.service';
import { PageQueryDto } from '../common/pagination/page-query.dto';

/** [Minor · Notifications] Contrôleur HTTP des notifications : routes REST protégées par les guards d'authentification. */
@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class NotificationsController {
  /** Injecte les dépendances : NotificationsService. */
  constructor(private readonly notificationsService: NotificationsService) {}

  /** [Minor · Notifications] GET /notifications?page=&limit= : page de l'historique des notifications de l'utilisateur connecté, les plus récentes d'abord. */
  @Get()
  list(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.notificationsService.listPage(req.user.id, query);
  }

  /** [Minor · Notifications] GET /notifications/unread-count : nombre de notifications non lues (pastille de la barre latérale). */
  @Get('unread-count')
  countUnread(@Req() req: Request & { user: UserEntity }) {
    return this.notificationsService.countUnread(req.user.id);
  }

  /** [Minor · Notifications] POST /notifications/read-all : marque toutes les notifications de l'utilisateur connecté comme lues. */
  @Post('read-all')
  markAllRead(@Req() req: Request & { user: UserEntity }) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
