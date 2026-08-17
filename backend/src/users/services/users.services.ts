import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { UserRepository } from '../repositories/users.repository';
import { RefreshToken, UserEntity } from '../entities/users.entity';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';
import { RegisterDto } from '../../auth/dtos/register.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
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

  async getProfile(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  searchUsers(excludeUserId: string, query?: string): Promise<UserEntity[]> {
    return this.userRepository.searchUsers(excludeUserId, query);
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

  async updateProfile(
    user: UserEntity,
    dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    user.displayname = dto.displayname;
    return this.userRepository.updateUser(user);
  }

  async updateAvatar(
    user: UserEntity,
    filename: string,
  ): Promise<UserEntity> {
    const previous = user.avatarUrl;
    user.avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await this.userRepository.updateUser(user);
    if (previous?.startsWith('/uploads/avatars/')) {
      const previousPath = join(process.cwd(), previous);
      await unlink(previousPath).catch(() => undefined);
    }
    return updated;
  }

  async sendFriendRequest(
    requester: UserEntity,
    addresseeId: string,
  ): Promise<UserEntity> {
    if (requester.id === addresseeId) {
      throw new BadRequestException('Cannot add yourself as a friend');
    }
    const addressee = await this.getProfile(addresseeId);
    const existing = await this.userRepository.findFriendshipBetween(
      requester.id,
      addresseeId,
    );
    if (!existing) {
      await this.userRepository.createFriendRequest(requester.id, addresseeId);
      return addressee;
    }
    if (existing.status === 'ACCEPTED') {
      throw new ConflictException('Already friends');
    }
    if (existing.requesterId === requester.id) {
      throw new ConflictException('Friend request already sent');
    }
    await this.userRepository.acceptFriendship(existing.id);
    return addressee;
  }

  async acceptFriendRequest(
    currentUser: UserEntity,
    requesterId: string,
  ): Promise<UserEntity> {
    const existing = await this.userRepository.findFriendshipBetween(
      currentUser.id,
      requesterId,
    );
    if (
      !existing ||
      existing.status !== 'PENDING' ||
      existing.addresseeId !== currentUser.id
    ) {
      throw new NotFoundException('Friend request not found');
    }
    await this.userRepository.acceptFriendship(existing.id);
    return this.getProfile(requesterId);
  }

  async removeFriendship(
    currentUser: UserEntity,
    otherUserId: string,
  ): Promise<void> {
    const existing = await this.userRepository.findFriendshipBetween(
      currentUser.id,
      otherUserId,
    );
    if (!existing) {
      throw new NotFoundException('Friendship not found');
    }
    await this.userRepository.deleteFriendship(existing.id);
  }

  listFriends(userId: string): Promise<UserEntity[]> {
    return this.userRepository.listAcceptedFriends(userId);
  }

  listPendingRequests(userId: string): Promise<UserEntity[]> {
    return this.userRepository.listIncomingRequests(userId);
  }

  async getFriendshipStatus(
    currentUserId: string,
    otherUserId: string,
  ): Promise<'none' | 'pending_out' | 'pending_in' | 'friends' | 'self'> {
    if (currentUserId === otherUserId) {
      return 'self';
    }
    const existing = await this.userRepository.findFriendshipBetween(
      currentUserId,
      otherUserId,
    );
    if (!existing) {
      return 'none';
    }
    if (existing.status === 'ACCEPTED') {
      return 'friends';
    }
    return existing.requesterId === currentUserId
      ? 'pending_out'
      : 'pending_in';
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
