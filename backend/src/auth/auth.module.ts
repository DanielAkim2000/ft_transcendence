import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { FortyTwoStrategy } from './strategies/forty-two.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { AccessTokenGuard } from './guards/access-token.guard';
import { PreAuthTokenStrategy } from './strategies/pre-auth-token.strategy';
import { PreAuthTokenGuard } from './guards/pre-auth-token.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [forwardRef(() => UsersModule)],
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
