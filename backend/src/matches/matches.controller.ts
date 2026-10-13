import {
  Body,
  Controller,
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
import { Role, UserEntity } from '../users/entities/user.entity';
import { MatchesService } from './services/matches.service';
import { HistoryQueryDto } from './dtos/history-query.dto';
import { ProposeMatchDto } from './dtos/propose-match.dto';
import { RespondMatchDto } from './dtos/respond-match.dto';
import { SubmitScoreDto } from './dtos/submit-score.dto';
import { ValidateScoreDto } from './dtos/validate-score.dto';

/** [Minor · Stats et historique] Contrôleur HTTP des matchs (défis, scores, Elo, historique) : routes REST protégées par les guards d'authentification. */
@Controller('matches')
@UseGuards(AccessTokenGuard)
export class MatchesController {
  /** Injecte les dépendances : MatchesService. */
  constructor(private readonly matchesService: MatchesService) {}

  /** [Minor · Stats et historique] GET /matches/me?page=&limit= : page des défis de ladder de l'utilisateur connecté (hors manches de tournoi et défis refusés). */
  @Get('me')
  listMine(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.matchesService.listMine(req.user.id, query);
  }

  /** [Minor · Stats et historique] GET /matches/me/history?page=&limit=&q=&result=&format=&source=&sort= : page filtrée et triée de l'historique des matchs terminés de l'utilisateur (ladder + tournois). */
  @Get('me/history')
  listHistory(
    @Req() req: Request & { user: UserEntity },
    @Query() query: HistoryQueryDto,
  ) {
    return this.matchesService.listHistory(req.user.id, query);
  }

  /** [Minor · Stats et historique] GET /matches/me/pending-actions : nombre de défis qui attendent une action de l'utilisateur. */
  @Get('me/pending-actions')
  countPendingActions(@Req() req: Request & { user: UserEntity }) {
    return this.matchesService.countActionable(req.user.id);
  }

  /** [Minor · Stats et historique] GET /matches/:matchId : détail d'un match, réservé à ses participants. */
  @Get(':matchId')
  getOne(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
  ) {
    return this.matchesService.getForUser(req.user.id, matchId);
  }

  /** [Minor · Stats et historique] POST /matches : l'utilisateur connecté défie un adversaire (avec un coéquipier en 2v2). */
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

  /** [Minor · Stats et historique] POST /matches/:matchId/respond : le joueur défié accepte ou refuse le défi. */
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

  /** [Minor · Stats et historique] POST /matches/:matchId/score : un participant soumet le score, à valider par l'autre équipe. */
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

  /** [Minor · Tournois] POST /matches/:matchId/admin-score (admin) : saisit le score d'une manche de tournoi, qui est alors terminée (les joueurs ne peuvent pas saisir les scores de tournoi). */
  @Post(':matchId/admin-score')
  @AuthRoles(Role.ADMIN)
  submitTournamentScore(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
    @Body() dto: SubmitScoreDto,
  ) {
    return this.matchesService.submitTournamentScoreAsAdmin(
      req.user.id,
      matchId,
      dto.scoreA,
      dto.scoreB,
    );
  }

  /** [Minor · Tournois] PATCH /matches/:matchId/admin-score (admin) : corrige le score d'une manche de tournoi déjà terminée ; le tournoi est recalculé (ou la correction refusée si le tour suivant a commencé). */
  @Patch(':matchId/admin-score')
  @AuthRoles(Role.ADMIN)
  correctTournamentScore(
    @Param('matchId') matchId: string,
    @Body() dto: SubmitScoreDto,
  ) {
    return this.matchesService.correctTournamentScoreAsAdmin(
      matchId,
      dto.scoreA,
      dto.scoreB,
    );
  }

  /** [Minor · Stats et historique] POST /matches/:matchId/validate : l'équipe adverse valide ou conteste le score soumis. */
  @Post(':matchId/validate')
  validateScore(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
    @Body() dto: ValidateScoreDto,
  ) {
    return this.matchesService.validateScore(req.user.id, matchId, dto.accept);
  }
}
