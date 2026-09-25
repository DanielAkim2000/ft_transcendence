import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserEntity, Role } from '../users/entities/users.entity';
import { FOURTY_TWO_STRATEGY } from './constants/injection-tokens';
import { AuthService } from './auth.service';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { TwoFactorCodeDto } from './dtos/two-factor-code.dto';
import { PreAuthTokenGuard } from './guards/pre-auth-token.guard';
import { AuthRoles } from './decorators/auth-roles.decorator';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue as msStringValue } from 'ms';
import type { Request, Response } from 'express';

type SwitchResult =
  | {
      twoFactorEnabled: false;
      user: UserEntity;
      accessToken: string;
    }
  | {
      twoFactorEnabled: true;
    };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    user: UserEntity;
    accessToken: string;
  }> {
    const result = await this.authService.register(registerDto);
    await this.setRefreshCookie(result.user, res, result.tokens.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  @Post('login')
  async loginFromCredentials(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SwitchResult> {
    const user = await this.authService.validateUserFromLogin(loginDto);
    if (user.twoFactorEnabled === false) {
      const tokens = await this.authService.createTokens(user);
      await this.setRefreshCookie(user, res, tokens.refreshToken);
      return {
        twoFactorEnabled: false,
        user,
        accessToken: tokens.accessToken,
      };
    }
    const preAuthToken = await this.authService.createPreAuthToken(user);
    this.setPreAuthCookie(res, preAuthToken);
    return {
      twoFactorEnabled: true,
    };
  }

  @Get('42/login')
  @UseGuards(AuthGuard(FOURTY_TWO_STRATEGY))
  loginFrom42Profile() {}

  @Get('42/callback')
  @UseGuards(AuthGuard(FOURTY_TWO_STRATEGY))
  async callback(
    @Req() req: Request & { user: UserEntity },
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new UnauthorizedException('FRONTEND_URL is not set');
    }

    const callbackUrl = new URL('/auth/callback', frontendUrl);

    if (req.user.twoFactorEnabled === false) {
      const tokens = await this.authService.createTokens(req.user);
      await this.setRefreshCookie(req.user, res, tokens.refreshToken);
    } else {
      const preAuthToken = await this.authService.createPreAuthToken(req.user);
      this.setPreAuthCookie(res, preAuthToken);
    }

    res.redirect(callbackUrl.toString());
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refresh(
    @Req() req: Request & { user: UserEntity },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
  }> {
    const oldRefreshToken = (req.cookies as Record<string, unknown> | undefined)
      ?.refreshToken;
    if (!oldRefreshToken || typeof oldRefreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }
    const tokens = await this.authService.rotateRefreshToken(
      req.user,
      oldRefreshToken,
    );
    await this.setRefreshCookie(req.user, res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
    };
  }

  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  async logout(
    @Req() req: Request & { user: UserEntity },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = (req.cookies as Record<string, unknown> | undefined)
      ?.refreshToken;
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }
    await this.authService.revokeRefreshToken(req.user.id, refreshToken);
    res.clearCookie('refreshToken', {
      path: '/auth',
    });
    res.clearCookie('preAuthToken', {
      path: '/auth',
    });
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() req: Request & { user: UserEntity }): UserEntity {
    return req.user;
  }

  @Get('admin')
  @AuthRoles(Role.ADMIN)
  adminOnly(@Req() req: Request & { user: UserEntity }): {
    ok: true;
    role: Role;
  } {
    return { ok: true, role: req.user.role };
  }

  @Post('2fa/verify')
  @UseGuards(PreAuthTokenGuard)
  async verify2fa(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: TwoFactorCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    user: UserEntity;
    accessToken: string;
  }> {
    await this.authService.verify2fa(req.user, dto.code);
    const tokens = await this.authService.createTokens(req.user);
    await this.setRefreshCookie(req.user, res, tokens.refreshToken);
    res.clearCookie('preAuthToken', { path: '/auth' });
    return {
      user: req.user,
      accessToken: tokens.accessToken,
    };
  }

  @Get('2fa/pending')
  @UseGuards(PreAuthTokenGuard)
  pending2fa(): { pending: true } {
    return { pending: true };
  }

  @Post('2fa/setup')
  @UseGuards(AccessTokenGuard)
  async setup2fa(@Req() req: Request & { user: UserEntity }): Promise<{
    secret: string;
    otpauthUrl: string;
  }> {
    return await this.authService.generate2faSecret(req.user);
  }

  @Post('2fa/toggle')
  @UseGuards(AccessTokenGuard)
  async toggle2fa(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: TwoFactorCodeDto,
  ): Promise<boolean> {
    return await this.authService.toggle2fa(req.user, dto.code);
  }

  private useSecureCookies(): boolean {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    return (
      process.env.NODE_ENV === 'production' ||
      frontendUrl.startsWith('https://')
    );
  }

  private async setRefreshCookie(
    user: UserEntity,
    res: Response,
    refreshToken: string,
  ): Promise<void> {
    const expirationTime = this.configService.get<msStringValue>(
      'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
    );
    if (!expirationTime) {
      await this.authService.revokeRefreshToken(user.id, refreshToken);
      throw new UnauthorizedException(
        'Refresh token expiration time is not set',
      );
    }
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.useSecureCookies(),
      sameSite: 'lax',
      path: '/auth',
      maxAge: ms(expirationTime),
    });
    res.clearCookie('preAuthToken', {
      path: '/auth',
    });
  }

  private setPreAuthCookie(res: Response, preAuthToken: string): void {
    const expirationTime = this.configService.get<msStringValue>(
      'JWT_PRE_AUTH_TOKEN_EXPIRATION_TIME',
    );
    if (!expirationTime) {
      throw new UnauthorizedException(
        'Pre-auth token expiration time is not set',
      );
    }
    res.cookie('preAuthToken', preAuthToken, {
      httpOnly: true,
      secure: this.useSecureCookies(),
      sameSite: 'lax',
      path: '/auth',
      maxAge: ms(expirationTime),
    });
  }
}
