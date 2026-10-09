import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role } from '../users/entities/users.entity';
import { BanService } from './services/ban.service';
import { CreateBanDto } from './dto/create-ban.dto';

@Controller('ban')
@AuthRoles(Role.ADMIN)
export class BanController {
  /** Injecte les dépendances : BanService. */
  constructor(private readonly banService: BanService) {}

  /** GET /ban/:userId : ban en cours de l'utilisateur (`ban` vaut null s'il n'est pas banni). */
  @Get(':userId')
  async getActiveBan(@Param('userId') userId: string) {
    return { ban: await this.banService.findActiveBan(userId) };
  }

  /** GET /ban/:userId/history : tous les bans de l'utilisateur, du plus récent au plus ancien. */
  @Get(':userId/history')
  getBanHistory(@Param('userId') userId: string) {
    return this.banService.findBans(userId);
  }

  /** POST /ban/:userId : bannit l'utilisateur (durationHours = 0 pour un ban permanent). */
  @Post(':userId')
  ban(@Param('userId') userId: string, @Body() dto: CreateBanDto) {
    return this.banService.banUser(userId, dto);
  }

  /** POST /ban/:userId/unban : lève le ban en cours. */
  @Post(':userId/unban')
  async unban(@Param('userId') userId: string) {
    await this.banService.unbanUser(userId);
    return { message: 'Ban lifted' };
  }
}
