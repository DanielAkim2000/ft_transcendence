import { Controller, Get, Logger, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserEntity } from '../users/entities/users.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  @Get('42/login')
  @UseGuards(AuthGuard('42'))
  login() {}

  @Get('42/callback')
  @UseGuards(AuthGuard('42'))
  callback(
    @Query('code') code: string,
    @Req() req: Request & { user: UserEntity },
  ) {
    this.logger.log(code);
    return req.user;
  }
}
