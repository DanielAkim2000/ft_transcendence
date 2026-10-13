import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { UserEntity } from '../../users/entities/users.entity';
import { PRE_AUTH_TOKEN_STRATEGY } from '../constants/injection-tokens';

/** [Minor · 2FA] Guard du token de pré-authentification (cookie posé entre le login et la saisie du code 2FA). */
@Injectable()
export class PreAuthTokenGuard extends AuthGuard(PRE_AUTH_TOKEN_STRATEGY) {
  /** [Minor · 2FA] Délègue la vérification du token à la stratégie Passport. */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /** [Minor · 2FA] Retourne l'utilisateur validé ou lève une UnauthorizedException si le token de pré-authentification est invalide. */
  handleRequest<TUser = UserEntity>(
    err: Error | null,
    user: UserEntity | false | null,
  ): TUser {
    if (err || !user) {
      throw (
        err ??
        new UnauthorizedException({
          message: 'Invalid pre-auth token',
          code: 'SESSION_EXPIRED',
        })
      );
    }
    return user as TUser;
  }
}
