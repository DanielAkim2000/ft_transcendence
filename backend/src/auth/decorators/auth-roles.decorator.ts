import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '../../users/entities/users.entity';
import { AccessTokenGuard } from '../guards/access-token.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** [Major · Permissions avancées] Décorateur combiné : exige un access token valide et l'un des rôles donnés. */
export function AuthRoles(...roles: Role[]) {
  return applyDecorators(
    UseGuards(AccessTokenGuard, RolesGuard),
    Roles(...roles),
  );
}
