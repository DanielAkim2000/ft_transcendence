import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { AuthService } from '../auth.service';
import { ACCESS_TOKEN_STRATEGY } from '../constants/injection-tokens';
import { PayloadJwtDto } from '../types/payload.type';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  ACCESS_TOKEN_STRATEGY,
) {
  private readonly logger = new Logger(AccessTokenStrategy.name);

  /** Injecte les dépendances : AuthService. */
  constructor(private readonly authService: AuthService) {
    const secret = process.env.JWT_ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined');
    }

    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    };

    super(options);
  }

  /** Retrouve l'utilisateur du payload JWT de l'access token ; il devient req.user. */
  async validate(payload: PayloadJwtDto) {
    try {
      return await this.authService.validateUserFromToken(payload.userId);
    } catch (error) {
      // Compte banni : 403 avec le motif, pas un 401 générique.
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('Failed to validate access token', error);
      throw new UnauthorizedException({
        message: 'Failed to validate access token',
        code: 'SESSION_EXPIRED',
      });
    }
  }
}
