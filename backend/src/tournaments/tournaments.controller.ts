import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role, UserEntity } from '../users/entities/users.entity';
import { TournamentsService } from './services/tournaments.service';
import { CreateTournamentDto } from './dtos/create-tournament.dto';
import { AddEntryDto } from './dtos/add-entry.dto';
import { ReplacePlayerDto } from './dtos/replace-player.dto';

@Controller('tournaments')
@UseGuards(AccessTokenGuard)
export class TournamentsController {
  /** Injecte les dépendances : TournamentsService. */
  constructor(private readonly tournamentsService: TournamentsService) {}

  /** GET /tournaments?page=&limit= : page des tournois, les plus récents d'abord. */
  @Get()
  listPage(@Query() query: PageQueryDto) {
    return this.tournamentsService.listPage(query);
  }

  /** GET /tournaments/me/pending-actions : nombre de manches à jouer ou valider par l'utilisateur connecté. */
  @Get('me/pending-actions')
  countPendingActions(@Req() req: Request & { user: UserEntity }) {
    return this.tournamentsService.countPendingActions(req.user.id);
  }

  /** GET /tournaments/:id : détail d'un tournoi (entrées, tableau, rencontres). */
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.tournamentsService.getById(id);
  }

  /** POST /tournaments (admin) : crée un tournoi en brouillon avec ses éventuelles entrées initiales. */
  @Post()
  @AuthRoles(Role.ADMIN)
  create(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(
      req.user.id,
      dto.name,
      dto.format,
      dto.twoLegged ?? false,
      dto.entries ?? [],
    );
  }

  /** POST /tournaments/:id/entries (admin) : ajoute un joueur (ou une paire en 2v2) à un tournoi en brouillon. */
  @Post(':id/entries')
  @AuthRoles(Role.ADMIN)
  addEntry(@Param('id') id: string, @Body() dto: AddEntryDto) {
    return this.tournamentsService.addEntry(id, dto.player1Id, dto.player2Id);
  }

  /** DELETE /tournaments/:id/entries/:entryId (admin) : retire une entrée d'un tournoi en brouillon. */
  @Delete(':id/entries/:entryId')
  @AuthRoles(Role.ADMIN)
  removeEntry(@Param('id') id: string, @Param('entryId') entryId: string) {
    return this.tournamentsService.removeEntry(id, entryId);
  }

  /** PATCH /tournaments/:id/entries/:entryId/player (admin) : remplace un joueur de l'équipe (brouillon, en file ou en cours). */
  @Patch(':id/entries/:entryId/player')
  @AuthRoles(Role.ADMIN)
  replacePlayer(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: ReplacePlayerDto,
  ) {
    return this.tournamentsService.replacePlayer(
      id,
      entryId,
      dto.playerId,
      dto.replacementId,
    );
  }

  /** POST /tournaments/:id/launch (admin) : tire au sort le tableau et démarre le tournoi. */
  @Post(':id/launch')
  @AuthRoles(Role.ADMIN)
  launch(@Param('id') id: string) {
    return this.tournamentsService.launch(id);
  }

  /** POST /tournaments/:id/cancel (admin) : annule le tournoi et libère les tables réservées. */
  @Post(':id/cancel')
  @AuthRoles(Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.tournamentsService.cancel(id);
  }
}
