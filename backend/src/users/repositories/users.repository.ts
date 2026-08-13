import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, Status, UserEntity } from '../entities/users.entity';
import { User } from '../../generated/prisma/client';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByLogin(login: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: {
        login42: login,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.mapUser(user);
  }

  async createUserFrom42Profile(profile: Profile42Dto): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        login42: profile._json.login,
        email: profile._json.email,
        displayname: profile._json.first_name + ' ' + profile._json.last_name,
        avatarUrl: profile._json.image?.link,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Failed to create user from 42 profile');
    }
    return this.mapUser(user);
  }

  private mapUser(user: User): UserEntity {
    let status: Status | null = null;
    switch (user.status) {
      case 'ONLINE':
        status = Status.ONLINE;
        break;
      case 'OFFLINE':
        status = Status.OFFLINE;
        break;
      case 'IN_GAME':
        status = Status.IN_GAME;
        break;
    }
    let role: Role | null = null;
    switch (user.role) {
      case 'ADMIN':
        role = Role.ADMIN;
        break;
      case 'USER':
        role = Role.USER;
        break;
    }
    return new UserEntity({
      id: user.id,
      login42: user.login42,
      email: user.email,
      displayname: user.displayname,
      avatarUrl: user.avatarUrl,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      isOnline: user.isOnline,
      status: status,
      role: role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
