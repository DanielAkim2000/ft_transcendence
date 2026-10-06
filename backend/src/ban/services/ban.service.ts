import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { BanRepository } from '../repositories/ban.repository';
import { CreateBanDto } from '../dto/create-ban.dto';
import { Ban } from '../../generated/prisma/client';
import { UsersService } from '../../users/services/users.services';

@Injectable()
export class BanService {
  constructor(
    private readonly banRepository: BanRepository,
    private readonly usersService: UsersService,
  ) {}

  async findBanStatus(userId: string) : Promise<boolean> {
    return await this.banRepository.findBanStatus(userId) !== null;
  }

  async findActiveBan(userId: string) : Promise<Ban | null> {
    return await this.banRepository.findBanStatus(userId);
  }

  findBans(userId: string) : Promise<Ban[]> {
    return this.banRepository.findBans(userId);
  }

  async banUser(userId: string, dto: CreateBanDto) : Promise<void> {
    const user = await this.usersService.findUserById(userId);
    if (user === null) {
      throw new NotFoundException();
    }
    if (user.role === "ADMIN") {
      throw new ForbiddenException();
    }
    const banStatus = await this.findBanStatus(userId);
    if (banStatus) {
      throw new ConflictException();
    }
    return this.banRepository.create(userId, dto);
  }

  async unbanUser(userId: string) : Promise<void> {
    if (await this.banRepository.unbanUser(userId) === 0) {
      throw new NotFoundException();
    }
  }
};
