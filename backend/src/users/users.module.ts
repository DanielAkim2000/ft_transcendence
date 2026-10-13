import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserRepository } from './repositories/users.repository';
import { UsersService } from './services/users.services';
import { UsersController } from './users.controller';

/** Utilisateurs : profils, paramètres, avatar, amis et classement. Exporte UsersService. */
/** [Major · Gestion des utilisateurs] Module NestJS des utilisateurs (profil, amis, classement) : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => PresenceModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
  exports: [UsersService],
})
export class UsersModule {}
