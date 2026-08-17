import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, Status, UserEntity } from '../entities/users.entity';
import { RefreshToken, User } from '../../generated/prisma/client';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';
import { RefreshToken as RefreshTokenEntity } from '../entities/users.entity';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return user ? this.mapUser(user) : null;
  }

  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return user ? this.mapUser(user) : null;
  }

  async findUserByLogin(login: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { login42: login },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return user ? this.mapUser(user) : null;
  }

  async createUserFrom42Profile(profile: Profile42Dto): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        login42: profile._json.login,
        email: profile._json.email,
        displayname: profile._json.first_name + ' ' + profile._json.last_name,
        avatarUrl: profile._json.image?.link,
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return this.mapUser(user);
  }

  async createUserFromRegisterInfo(user: UserEntity): Promise<UserEntity> {
    const newUser = await this.prisma.user.create({
      data: {
        email: user.email,
        displayname: user.displayname,
        passwordHash: user.passwordHash,
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return this.mapUser(newUser);
  }

  async updateUser(user: UserEntity): Promise<UserEntity> {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorSecret: user.twoFactorSecret,
        isOnline: user.isOnline,
        status: user.status,
        role: user.role,
        avatarUrl: user.avatarUrl,
        passwordHash: user.passwordHash,
        displayname: user.displayname,
        email: user.email,
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return this.mapUser(updatedUser);
  }

  async addRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async deleteRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        tokenHash,
      },
    });
    return result.count > 0;
  }

  async findRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<RefreshTokenEntity | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!refreshToken || refreshToken.userId !== userId) {
      return null;
    }
    return new RefreshTokenEntity({
      id: refreshToken.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
      createdAt: refreshToken.createdAt,
    });
  }

  private mapUser(user: User & { refreshTokens: RefreshToken[] }): UserEntity {
    let status: Status = Status.OFFLINE;
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
    let role: Role = Role.USER;
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
      passwordHash: user.passwordHash,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      isOnline: user.isOnline,
      status,
      role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      refreshTokens: user.refreshTokens.map(
        (refreshToken) =>
          new RefreshTokenEntity({
            id: refreshToken.id,
            tokenHash: refreshToken.tokenHash,
            expiresAt: refreshToken.expiresAt,
            createdAt: refreshToken.createdAt,
          }),
      ),
    });
  }
}
