import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { ChessService } from './services/chess.service';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { CreateAiGameDto } from './dto/create-ai-game.dto';

/** [Major · Jeu web (Échecs)] Contrôleur HTTP des parties d'échecs : routes REST protégées par les guards d'authentification. */
@Controller('chess')
@UseGuards(AccessTokenGuard)
export class ChessController {
  constructor(private readonly chess: ChessService) {}

  /** [Major · Jeu web (Échecs)] POST /chess/games : envoie un défi de partie à un autre joueur (couleur, pendule, partie classée ou non). */
  @Post('games')
  create(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: CreateGameDto,
  ) {
    return this.chess.createGame(req.user.id, dto);
  }

  /** [Major · Jeu web (Échecs)] POST /chess/games/ai : démarre immédiatement une partie contre l'IA au niveau et à la couleur choisis. */
  @Post('games/ai')
  createAi(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: CreateAiGameDto,
  ) {
    return this.chess.createAiGame(req.user.id, dto);
  }

  /** [Major · Jeu web (Échecs)] GET /chess/games/me : parties en attente ou en cours de l'utilisateur connecté. */
  @Get('games/me')
  listMine(@Req() req: Request & { user: UserEntity }) {
    return this.chess.listGames(req.user.id);
  }

  /** [Major · Jeu web (Échecs)] GET /chess/games/history : historique paginé des parties terminées de l'utilisateur. */
  @Get('games/history')
  history(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.chess.listHistory(req.user.id, query);
  }

  /** [Major · Jeu web (Échecs)] GET /chess/games/:id : détail d'une partie (réservé aux deux joueurs). */
  @Get('games/:id')
  get(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.getGame(req.user.id, id);
  }

  /** [Major · Jeu web (Échecs)] GET /chess/games/:id/moves : liste ordonnée des coups (notation SAN) de la partie. */
  @Get('games/:id/moves')
  moves(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.listMoves(req.user.id, id);
  }

  /** [Major · Jeu web (Échecs)] POST /chess/games/:id/accept : l'adversaire accepte le défi, la partie devient active. */
  @Post('games/:id/accept')
  accept(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.acceptGame(req.user.id, id);
  }

  /** [Major · Jeu web (Échecs)] POST /chess/games/:id/decline : l'adversaire refuse le défi. */
  @Post('games/:id/decline')
  decline(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.declineGame(req.user.id, id);
  }
}
