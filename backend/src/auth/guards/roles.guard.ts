import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserEntity } from '../../users/entities/users.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  /** Injecte les dépendances : Reflector. */
  constructor(private readonly reflector: Reflector) {}

  /** Autorise la requête si la route n'exige aucun rôle ou si l'utilisateur authentifié possède l'un des rôles requis ; 401 sans utilisateur, 403 sinon. */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UserEntity }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Access token invalide');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Droits insuffisants');
    }

    return true;
  }
}
