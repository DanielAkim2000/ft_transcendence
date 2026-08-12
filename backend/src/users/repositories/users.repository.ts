import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, Status, UserEntity } from '../entities/users.entity';
import { User } from '../../generated/prisma/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByIntraId(intraId: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        login42: intraId,
      },
    });
    if (!user) {
      return null;
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
