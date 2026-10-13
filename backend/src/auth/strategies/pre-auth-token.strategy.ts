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
import type { Request } from 'express';

/** [Minor · 2FA] Stratégie passport du token de pré-authentification utilisé pendant l'étape 2FA. */
@Injectable()
export class PreAuthTokenStrategy extends PassportStrategy(
  Strategy,
  PRE_AUTH_TOKEN_STRATEGY,
) {
  private readonly logger = new Logger(PreAuthTokenStrategy.name);

  /** [Minor · 2FA] Injecte les dépendances : AuthService. */
  constructor(private readonly authService: AuthService) {
    const secret = process.env.JWT_PRE_AUTH_TOKEN_SECRET;
    if (!secret) {
      throw new Error('JWT_PRE_AUTH_TOKEN_SECRET is not defined');
    }

    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = (req.cookies as Record<string, unknown> | undefined)
            ?.preAuthToken;
          return typeof token === 'string' ? token : null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    };

    super(options);
  }

  /** [Minor · 2FA] Retrouve l'utilisateur du payload JWT de pré-authentification ; il devient req.user. */
  async validate(payload: PayloadJwtDto) {
    try {
      return await this.authService.validateUserFromToken(payload.userId);
    } catch (error) {
      this.logger.error('Failed to validate pre auth token', error);
      throw new UnauthorizedException({
        message: 'Failed to validate pre auth token',
        code: 'SESSION_EXPIRED',
      });
    }
  }
}
