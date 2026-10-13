import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { UserEntity } from '../../users/entities/users.entity';
import { ACCESS_TOKEN_STRATEGY } from '../constants/injection-tokens';

/** [Major · Gestion des utilisateurs] Guard d'accès de l'authentification (inscription, connexion, tokens, mot de passe). */
@Injectable()
export class AccessTokenGuard extends AuthGuard(ACCESS_TOKEN_STRATEGY) {
  /** [Major · Gestion des utilisateurs] Délègue la vérification du token à la stratégie Passport. */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /** [Major · Gestion des utilisateurs] Retourne l'utilisateur validé ou lève une UnauthorizedException si le access token est invalide. */
  handleRequest<TUser = UserEntity>(
    err: Error | null,
    user: UserEntity | false | null,
  ): TUser {
    if (err || !user) {
      throw (
        err ??
        new UnauthorizedException({
          message: 'Invalid access token',
          code: 'SESSION_EXPIRED',
        })
      );
    }
    return user as TUser;
  }
}
