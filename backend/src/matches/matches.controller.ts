import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { UserEntity } from '../users/entities/user.entity';
import { MatchesService } from './services/matches.service';
import { ProposeMatchDto } from './dtos/propose-match.dto';
import { RespondMatchDto } from './dtos/respond-match.dto';
import { SubmitScoreDto } from './dtos/submit-score.dto';
import { ValidateScoreDto } from './dtos/validate-score.dto';

@Controller('matches')
@UseGuards(AccessTokenGuard)
export class MatchesController {
  /** Injecte les dépendances : MatchesService. */
  constructor(private readonly matchesService: MatchesService) {}

  /** GET /matches/me?page=&limit= : page des défis de ladder de l'utilisateur connecté (hors manches de tournoi et défis refusés). */
  @Get('me')
  listMine(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.matchesService.listMine(req.user.id, query);
  }

  /** GET /matches/me/history?page=&limit= : page de l'historique des matchs terminés de l'utilisateur (ladder + tournois). */
  @Get('me/history')
  listHistory(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.matchesService.listHistory(req.user.id, query);
  }

  /** GET /matches/me/pending-actions : nombre de défis qui attendent une action de l'utilisateur. */
  @Get('me/pending-actions')
  countPendingActions(@Req() req: Request & { user: UserEntity }) {
    return this.matchesService.countActionable(req.user.id);
  }

  /** GET /matches/:matchId : détail d'un match, réservé à ses participants. */
  @Get(':matchId')
  getOne(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
  ) {
    return this.matchesService.getForUser(req.user.id, matchId);
  }

  /** POST /matches : l'utilisateur connecté défie un adversaire (avec un coéquipier en 2v2). */
  @Post()
  propose(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: ProposeMatchDto,
  ) {
    return this.matchesService.propose(
      req.user.id,
      dto.opponentId,
      dto.format,
      dto.teammateId,
    );
  }

  /** POST /matches/:matchId/respond : le joueur défié accepte ou refuse le défi. */
  @Post(':matchId/respond')
  respond(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
    @Body() dto: RespondMatchDto,
  ) {
    return this.matchesService.respond(
      req.user.id,
      matchId,
      dto.accept,
      dto.teammateId,
    );
  }

  /** POST /matches/:matchId/score : un participant soumet le score, à valider par l'autre équipe. */
  @Post(':matchId/score')
  submitScore(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
    @Body() dto: SubmitScoreDto,
  ) {
    return this.matchesService.submitScore(
      req.user.id,
      matchId,
      dto.scoreA,
      dto.scoreB,
    );
  }

  /** POST /matches/:matchId/validate : l'équipe adverse valide ou conteste le score soumis. */
  @Post(':matchId/validate')
  validateScore(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
    @Body() dto: ValidateScoreDto,
  ) {
    return this.matchesService.validateScore(req.user.id, matchId, dto.accept);
  }
}
