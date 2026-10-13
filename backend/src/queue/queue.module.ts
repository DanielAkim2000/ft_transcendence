import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TablesModule } from '../tables/tables.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueController } from './queue.controller';
import { QueueGateway } from './queue.gateway';
import { QueueRepository } from './repositories/queue.repository';
import { QueueService } from './services/queue.service';

/** Groupes sur les tables : invitation du coéquipier, file d'attente, appel, placement, libération à 2 votes et rotation après chaque match. Exporte QueueService. */
/** [Socle produit babyfoot (hors module)] Module NestJS de la file d'attente des tables : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule),
    TablesModule,
    NotificationsModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueRepository, QueueGateway],
  exports: [QueueService],
})
export class QueueModule {}
