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
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role } from '../users/entities/users.entity';
import { TablesService } from './services/tables.service';
import { TableNameDto } from './dtos/table-name.dto';

/** [Socle produit babyfoot (hors module)] Contrôleur HTTP des tables de babyfoot : routes REST protégées par les guards d'authentification. */
@Controller('tables')
@UseGuards(AccessTokenGuard)
export class TablesController {
  /** Injecte les dépendances : TablesService. */
  constructor(private readonly tablesService: TablesService) {}

  /** [Socle produit babyfoot (hors module)] GET /tables : liste toutes les tables avec leur statut, leur format et les groupes présents. */
  @Get()
  list() {
    return this.tablesService.list();
  }

  /** [Socle produit babyfoot (hors module)] POST /tables (admin) : crée une table. */
  @Post()
  @AuthRoles(Role.ADMIN)
  create(@Body() dto: TableNameDto) {
    return this.tablesService.create(dto.name);
  }

  /** [Socle produit babyfoot (hors module)] PATCH /tables/:id (admin) : renomme une table. */
  @Patch(':id')
  @AuthRoles(Role.ADMIN)
  rename(@Param('id') id: string, @Body() dto: TableNameDto) {
    return this.tablesService.rename(id, dto.name);
  }

  /** [Socle produit babyfoot (hors module)] DELETE /tables/:id (admin) : supprime une table qui n'est pas utilisée. */
  @Delete(':id')
  @AuthRoles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.tablesService.remove(id);
    return { message: 'Table deleted' };
  }
}
