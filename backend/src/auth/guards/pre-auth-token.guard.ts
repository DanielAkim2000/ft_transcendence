import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { UserEntity } from '../../users/entities/users.entity';
import { PRE_AUTH_TOKEN_STRATEGY } from '../constants/injection-tokens';

@Injectable()
export class PreAuthTokenGuard extends AuthGuard(PRE_AUTH_TOKEN_STRATEGY) {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = UserEntity>(
    err: Error | null,
    user: UserEntity | false | null,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Pre auth token invalide');
    }
    return user as TUser;
  }
}
