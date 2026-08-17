import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { FortyTwoStrategy } from './strategies/forty-two.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { AccessTokenGuard } from './guards/access-token.guard';
import { PreAuthTokenStrategy } from './strategies/pre-auth-token.strategy';
import { PreAuthTokenGuard } from './guards/pre-auth-token.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [
    AuthService,
    FortyTwoStrategy,
    RefreshTokenStrategy,
    RefreshTokenGuard,
    AccessTokenStrategy,
    AccessTokenGuard,
    PreAuthTokenStrategy,
    PreAuthTokenGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
