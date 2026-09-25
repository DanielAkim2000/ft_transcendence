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
import { Role, UserEntity } from '../users/entities/users.entity';
import { TournamentsService } from './services/tournaments.service';
import { CreateTournamentDto } from './dtos/create-tournament.dto';
import { AddEntryDto } from './dtos/add-entry.dto';

@Controller('tournaments')
@UseGuards(AccessTokenGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  listAll() {
    return this.tournamentsService.listAll();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.tournamentsService.getById(id);
  }

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

  @Post(':id/entries')
  @AuthRoles(Role.ADMIN)
  addEntry(@Param('id') id: string, @Body() dto: AddEntryDto) {
    return this.tournamentsService.addEntry(id, dto.player1Id, dto.player2Id);
  }

  @Delete(':id/entries/:entryId')
  @AuthRoles(Role.ADMIN)
  removeEntry(@Param('id') id: string, @Param('entryId') entryId: string) {
    return this.tournamentsService.removeEntry(id, entryId);
  }

  @Post(':id/launch')
  @AuthRoles(Role.ADMIN)
  launch(@Param('id') id: string) {
    return this.tournamentsService.launch(id);
  }

  @Post(':id/cancel')
  @AuthRoles(Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.tournamentsService.cancel(id);
  }
}
