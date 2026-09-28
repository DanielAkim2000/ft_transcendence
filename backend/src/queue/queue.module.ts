import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TablesModule } from '../tables/tables.module';
import { QueueController } from './queue.controller';
import { QueueGateway } from './queue.gateway';
import { QueueRepository } from './repositories/queue.repository';
import { QueueService } from './services/queue.service';

/** Groupes sur les tables : invitation du coéquipier, file d'attente, appel, placement, libération à 2 votes et rotation après chaque match. Exporte QueueService. */
@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule), TablesModule],
  controllers: [QueueController],
  providers: [QueueService, QueueRepository, QueueGateway],
  exports: [QueueService],
})
export class QueueModule {}
