import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GdprModule } from '../gdpr/gdpr.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminUsersRepository } from './repositories/admin-users.repository';

/** Administration : gestion des comptes (recherche, création, modification, suppression), réservée au rôle ADMIN. */
@Module({
  imports: [PrismaModule, AuthModule, GdprModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminUsersRepository],
})
export class AdminModule {}
