import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';

/** Historique persistant des notifications personnelles (hors chat). Exporte NotificationsService, appelé par les autres modules à chaque événement qui concerne un utilisateur précis. */
@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsGateway,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
