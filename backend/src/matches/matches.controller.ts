import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { MatchesService } from './services/matches.service';
import { ProposeMatchDto } from './dtos/propose-match.dto';
import { RespondMatchDto } from './dtos/respond-match.dto';
import { SubmitScoreDto } from './dtos/submit-score.dto';
import { ValidateScoreDto } from './dtos/validate-score.dto';

@Controller('matches')
@UseGuards(AccessTokenGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('me')
  listMine(@Req() req: Request & { user: UserEntity }) {
    return this.matchesService.listMine(req.user.id);
  }

  @Get('me/history')
  listHistory(@Req() req: Request & { user: UserEntity }) {
    return this.matchesService.listHistory(req.user.id);
  }

  @Get(':matchId')
  getOne(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
  ) {
    return this.matchesService.getForUser(req.user.id, matchId);
  }

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

  @Post(':matchId/validate')
  validateScore(
    @Req() req: Request & { user: UserEntity },
    @Param('matchId') matchId: string,
    @Body() dto: ValidateScoreDto,
  ) {
    return this.matchesService.validateScore(req.user.id, matchId, dto.accept);
  }
}
