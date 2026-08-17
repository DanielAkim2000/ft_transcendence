import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { AuthService } from '../auth.service';
import { PRE_AUTH_TOKEN_STRATEGY } from '../constants/injection-tokens';
import { PayloadJwtDto } from '../types/payload.type';

@Injectable()
export class PreAuthTokenStrategy extends PassportStrategy(
  Strategy,
  PRE_AUTH_TOKEN_STRATEGY,
) {
  private readonly logger = new Logger(PreAuthTokenStrategy.name);

  constructor(private readonly authService: AuthService) {
    const secret = process.env.JWT_PRE_AUTH_TOKEN_SECRET;
    if (!secret) {
      throw new Error('JWT_PRE_AUTH_TOKEN_SECRET is not defined');
    }

    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    };

    super(options);
  }

  async validate(payload: PayloadJwtDto) {
    try {
      return await this.authService.validateUserFromToken(payload.userId);
    } catch (error) {
      this.logger.error('Failed to validate pre auth token', error);
      throw new UnauthorizedException('Failed to validate pre auth token');
    }
  }
}
