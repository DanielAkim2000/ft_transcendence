import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TablesController } from './tables.controller';
import { TablesGateway } from './tables.gateway';
import { TablesRepository } from './repositories/tables.repository';
import { TablesService } from './services/tables.service';

/** Tables de jeu : état (format, groupes, match en cours) et réservation par les tournois. Exporte TablesService. */
@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [TablesController],
  providers: [TablesService, TablesRepository, TablesGateway],
  exports: [TablesService],
})
export class TablesModule {}
