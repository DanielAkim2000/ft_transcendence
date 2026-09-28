import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { TablesService } from './services/tables.service';

@Controller('tables')
@UseGuards(AccessTokenGuard)
export class TablesController {
  /** Injecte les dépendances : TablesService. */
  constructor(private readonly tablesService: TablesService) {}

  /** GET /tables : liste toutes les tables avec leur statut, leur format et les groupes présents. */
  @Get()
  list() {
    return this.tablesService.list();
  }
}
