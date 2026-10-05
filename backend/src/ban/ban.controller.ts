import {
  ForbiddenException,
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
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role } from '../users/entities/user.entity';
import { BanService } from './services/ban.service';
import { CreateBanDto } from './dto/create-ban.dto';
import { Ban } from '../generated/prisma/client';

@Controller('ban')
@AuthRoles(Role.ADMIN)
export class BanController {
  constructor(private readonly banService: BanService) {}

  @Get(':userId/status')
  async getBanStatus(@Param('userId') userId: string) {
    const ban = await this.banService.findActiveBan(userId);

    if (ban !== null) {
      throw new ForbiddenException({
        code: "BAN",
        reason: ban.reason,
        endTime: ban.endTime,
      });
    }
    return this.banService.findBanStatus(userId);
  }

  @Get(':userId')
  async getActiveBan(@Param('userId') userId: string) {
  }

  @Get(':userId/history')
  getBanHistory(@Param('userId') userId: string) {
    return this.banService.findBans(userId);
  }

  @Post(':userId')
  ban(
    @Param('userId') userId: string,
    @Body() dto: CreateBanDto,
  ) {
    return this.banService.banUser(userId, dto);
  }

  @Post(':userId/unban')
  unban(
    @Param('userId') userId: string,
  ) {
    return this.banService.unbanUser(userId);
  }
}
