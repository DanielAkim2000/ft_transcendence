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
import { AuthRoles } from '../auth/decorators/auth-roles.decorator';
import { Role } from '../users/entities/user.entity';
import { BanService } from './services/ban.service';

@Controller('ban')
@AuthRoles(Role.ADMIN)
export class BanController {
  contructor(private readonly banService: BanService) {}

  @Get('users/:userid')
  async ()
}
