import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/entities/users.entity';

export const ROLES_KEY = 'roles';

/** [Major · Permissions avancées] Décorateur qui enregistre les rôles autorisés sur une route (lus ensuite par RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
