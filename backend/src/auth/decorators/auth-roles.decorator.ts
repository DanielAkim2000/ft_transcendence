import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '../../users/entities/users.entity';
import { AccessTokenGuard } from '../guards/access-token.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

export function AuthRoles(...roles: Role[]) {
  return applyDecorators(
    UseGuards(AccessTokenGuard, RolesGuard),
    Roles(...roles),
  );
}
