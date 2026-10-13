import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { REFRESH_TOKEN_STRATEGY } from '../constants/injection-tokens';
import { PayloadJwtDto } from '../types/payload.type';

/** [Major · Gestion des utilisateurs] Stratégie passport de l'authentification (inscription, connexion, tokens, mot de passe). */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  REFRESH_TOKEN_STRATEGY,
) {
  private readonly logger = new Logger(RefreshTokenStrategy.name);

  /** [Major · Gestion des utilisateurs] Injecte les dépendances : AuthService. */
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

  /** [Major · Gestion des utilisateurs] Vérifie que le refresh token du cookie est connu et non expiré, puis retourne l'utilisateur ; il devient req.user. */
  async validate(req: Request, payload: PayloadJwtDto) {
    try {
      /** [Major · Gestion des utilisateurs] Refresh token brut lu dans le cookie de la requête. */
      const rawRefreshToken = (
        req.cookies as Record<string, unknown> | undefined
      )?.refreshToken;
      if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
        throw new UnauthorizedException({
          message: 'Refresh token not found',
          code: 'SESSION_EXPIRED',
        });
      }

      await this.authService.assertRefreshTokenIsValid(
        payload.userId,
        rawRefreshToken,
      );

      return await this.authService.validateUserFromToken(payload.userId);
    } catch (error) {
      // Compte banni : 403 avec le motif, pas un 401 générique.
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('Failed to validate refresh token', error);
      throw new UnauthorizedException({
        message: 'Failed to validate refresh token',
        code: 'SESSION_EXPIRED',
      });
    }
  }
}
