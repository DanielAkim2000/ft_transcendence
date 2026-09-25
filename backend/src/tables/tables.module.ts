import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { TablesController } from './tables.controller';
import { TablesGateway } from './tables.gateway';
import { TablesRepository } from './repositories/tables.repository';
import { TablesService } from './services/tables.service';

@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule), QueueModule],
  controllers: [TablesController],
  providers: [TablesService, TablesRepository, TablesGateway],
  exports: [TablesService],
})
export class TablesModule {}
