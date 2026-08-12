import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findUserByIntraId(intraId: string) {
    const user = await this.userRepository.findUserByIntraId(intraId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
