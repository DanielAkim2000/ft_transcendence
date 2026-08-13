import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/services/users.services';
import { UserEntity } from '../users/entities/users.entity';
import { Profile42Dto } from './dtos/profile42.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createTokens(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      let accessTokenExpirationTime = this.configService.get<string>(
        'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
      );
      let refreshTokenExpirationTime = this.configService.get<string>(
        'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
      );
      if (!accessTokenExpirationTime || !refreshTokenExpirationTime) {
        accessTokenExpirationTime = '1h';
        refreshTokenExpirationTime = '7d';
      }
      return {
        accessToken: await this.jwtService.signAsync<{ userId: string }>(
          { userId: user.id },
          {
            secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
            expiresIn: parseInt(accessTokenExpirationTime),
          },
        ),
        refreshToken: await this.jwtService.signAsync<{ userId: string }>(
          { userId: user.id },
          {
            secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
            expiresIn: parseInt(refreshTokenExpirationTime),
          },
        ),
      };
    } catch (error) {
      this.logger.error('Failed to create tokens', error);
      throw new UnauthorizedException('Failed to create tokens');
    }
  }

  async validateUser(
    accessToken: string,
    refreshToken: string,
    profile: Profile42Dto,
  ): Promise<UserEntity> {
    try {
      let user = await this.usersService.findUserByLogin(profile._json.login);
      if (!user) {
        user = await this.usersService.createUserFrom42Profile(profile);
      }
      return user;
    } catch (error) {
      this.logger.error('Failed to validate user', error);
      throw new UnauthorizedException('Failed to validate user');
    }
  }
}
