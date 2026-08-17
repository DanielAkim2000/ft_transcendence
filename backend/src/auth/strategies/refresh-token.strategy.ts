import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { REFRESH_TOKEN_STRATEGY } from '../constants/injection-tokens';
import { PayloadJwtDto } from '../types/payload.type';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  REFRESH_TOKEN_STRATEGY,
) {
  private readonly logger = new Logger(RefreshTokenStrategy.name);

  constructor(private readonly authService: AuthService) {
    const secret = process.env.JWT_REFRESH_TOKEN_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_TOKEN_SECRET is not defined');
    }

    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = (req.cookies as Record<string, unknown> | undefined)
            ?.refreshToken;
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    };

    super(options);
  }

  async validate(req: Request, payload: PayloadJwtDto) {
    try {
      const rawRefreshToken = (
        req.cookies as Record<string, unknown> | undefined
      )?.refreshToken;
      if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
        throw new UnauthorizedException('Refresh token not found');
      }

      await this.authService.assertRefreshTokenIsValid(
        payload.userId,
        rawRefreshToken,
      );

      return await this.authService.validateUserFromToken(payload.userId);
    } catch (error) {
      this.logger.error('Failed to validate refresh token', error);
      throw new UnauthorizedException('Failed to validate refresh token');
    }
  }
}
