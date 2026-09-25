import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { QueueController } from './queue.controller';
import { QueueGateway } from './queue.gateway';
import { QueueRepository } from './repositories/queue.repository';
import { QueueService } from './services/queue.service';

@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [QueueController],
  providers: [QueueService, QueueRepository, QueueGateway],
  exports: [QueueService],
})
export class QueueModule {}
