import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role, UserEntity } from '../users/entities/users.entity';
import { AdminUsersService } from './services/admin-users.service';
import { AdminUsersQueryDto } from './dtos/admin-users-query.dto';
import { CreateAdminUserDto } from './dtos/create-admin-user.dto';
import { UpdateAdminUserDto } from './dtos/update-admin-user.dto';

/** [Major · Permissions avancées] Contrôleur HTTP de l'administration des utilisateurs (CRUD réservé aux admins) : routes REST protégées par les guards d'authentification. */
@Controller('admin/users')
@AuthRoles(Role.ADMIN)
export class AdminUsersController {
  /** Injecte les dépendances : AdminUsersService. */
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /** [Major · Permissions avancées] GET /admin/users?q=&page=&limit= : page d'utilisateurs, recherche par nom, email ou login 42. */
  @Get()
  list(@Query() query: AdminUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  /** [Major · Permissions avancées] GET /admin/users/:id : détail d'un utilisateur. */
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.adminUsersService.getById(id);
  }

  /** [Major · Permissions avancées] POST /admin/users : crée un compte. */
  @Post()
  create(@Body() dto: CreateAdminUserDto) {
    return this.adminUsersService.create(dto);
  }

  /** [Major · Permissions avancées] PATCH /admin/users/:id : modifie nom, email, rôle ou mot de passe. */
  @Patch(':id')
  update(
    @Req() req: Request & { user: UserEntity },
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminUsersService.update(req.user.id, id, dto);
  }

  /** [Major · Permissions avancées] DELETE /admin/users/:id : supprime (anonymise) le compte, comme le fait l'utilisateur lui-même. */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request & { user: UserEntity },
    @Param('id') id: string,
  ) {
    await this.adminUsersService.remove(req.user.id, id);
    return { message: 'Account deleted' };
  }
}
