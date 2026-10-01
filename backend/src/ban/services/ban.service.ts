import { Injectable, } from '@nestjs/common';
import { BanRepository } from '../repository/ban.repository';

@Injectable()
export class BanService {
  constructor(
    private readonly banRepository: BanRepository,
  ) {}

  findBanStatus(userId: string) : Promise<boolean> {
    return this.banRepository.findBanStatus(userId);
  }
};
