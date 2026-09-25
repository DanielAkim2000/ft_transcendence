import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { QueueService } from './services/queue.service';

@Controller('queue')
@UseGuards(AccessTokenGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('me')
  async getMyEntry(@Req() req: Request & { user: UserEntity }) {
    // Nest envoie un corps vide (pas "null") si on retourne null directement.
    return { entry: await this.queueService.getMyEntry(req.user.id) };
  }

  @Get(':tableId')
  listForTable(@Param('tableId') tableId: string) {
    return this.queueService.listForTable(tableId);
  }

  @Post(':tableId/join')
  join(
    @Req() req: Request & { user: UserEntity },
    @Param('tableId') tableId: string,
  ) {
    return this.queueService.join(req.user.id, tableId);
  }

  @Delete(':entryId')
  async cancel(
    @Req() req: Request & { user: UserEntity },
    @Param('entryId') entryId: string,
  ): Promise<{ ok: true }> {
    await this.queueService.cancel(req.user.id, entryId);
    return { ok: true };
  }
}
