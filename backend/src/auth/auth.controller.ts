import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { RecoveryCodeDto } from './dtos/recovery-code.dto';
import { ToggleTwoFactorDto } from './dtos/toggle-two-factor.dto';
import { RegenerateRecoveryCodesDto } from './dtos/regenerate-recovery-codes.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
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
  /** Injecte les dépendances : AuthService, ConfigService. */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /** POST /auth/register : crée un compte (email, nom, mot de passe), pose le cookie de refresh token et retourne l'utilisateur avec son access token. */
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

  /** POST /auth/login : vérifie email/mot de passe ; sans 2FA renvoie les tokens, avec 2FA pose un cookie de pré-authentification et attend le code. */
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

  /** GET /auth/42/login : point d'entrée qui redirige vers l'OAuth 42 (géré par le guard Passport). */
  @Get('42/login')
  @UseGuards(AuthGuard(FOURTY_TWO_STRATEGY))
  loginFrom42Profile() {}

  /** GET /auth/42/callback : retour de l'OAuth 42 ; pose le cookie de refresh (ou de pré-authentification si 2FA) puis redirige vers le frontend. */
  @Get('42/callback')
  @UseGuards(AuthGuard(FOURTY_TWO_STRATEGY))
  async callback(
    @Req() req: Request & { user: UserEntity },
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new UnauthorizedException({
        message: 'FRONTEND_URL is not set',
        code: 'SERVER_CONFIG_ERROR',
      });
    }

    const callbackUrl = new URL('/auth/callback', frontendUrl);

    try {
      await this.authService.assertNotBanned(req.user.id);
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      const { reason, endTime } = error.getResponse() as {
        reason: string;
        endTime: Date | null;
      };
      const loginUrl = new URL('/login', frontendUrl);
      loginUrl.searchParams.set('banned', '1');
      loginUrl.searchParams.set('reason', reason);
      if (endTime) loginUrl.searchParams.set('until', endTime.toISOString());
      res.redirect(loginUrl.toString());
      return;
    }

    if (req.user.twoFactorEnabled === false) {
      const tokens = await this.authService.createTokens(req.user);
      await this.setRefreshCookie(req.user, res, tokens.refreshToken);
    } else {
      const preAuthToken = await this.authService.createPreAuthToken(req.user);
      this.setPreAuthCookie(res, preAuthToken);
    }

    res.redirect(callbackUrl.toString());
  }

  /** POST /auth/refresh : fait tourner le refresh token du cookie et retourne un nouvel access token. */
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
      throw new UnauthorizedException({
        message: 'Refresh token cookie is missing',
        code: 'SESSION_EXPIRED',
      });
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

  /** POST /auth/logout : révoque le refresh token courant et efface les cookies d'authentification. */
  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  async logout(
    @Req() req: Request & { user: UserEntity },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = (req.cookies as Record<string, unknown> | undefined)
      ?.refreshToken;
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException({
        message: 'Refresh token cookie is missing',
        code: 'SESSION_EXPIRED',
      });
    }
    await this.authService.revokeRefreshToken(req.user.id, refreshToken);
    res.clearCookie('refreshToken', {
      path: '/auth',
    });
    res.clearCookie('preAuthToken', {
      path: '/auth',
    });
  }

  /** POST /auth/forgot-password : public ; envoie un lien de réinitialisation si un compte correspond (réponse identique sinon, pour ne pas révéler les emails inscrits). */
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'If an account exists, an email has been sent' };
  }

  /** POST /auth/reset-password : public (le jeton reçu par email fait foi) ; définit le nouveau mot de passe et déconnecte toutes les sessions. */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password updated' };
  }

  /** GET /auth/me : retourne l'utilisateur authentifié. */
  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() req: Request & { user: UserEntity }): UserEntity {
    return req.user;
  }

  /** GET /auth/admin : route de test réservée aux administrateurs. */
  @Get('admin')
  @AuthRoles(Role.ADMIN)
  adminOnly(@Req() req: Request & { user: UserEntity }): {
    ok: true;
    role: Role;
  } {
    return { ok: true, role: req.user.role };
  }

  /** POST /auth/2fa/verify : valide le code 2FA de la pré-authentification et ouvre la session (tokens et cookie de refresh). */
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

  /** GET /auth/2fa/pending : confirme qu'une pré-authentification 2FA valide est en cours. */
  @Get('2fa/pending')
  @UseGuards(PreAuthTokenGuard)
  pending2fa(): { pending: true } {
    return { pending: true };
  }

  /** POST /auth/2fa/setup : génère un secret 2FA en attente et l'URL otpauth pour le QR code. */
  @Post('2fa/setup')
  @UseGuards(AccessTokenGuard)
  async setup2fa(@Req() req: Request & { user: UserEntity }): Promise<{
    secret: string;
    otpauthUrl: string;
  }> {
    return await this.authService.generate2faSecret(req.user);
  }

  /** POST /auth/2fa/toggle : active ou désactive la 2FA après vérification d'un code (ou d'un code de secours pour désactiver) ; retourne le nouvel état et, à l'activation, les codes de secours. */
  @Post('2fa/toggle')
  @UseGuards(AccessTokenGuard)
  async toggle2fa(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: ToggleTwoFactorDto,
  ): Promise<{ enabled: boolean; recoveryCodes: string[] | null }> {
    return await this.authService.toggle2fa(req.user, dto);
  }

  /** POST /auth/2fa/use-recovery-code : comme 2fa/verify mais avec un code de secours à usage unique (appli d'authentification perdue). */
  @Post('2fa/use-recovery-code')
  @UseGuards(PreAuthTokenGuard)
  async useRecoveryCode(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: RecoveryCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    user: UserEntity;
    accessToken: string;
    remainingRecoveryCodes: number;
  }> {
    const remainingRecoveryCodes = await this.authService.useRecoveryCode(
      req.user,
      dto.recoveryCode,
    );
    const tokens = await this.authService.createTokens(req.user);
    await this.setRefreshCookie(req.user, res, tokens.refreshToken);
    res.clearCookie('preAuthToken', { path: '/auth' });
    return {
      user: req.user,
      accessToken: tokens.accessToken,
      remainingRecoveryCodes,
    };
  }

  /** GET /auth/2fa/recovery-codes : nombre de codes de secours encore utilisables (les codes eux-mêmes ne sont jamais relisibles). */
  @Get('2fa/recovery-codes')
  @UseGuards(AccessTokenGuard)
  async recoveryCodesStatus(
    @Req() req: Request & { user: UserEntity },
  ): Promise<{ remaining: number }> {
    return { remaining: await this.authService.countRecoveryCodes(req.user) };
  }

  /** POST /auth/2fa/recovery-codes/regenerate : après re-confirmation (code TOTP ou mot de passe), remplace les codes de secours et retourne le nouveau lot, visible une seule fois. */
  @Post('2fa/recovery-codes/regenerate')
  @UseGuards(AccessTokenGuard)
  async regenerateRecoveryCodes(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: RegenerateRecoveryCodesDto,
  ): Promise<{ recoveryCodes: string[] }> {
    return {
      recoveryCodes: await this.authService.regenerateRecoveryCodes(
        req.user,
        dto,
      ),
    };
  }

  /** Indique si les cookies doivent être « secure » (production ou frontend en https). */
  private useSecureCookies(): boolean {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    return (
      process.env.NODE_ENV === 'production' ||
      frontendUrl.startsWith('https://')
    );
  }

  /** Pose le cookie httpOnly du refresh token (durée depuis la config) et efface le cookie de pré-authentification. */
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
      throw new UnauthorizedException({
        message: 'Refresh token expiration time is not set',
        code: 'SERVER_CONFIG_ERROR',
      });
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

  /** Pose le cookie httpOnly du token de pré-authentification 2FA (durée depuis la config). */
  private setPreAuthCookie(res: Response, preAuthToken: string): void {
    const expirationTime = this.configService.get<msStringValue>(
      'JWT_PRE_AUTH_TOKEN_EXPIRATION_TIME',
    );
    if (!expirationTime) {
      throw new UnauthorizedException({
        message: 'Pre-auth token expiration time is not set',
        code: 'SERVER_CONFIG_ERROR',
      });
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
