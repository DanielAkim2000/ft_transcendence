import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { BanService } from '../ban/services/ban.service';
import { UsersService } from '../users/services/users.services';
import { UserEntity } from '../users/entities/users.entity';
import { Profile42Dto } from './dtos/profile42.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue as msStringValue } from 'ms';
import { RegisterDto } from './dtos/register.dto';
import { ToggleTwoFactorDto } from './dtos/toggle-two-factor.dto';
import { RegenerateRecoveryCodesDto } from './dtos/regenerate-recovery-codes.dto';
import { LoginDto } from './dtos/login.dto';
import * as bcrypt from 'bcrypt';
import { verify, generateSecret, generateURI } from 'otplib';
import { hashRefreshToken, hashToken } from './utils/utils';
import { MailService } from '../mail/mail.service';
import { authMails } from './auth.messages';
import type { MailLanguage } from '../gdprs/gdpr.messages';

const PASSWORD_RESET_TTL_MINUTES = 60;
const PASSWORD_RESET_COOLDOWN_MS = 60_000;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;
// 32 symboles (2^5) sans caractères ambigus (0/O, 1/I) : chaque octet aléatoire se ramène à un symbole sans biais.
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** [Major · Gestion des utilisateurs] Service métier de l'authentification (inscription, connexion, tokens, mot de passe). */
@Injectable()
export class AuthService {
  private readonly lastResetRequestAt = new Map<string, number>();

  /** [Major · Gestion des utilisateurs] Injecte les dépendances : UsersService, JwtService, ConfigService, MailService. */
  constructor(
    private readonly usersService: UsersService,
    private readonly banService: BanService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /** [Major · Gestion des utilisateurs] Crée l'utilisateur puis génère ses tokens de session. */
  async register(registerDto: RegisterDto): Promise<{
    user: UserEntity;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    const user =
      await this.usersService.createUserFromRegisterInfo(registerDto);
    const tokens = await this.createTokens(user);
    return { user, tokens };
  }

  /** [Minor · 2FA] Signe un JWT de courte durée prouvant que le mot de passe est validé, en attente du code 2FA. */
  async createPreAuthToken(user: UserEntity): Promise<string> {
    const secret = this.configService.get<string>('JWT_PRE_AUTH_TOKEN_SECRET');
    const expiresIn = this.configService.get<msStringValue>(
      'JWT_PRE_AUTH_TOKEN_EXPIRATION_TIME',
    );
    if (!secret || !expiresIn) {
      throw new InternalServerErrorException({
        message: 'Pre-auth token configuration is missing',
        code: 'SERVER_CONFIG_ERROR',
      });
    }

    return this.jwtService.signAsync<{ userId: string }>(
      { userId: user.id },
      { secret, expiresIn },
    );
  }

  /** [Major · Permissions avancées] Lève une ForbiddenException (code BAN, motif et date de fin, null si permanent) si l'utilisateur est banni : le client peut ainsi expliquer le ban au lieu d'afficher une erreur générique. */
  async assertNotBanned(userId: string): Promise<void> {
    const ban = await this.banService.findActiveBan(userId);
    if (ban) {
      throw new ForbiddenException({
        message: 'Your account is banned',
        code: 'BAN',
        reason: ban.reason,
        endTime: ban.endTime,
      });
    }
  }

  /** [Major · Gestion des utilisateurs] Signe l'access token et le refresh token de l'utilisateur et stocke le hash du refresh token en base. */
  async createTokens(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    await this.assertNotBanned(user.id);

    const accessTokenExpirationTime = this.configService.get<msStringValue>(
      'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
    );
    const refreshTokenExpirationTime = this.configService.get<msStringValue>(
      'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
    );
    const accessTokenSecret = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_SECRET',
    );
    const refreshTokenSecret = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_SECRET',
    );

    if (
      !accessTokenExpirationTime ||
      !refreshTokenExpirationTime ||
      !accessTokenSecret ||
      !refreshTokenSecret
    ) {
      throw new InternalServerErrorException({
        message: 'JWT configuration is missing',
        code: 'SERVER_CONFIG_ERROR',
      });
    }

