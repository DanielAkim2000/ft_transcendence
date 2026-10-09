import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { BanController } from './ban.controller';
import { BanRepository } from './repositories/ban.repository';
import { BanService } from './services/ban.service';

/** Modération : bannissement et débannissement d'utilisateurs (admin), historique des bans, déconnexion immédiate et email. Exporte BanService. */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule),
    forwardRef(() => PresenceModule),
  ],
  controllers: [BanController],
  providers: [BanService, BanRepository],
  exports: [BanService],
})
export class BanModule {}
