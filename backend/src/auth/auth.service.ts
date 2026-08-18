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
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{
    user: UserEntity;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    const user =
      await this.usersService.createUserFromRegisterInfo(registerDto);
    const tokens = await this.createTokens(user);
    return { user, tokens };
  }

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

  async validateUserFromToken(userId: string): Promise<UserEntity> {
    const user = await this.usersService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

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

  async verify2fa(user: UserEntity, code: string): Promise<void> {
    await this.assertValidTotp(user.twoFactorSecret, code);
  }

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

  async rotateRefreshToken(
    user: UserEntity,
    oldRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    await this.assertRefreshTokenIsValid(user.id, oldRefreshToken);
    await this.revokeRefreshToken(user.id, oldRefreshToken);
    return this.createTokens(user);
  }
}
