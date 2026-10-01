import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TablesModule } from '../tables/tables.module';
import { BanController } from './ban.controller';
import { BanRepository } from './repositories/ban.repository';
import { BanService } from './services/ban.service';

/** Groupes sur les tables : invitation du coéquipier, file d'attente, appel, placement, libération à 2 votes et rotation après chaque match. Exporte BanService. */
@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule), TablesModule],
  controllers: [BanController],
  providers: [BanService, BanRepository],
  exports: [BanService],
})
export class BanModule {}
