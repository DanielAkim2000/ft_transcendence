import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GdprModule } from '../gdprs/gdpr.module';
import { BanModule } from '../ban/ban.module'
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminUsersRepository } from './repositories/admin-users.repository';

/** Administration : gestion des comptes (recherche, création, modification, suppression), réservée au rôle ADMIN. */
/** [Major · Permissions avancées] Module NestJS de l'administration des utilisateurs (CRUD réservé aux admins) : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [PrismaModule, AuthModule, GdprModule, BanModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminUsersRepository],
})
export class AdminModule {}
