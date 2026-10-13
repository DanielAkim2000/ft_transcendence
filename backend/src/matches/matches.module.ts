import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { BadgesModule } from '../badges/badges.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatchesController } from './matches.controller';
import { MatchesGateway } from './matches.gateway';
import { MatchesRepository } from './repositories/matches.repository';
import { MatchesService } from './services/matches.service';

/** Défis et matchs : proposition, acceptation, score, validation/litige et calcul Elo. */
/** [Minor · Stats et historique] Module NestJS des matchs (défis, scores, Elo, historique) : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule),
    TournamentsModule,
    BadgesModule,
    QueueModule,
    NotificationsModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesRepository, MatchesGateway],
})
export class MatchesModule {}
