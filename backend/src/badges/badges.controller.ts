import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { BadgesService } from './services/badges.service';

@Controller('badges')
@UseGuards(AccessTokenGuard)
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get(':userId')
  getProfile(@Param('userId') userId: string) {
    return this.badgesService.getProfile(userId);
  }
}