    const accessToken = await this.jwtService.signAsync<{ userId: string }>(
      { userId: user.id },
      {
        secret: accessTokenSecret,
        expiresIn: accessTokenExpirationTime,
      },
    );
    const refreshToken = await this.jwtService.signAsync<{ userId: string }>(
      { userId: user.id },
      {
        secret: refreshTokenSecret,
        expiresIn: refreshTokenExpirationTime,
        // Identifiant unique : sans lui, deux connexions dans la même seconde
        // produisent le même jeton (même userId, même iat) et la contrainte
        // d'unicité du hash en base fait échouer la seconde en erreur 500.
        jwtid: randomUUID(),
      },
    );

    const expiresAt = new Date(Date.now() + ms(refreshTokenExpirationTime));
    await this.usersService.addRefreshToken(
      user.id,
      hashRefreshToken(refreshToken),
      expiresAt,
    );

    return { accessToken, refreshToken };
  }

  /** [Minor · OAuth 42] Retourne l'utilisateur lié au login 42 du profil, en le créant à la première connexion. */
  async validateUserFrom42Profile(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile42Dto,
  ): Promise<UserEntity> {
    const existing = await this.usersService.findUserByLogin(
      profile._json.login,
    );
    if (existing) {
      return existing;
    }
    return this.usersService.createUserFrom42Profile(profile);
  }

  /** [Major · Gestion des utilisateurs] Retrouve l'utilisateur d'un payload JWT ou lève une UnauthorizedException. */
  async validateUserFromToken(userId: string): Promise<UserEntity> {
    const user = await this.usersService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    await this.assertNotBanned(user.id);
    return user;
  }

  /** [Major · Gestion des utilisateurs] Vérifie email et mot de passe (bcrypt) et retourne l'utilisateur, sinon lève une UnauthorizedException. */
  async validateUserFromLogin(loginDto: LoginDto): Promise<UserEntity> {
    const user = await this.usersService.findUserByEmail(loginDto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }
    // Après le mot de passe seulement : on ne révèle pas le ban à qui ne connaît pas les identifiants.
    await this.assertNotBanned(user.id);

    return user;
  }

  /** [Minor · 2FA] Vérifie le code TOTP de l'utilisateur avec son secret 2FA actif. */
  async verify2fa(user: UserEntity, code: string): Promise<void> {
    await this.assertValidTotp(user.twoFactorSecret, code);
  }

  /** [Minor · 2FA] Lève une UnauthorizedException si le secret est absent ou si le code TOTP est invalide (tolérance d'un pas de temps). */
  private async assertValidTotp(
    secret: string | null,
    code: string,
  ): Promise<void> {
    if (!secret) {
      throw new UnauthorizedException({
        message: 'Two-factor authentication is not set up',
        code: 'TWO_FACTOR_NOT_SET_UP',
      });
    }

    const result = await verify({
      secret,
      token: code,
      epochTolerance: 1,
    });

    if (!result.valid) {
      throw new UnauthorizedException({
        message: 'Invalid two-factor code',
        code: 'INVALID_TWO_FACTOR_CODE',
      });
    }
  }

  /** [Minor · 2FA] Génère un secret TOTP et l'URL otpauth, le stocke comme secret en attente ; refuse si la 2FA est déjà active. */
  async generate2faSecret(
    user: UserEntity,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    if (user.twoFactorEnabled) {
      throw new ConflictException({
        message: 'Two-factor authentication is already enabled',
        code: 'TWO_FACTOR_ALREADY_ENABLED',
      });
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      secret,
      label: user.email,
      issuer: 'ft_transcendence',
    });

    user.twoFactorPendingSecret = secret;
    await this.usersService.updateUser(user);

    return { secret, otpauthUrl };
  }

  /** [Minor · 2FA] Désactive la 2FA (code TOTP ou code de secours requis) ou l'active en confirmant le secret en attente avec un code valide. À l'activation, génère et retourne les codes de secours (seule fois où ils sont visibles). */
  async toggle2fa(
    user: UserEntity,
    dto: ToggleTwoFactorDto,
  ): Promise<{ enabled: boolean; recoveryCodes: string[] | null }> {
    if (user.twoFactorEnabled) {
      if (dto.recoveryCode) {
        await this.consumeRecoveryCode(user.id, dto.recoveryCode);
      } else if (dto.code) {
        await this.assertValidTotp(user.twoFactorSecret, dto.code);
      } else {
        throw new BadRequestException({
          message: 'A code or a recovery code is required',
          code: 'CODE_OR_RECOVERY_REQUIRED',
        });
      }
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorPendingSecret = null;
      await this.usersService.updateUser(user);
      await this.usersService.deleteRecoveryCodes(user.id);
      return { enabled: false, recoveryCodes: null };
    }

    if (!user.twoFactorPendingSecret) {
      throw new BadRequestException({
        message: 'Generate a QR code before enabling two-factor authentication',
        code: 'GENERATE_QR_FIRST',
      });
    }
    if (!dto.code) {
      throw new BadRequestException({
        message: 'A code is required',
        code: 'CODE_REQUIRED',
      });
    }

    await this.assertValidTotp(user.twoFactorPendingSecret, dto.code);
    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = null;
    await this.usersService.updateUser(user);
    const recoveryCodes = await this.issueRecoveryCodes(user.id);
    return { enabled: true, recoveryCodes };
  }

  /** [Minor · 2FA] Génère un nouveau lot de codes de secours (format XXXXX-XXXXX), remplace l'ancien en base (hashs seulement) et retourne les codes en clair. */
  private async issueRecoveryCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const bytes = randomBytes(RECOVERY_CODE_LENGTH);
      const raw = Array.from(
        bytes,
        (byte) => RECOVERY_CODE_ALPHABET[byte & 31],
      ).join('');
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    await this.usersService.replaceRecoveryCodes(
      userId,
      codes.map((code) => this.hashRecoveryCode(code)),
    );
    return codes;
  }

  /** [Minor · 2FA] Hash d'un code de secours après normalisation (casse, tirets et espaces ignorés). */
  private hashRecoveryCode(code: string): string {
    return hashToken(code.replace(/[\s-]/g, '').toUpperCase());
  }

  /** [Minor · 2FA] Consomme un code de secours (usage unique) ; lève une UnauthorizedException s'il est invalide ou déjà utilisé. */
  private async consumeRecoveryCode(
    userId: string,
    code: string,
  ): Promise<void> {
    const consumed = await this.usersService.consumeRecoveryCode(
      userId,
      this.hashRecoveryCode(code),
    );
    if (!consumed) {
      throw new UnauthorizedException({
        message: 'Invalid recovery code',
        code: 'INVALID_RECOVERY_CODE',
      });
    }
  }

  /** [Minor · 2FA] Connexion avec un code de secours à la place du code TOTP : le consomme, prévient l'utilisateur par email et retourne le nombre de codes restants. */
  async useRecoveryCode(user: UserEntity, code: string): Promise<number> {
    await this.consumeRecoveryCode(user.id, code);
    const remaining = await this.usersService.countUnusedRecoveryCodes(user.id);
    const mail = authMails.recoveryCodeUsed(
      this.mailLanguage(user),
      user.displayname,
      remaining,
    );
    await this.mailService.sendQuietly(user.email, mail.subject, mail.text);
    return remaining;
  }

  /** [Minor · 2FA] Nombre de codes de secours encore utilisables. */
  countRecoveryCodes(user: UserEntity): Promise<number> {
    return this.usersService.countUnusedRecoveryCodes(user.id);
  }

  /** [Minor · 2FA] Régénère les codes de secours (les anciens deviennent invalides) après re-confirmation par code TOTP ou mot de passe ; retourne les nouveaux codes. */
  async regenerateRecoveryCodes(
    user: UserEntity,
    dto: RegenerateRecoveryCodesDto,
  ): Promise<string[]> {
    if (!user.twoFactorEnabled) {
      throw new ConflictException({
        message: 'Two-factor authentication is not enabled',
        code: 'TWO_FACTOR_NOT_ENABLED',
      });
    }
    if (dto.code) {
      await this.assertValidTotp(user.twoFactorSecret, dto.code);
    } else if (dto.password) {
      const valid =
        !!user.passwordHash &&
        (await bcrypt.compare(dto.password, user.passwordHash));
      if (!valid)
        throw new UnauthorizedException({
          message: 'Invalid password',
          code: 'INVALID_PASSWORD',
        });
    } else {
      throw new BadRequestException({
        message: 'A code or the password is required',
        code: 'CODE_OR_PASSWORD_REQUIRED',
      });
    }
    return this.issueRecoveryCodes(user.id);
  }

  /** [Major · Gestion des utilisateurs] Supprime le refresh token en base ; lève une UnauthorizedException s'il n'existe pas. */
  async revokeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const deleted = await this.usersService.revokeRefreshToken(
      userId,
      hashRefreshToken(refreshToken),
    );
    if (!deleted) {
      throw new UnauthorizedException({
        message: 'Refresh token not found',
        code: 'SESSION_EXPIRED',
      });
    }
  }

  /** [Major · Gestion des utilisateurs] Vérifie que le refresh token existe en base et n'est pas expiré (il est supprimé s'il l'est). */
  async assertRefreshTokenIsValid(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const stored = await this.usersService.findRefreshToken(
      userId,
      hashRefreshToken(refreshToken),
    );
    if (!stored) {
      throw new UnauthorizedException({
        message: 'Refresh token not found',
        code: 'SESSION_EXPIRED',
      });
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.usersService.revokeRefreshToken(userId, stored.tokenHash);
      throw new UnauthorizedException({
        message: 'Refresh token expired',
        code: 'SESSION_EXPIRED',
      });
    }
  }

  /** [Major · Gestion des utilisateurs] Contrôle et révoque l'ancien refresh token puis en génère une nouvelle paire. */
  async rotateRefreshToken(
    user: UserEntity,
    oldRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    await this.assertRefreshTokenIsValid(user.id, oldRefreshToken);
    await this.revokeRefreshToken(user.id, oldRefreshToken);
    return this.createTokens(user);
  }

  /** [Major · Gestion des utilisateurs] Langue des emails de l'utilisateur, avec repli sur l'anglais. */
  private mailLanguage(user: UserEntity): MailLanguage {
    return user.language === 'fr' || user.language === 'es'
      ? user.language
      : 'en';
  }

  /** [Major · Gestion des utilisateurs] Étape 1 de « mot de passe oublié » : si un compte à mot de passe existe pour cet email, envoie un lien à usage unique valable une heure. Ne révèle jamais si l'email existe (même comportement dans tous les cas). */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findUserByEmail(email);
    if (!user?.passwordHash) return;
    const last = this.lastResetRequestAt.get(user.id) ?? 0;
    if (Date.now() - last < PASSWORD_RESET_COOLDOWN_MS) return;
    this.lastResetRequestAt.set(user.id, Date.now());

    const token = randomBytes(32).toString('hex');
    await this.usersService.savePasswordResetToken(
      user.id,
      hashToken(token),
      new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
    );
    const link = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;
    const mail = authMails.resetPassword(
      this.mailLanguage(user),
      user.displayname,
      link,
      PASSWORD_RESET_TTL_MINUTES,
    );
    await this.mailService.sendQuietly(user.email, mail.subject, mail.text);
  }

  /** [Major · Gestion des utilisateurs] Étape 2 : vérifie le jeton reçu par email, définit le nouveau mot de passe, déconnecte toutes les sessions et prévient l'utilisateur par email. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.usersService.consumePasswordResetToken(
      hashToken(token),
      newPassword,
    );
    if (!user) {
      throw new BadRequestException({
        message: 'Invalid or expired reset link',
        code: 'RESET_LINK_INVALID',
      });
    }
    const mail = authMails.passwordChanged(
      this.mailLanguage(user),
      user.displayname,
    );
    await this.mailService.sendQuietly(user.email, mail.subject, mail.text);
  }
}
