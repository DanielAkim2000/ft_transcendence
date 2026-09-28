import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/services/users.services';
import { UserEntity } from '../users/entities/users.entity';
import { Profile42Dto } from './dtos/profile42.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue as msStringValue } from 'ms';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import * as bcrypt from 'bcrypt';
import { verify, generateSecret, generateURI } from 'otplib';
import { hashRefreshToken } from './utils/utils';

@Injectable()
export class AuthService {
  /** Injecte les dépendances : UsersService, JwtService, ConfigService. */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Crée l'utilisateur puis génère ses tokens de session. */
  async register(registerDto: RegisterDto): Promise<{
    user: UserEntity;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    const user =
      await this.usersService.createUserFromRegisterInfo(registerDto);
    const tokens = await this.createTokens(user);
    return { user, tokens };
  }

  /** Signe un JWT de courte durée prouvant que le mot de passe est validé, en attente du code 2FA. */
  async createPreAuthToken(user: UserEntity): Promise<string> {
    const secret = this.configService.get<string>('JWT_PRE_AUTH_TOKEN_SECRET');
    const expiresIn = this.configService.get<msStringValue>(
      'JWT_PRE_AUTH_TOKEN_EXPIRATION_TIME',
    );
    if (!secret || !expiresIn) {
      throw new InternalServerErrorException(
        'Pre-auth token configuration is missing',
      );
    }

    return this.jwtService.signAsync<{ userId: string }>(
      { userId: user.id },
      { secret, expiresIn },
    );
  }

  /** Signe l'access token et le refresh token de l'utilisateur et stocke le hash du refresh token en base. */
  async createTokens(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
      throw new InternalServerErrorException('JWT configuration is missing');
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

  /** Retourne l'utilisateur lié au login 42 du profil, en le créant à la première connexion. */
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

  /** Retrouve l'utilisateur d'un payload JWT ou lève une UnauthorizedException. */
  async validateUserFromToken(userId: string): Promise<UserEntity> {
    const user = await this.usersService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  /** Vérifie email et mot de passe (bcrypt) et retourne l'utilisateur, sinon lève une UnauthorizedException. */
  async validateUserFromLogin(loginDto: LoginDto): Promise<UserEntity> {
    const user = await this.usersService.findUserByEmail(loginDto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  /** Vérifie le code TOTP de l'utilisateur avec son secret 2FA actif. */
  async verify2fa(user: UserEntity, code: string): Promise<void> {
    await this.assertValidTotp(user.twoFactorSecret, code);
  }

  /** Lève une UnauthorizedException si le secret est absent ou si le code TOTP est invalide (tolérance d'un pas de temps). */
  private async assertValidTotp(
    secret: string | null,
    code: string,
  ): Promise<void> {
    if (!secret) {
      throw new UnauthorizedException(
        'Two-factor authentication is not set up',
      );
    }

    const result = await verify({
      secret,
      token: code,
      epochTolerance: 1,
    });

    if (!result.valid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }
  }

  /** Génère un secret TOTP et l'URL otpauth, le stocke comme secret en attente ; refuse si la 2FA est déjà active. */
  async generate2faSecret(
    user: UserEntity,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    if (user.twoFactorEnabled) {
      throw new ConflictException(
        'Two-factor authentication is already enabled',
      );
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

  /** Désactive la 2FA (code requis) ou l'active en confirmant le secret en attente avec un code valide ; retourne le nouvel état. */
  async toggle2fa(user: UserEntity, code: string): Promise<boolean> {
    if (user.twoFactorEnabled) {
      await this.assertValidTotp(user.twoFactorSecret, code);
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorPendingSecret = null;
      await this.usersService.updateUser(user);
      return false;
    }

    if (!user.twoFactorPendingSecret) {
      throw new BadRequestException(
        'Generate a QR code before enabling two-factor authentication',
      );
    }

    await this.assertValidTotp(user.twoFactorPendingSecret, code);
    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = null;
    await this.usersService.updateUser(user);
    return true;
  }

  /** Supprime le refresh token en base ; lève une UnauthorizedException s'il n'existe pas. */
  async revokeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const deleted = await this.usersService.revokeRefreshToken(
      userId,
      hashRefreshToken(refreshToken),
    );
    if (!deleted) {
      throw new UnauthorizedException('Refresh token not found');
    }
  }

  /** Vérifie que le refresh token existe en base et n'est pas expiré (il est supprimé s'il l'est). */
  async assertRefreshTokenIsValid(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const stored = await this.usersService.findRefreshToken(
      userId,
      hashRefreshToken(refreshToken),
    );
    if (!stored) {
      throw new UnauthorizedException('Refresh token not found');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.usersService.revokeRefreshToken(userId, stored.tokenHash);
      throw new UnauthorizedException('Refresh token expired');
    }
  }

  /** Contrôle et révoque l'ancien refresh token puis en génère une nouvelle paire. */
  async rotateRefreshToken(
    user: UserEntity,
    oldRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    await this.assertRefreshTokenIsValid(user.id, oldRefreshToken);
    await this.revokeRefreshToken(user.id, oldRefreshToken);
    return this.createTokens(user);
  }
}
