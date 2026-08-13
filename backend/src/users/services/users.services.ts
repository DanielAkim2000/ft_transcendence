import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../repositories/users.repository';
import { UserEntity } from '../entities/users.entity';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private readonly userRepository: UserRepository) {}

  async findUserByLogin(login: string): Promise<UserEntity> {
    try {
      return await this.userRepository.findUserByLogin(login);
    } catch (error) {
      this.logger.error('Failed to find user by login', error);
      throw new UnauthorizedException('Failed to find user by login');
    }
  }

  async createUserFrom42Profile(profile: Profile42Dto): Promise<UserEntity> {
    try {
      return await this.userRepository.createUserFrom42Profile(profile);
    } catch (error) {
      this.logger.error('Failed to create user from 42 profile', error);
      throw new UnauthorizedException('Failed to create user from 42 profile');
    }
  }
}
