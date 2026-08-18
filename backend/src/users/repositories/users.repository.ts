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
        twoFactorPendingSecret: user.twoFactorPendingSecret,
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

  async searchUsers(
    excludeUserId: string,
    query?: string,
  ): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        ...(query?.trim()
          ? {
              OR: [
                {
                  displayname: {
                    contains: query.trim(),
                    mode: 'insensitive' as const,
                  },
                },
                {
                  email: {
                    contains: query.trim(),
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' as const },
        },
      },
      take: 20,
      orderBy: { displayname: 'asc' },
    });
    return users.map((user) => this.mapUser(user));
  }

  async findFriendshipBetween(userIdA: string, userIdB: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userIdA, addresseeId: userIdB },
          { requesterId: userIdB, addresseeId: userIdA },
        ],
      },
    });
  }

  async createFriendRequest(requesterId: string, addresseeId: string) {
    return this.prisma.friendship.create({
      data: { requesterId, addresseeId, status: 'PENDING' },
    });
  }

  async acceptFriendship(id: string) {
    return this.prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
  }

  async deleteFriendship(id: string) {
    await this.prisma.friendship.delete({ where: { id } });
  }

  async listAcceptedFriends(userId: string): Promise<UserEntity[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { include: { refreshTokens: true } },
        addressee: { include: { refreshTokens: true } },
      },
    });
    return rows.map((row) =>
      this.mapUser(row.requesterId === userId ? row.addressee : row.requester),
    );
  }

  async listIncomingRequests(userId: string): Promise<UserEntity[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: { include: { refreshTokens: true } },
      },
    });
    return rows.map((row) => this.mapUser(row.requester));
  }

  async listOutgoingRequests(userId: string): Promise<UserEntity[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: {
        addressee: { include: { refreshTokens: true } },
      },
    });
    return rows.map((row) => this.mapUser(row.addressee));
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
      twoFactorPendingSecret: user.twoFactorPendingSecret,
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
