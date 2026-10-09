import {
  Body,
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
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role } from '../users/entities/users.entity';
import { UserEntity } from '../users/entities/user.entity';
import { QueueService } from './services/queue.service';
import { JoinQueueDto } from './dtos/join-queue.dto';
import { RespondInviteDto } from './dtos/respond-invite.dto';

@Controller('queue')
@UseGuards(AccessTokenGuard)
export class QueueController {
  /** Injecte les dépendances : QueueService. */
  constructor(private readonly queueService: QueueService) {}

  /** GET /queue/me : renvoie le groupe actif de l'utilisateur connecté (invité, en file, appelé ou sur la table), ou null. */
  @Get('me')
  async getMyGroup(@Req() req: Request & { user: UserEntity }) {
    // Nest envoie un corps vide (pas "null") si on retourne null directement.
    return { group: await this.queueService.getMyGroup(req.user.id) };
  }

  /** POST /queue/groups/:groupId/respond : le coéquipier invité accepte ou refuse. */
  @Post('groups/:groupId/respond')
  async respond(
    @Req() req: Request & { user: UserEntity },
    @Param('groupId') groupId: string,
    @Body() dto: RespondInviteDto,
  ) {
    return {
      group: await this.queueService.respondToInvite(
        req.user.id,
        groupId,
        dto.accept,
      ),
    };
  }

  /** POST /queue/groups/:groupId/confirm : le groupe appelé confirme sa présence et prend la table. */
  @Post('groups/:groupId/confirm')
  confirm(
    @Req() req: Request & { user: UserEntity },
    @Param('groupId') groupId: string,
  ) {
    return this.queueService.confirm(req.user.id, groupId);
  }

  /** DELETE /queue/groups/:groupId : quitte la file, refuse l'attente ou sort de la table (hors match en cours). */
  @Delete('groups/:groupId')
  async leave(
    @Req() req: Request & { user: UserEntity },
    @Param('groupId') groupId: string,
  ): Promise<{ ok: true }> {
    await this.queueService.leave(req.user.id, groupId);
    return { ok: true };
  }

  /** POST /queue/:tableId/admin-release (admin) : libère la table de force (match annulé, joueurs sortis, file qui avance). */
  @Post(':tableId/admin-release')
  @AuthRoles(Role.ADMIN)
  adminRelease(@Param('tableId') tableId: string) {
    return this.queueService.adminReleaseTable(tableId);
  }

  /** GET /queue/:tableId : liste les groupes en attente ou appelés pour une table. */
  @Get(':tableId')
  listForTable(@Param('tableId') tableId: string) {
    return this.queueService.listForTable(tableId);
  }

  /** POST /queue/:tableId/join : crée le groupe de l'utilisateur sur la table (format si la table est vide, ami en 2v2). */
  @Post(':tableId/join')
  join(
    @Req() req: Request & { user: UserEntity },
    @Param('tableId') tableId: string,
    @Body() dto: JoinQueueDto,
  ) {
    return this.queueService.join(
      req.user.id,
      tableId,
      dto.format,
      dto.teammateId,
    );
  }

  /** POST /queue/:tableId/release-vote : un joueur du match demande (ou retire sa demande de) libérer la table ; à 2 le match s'arrête. */
  @Post(':tableId/release-vote')
  releaseVote(
    @Req() req: Request & { user: UserEntity },
    @Param('tableId') tableId: string,
  ) {
    return this.queueService.toggleReleaseVote(req.user.id, tableId);
  }
}
