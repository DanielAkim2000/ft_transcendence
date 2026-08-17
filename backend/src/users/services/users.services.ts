import { ConflictException, Injectable } from '@nestjs/common';
import { UserRepository } from '../repositories/users.repository';
import { RefreshToken, UserEntity } from '../entities/users.entity';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';
import { RegisterDto } from '../../auth/dtos/register.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findUserById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findUserById(id);
  }

  findUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findUserByEmail(email);
  }

  findUserByLogin(login: string): Promise<UserEntity | null> {
    return this.userRepository.findUserByLogin(login);
  }

  createUserFrom42Profile(profile: Profile42Dto): Promise<UserEntity> {
    return this.userRepository.createUserFrom42Profile(profile);
  }

  async createUserFromRegisterInfo(
    registerDto: RegisterDto,
  ): Promise<UserEntity> {
    try {
      const passwordHash = await bcrypt.hash(registerDto.password, 10);
      const user = new UserEntity({
        email: registerDto.email,
        displayname: registerDto.username,
        passwordHash,
      });
      return await this.userRepository.createUserFromRegisterInfo(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  updateUser(user: UserEntity): Promise<UserEntity> {
    return this.userRepository.updateUser(user);
  }

  addRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.userRepository.addRefreshToken(userId, tokenHash, expiresAt);
  }

  async revokeRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    return this.userRepository.deleteRefreshToken(userId, tokenHash);
  }

  findRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    return this.userRepository.findRefreshToken(userId, tokenHash);
  }
}
