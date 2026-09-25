import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { TablesService } from './services/tables.service';

@Controller('tables')
@UseGuards(AccessTokenGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  list() {
    return this.tablesService.list();
  }

  @Post(':tableId/occupy')
  occupy(
    @Req() req: Request & { user: UserEntity },
    @Param('tableId') tableId: string,
  ) {
    return this.tablesService.occupy(req.user.id, tableId);
  }

  @Post(':tableId/release')
  release(
    @Req() req: Request & { user: UserEntity },
    @Param('tableId') tableId: string,
  ) {
    return this.tablesService.release(req.user.id, tableId);
  }
}
