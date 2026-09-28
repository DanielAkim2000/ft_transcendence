import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { UserRepository } from './repositories/users.repository';
import { UsersService } from './services/users.services';
import { UsersController } from './users.controller';

/** Utilisateurs : profils, paramètres, avatar, amis et classement. Exporte UsersService. */
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => PresenceModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
  exports: [UsersService],
})
export class UsersModule {}
