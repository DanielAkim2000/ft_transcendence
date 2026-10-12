import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { ChessService } from './services/chess.service';
import { CreateGameDto } from './dto/create-game.dto';
import { CreateAiGameDto } from './dto/create-ai-game.dto';

@Controller('chess')
@UseGuards(AccessTokenGuard)
export class ChessController {
  constructor(private readonly chess: ChessService) {}

  @Post('games')
  create(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: CreateGameDto,
  ) {
    return this.chess.createGame(req.user.id, dto);
  }

  @Post('games/ai')
  createAi(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: CreateAiGameDto,
  ) {
    return this.chess.createAiGame(req.user.id, dto);
  }

  @Get('games/me')
  listMine(@Req() req: Request & { user: UserEntity }) {
    return this.chess.listGames(req.user.id);
  }

  @Get('games/:id')
  get(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.getGame(req.user.id, id);
  }

  @Post('games/:id/accept')
  accept(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.acceptGame(req.user.id, id);
  }

  @Post('games/:id/decline')
  decline(@Req() req: Request & { user: UserEntity }, @Param('id') id: string) {
    return this.chess.declineGame(req.user.id, id);
  }
}
