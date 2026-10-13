import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { BanModule } from '../ban/ban.module';
import { FortyTwoStrategy } from './strategies/forty-two.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { AccessTokenGuard } from './guards/access-token.guard';
import { PreAuthTokenStrategy } from './strategies/pre-auth-token.strategy';
import { PreAuthTokenGuard } from './guards/pre-auth-token.guard';
import { RolesGuard } from './guards/roles.guard';
import { MailModule } from '../mail/mail.module';

/** Authentification : inscription/connexion, JWT (access, refresh, pré-auth 2FA), OAuth 42, 2FA et gardes de rôles. Exporte AuthService et les guards. */
/** [Major · Gestion des utilisateurs] Module NestJS de l'authentification (inscription, connexion, tokens, mot de passe) : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [forwardRef(() => UsersModule), MailModule, BanModule],
  providers: [
    AuthService,
    FortyTwoStrategy,
    RefreshTokenStrategy,
    RefreshTokenGuard,
    AccessTokenStrategy,
    AccessTokenGuard,
    PreAuthTokenStrategy,
    PreAuthTokenGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}
