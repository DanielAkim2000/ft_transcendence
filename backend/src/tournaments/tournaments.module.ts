import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TablesModule } from '../tables/tables.module';
import { QueueModule } from '../queue/queue.module';
import { BadgesModule } from '../badges/badges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsGateway } from './tournaments.gateway';
import { TournamentsRepository } from './repositories/tournaments.repository';
import { TournamentsService } from './services/tournaments.service';

/** Tournois à élimination directe : entrées, tirage du tableau, rencontres et manches. Exporte TournamentsService. */
/** [Minor · Tournois] Module NestJS des tournois : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule),
    TablesModule,
    QueueModule,
    BadgesModule,
    NotificationsModule,
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentsRepository, TournamentsGateway],
  exports: [TournamentsService],
})
export class TournamentsModule {}
