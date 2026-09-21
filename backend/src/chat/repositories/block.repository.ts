import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockEntity } from '../entities/block.entity';
import type { Block as BlockPrisma } from '../../generated/prisma/client';

@Injectable()
export class BlockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(blockerId: string, blockedId: string): Promise<BlockEntity> {
    const block = await this.prisma.block.create({
      data: { blockerId, blockedId },
    });

    return this.toEntity(block);
  }

  async findBlock(
    blockerId: string,
    blockedId: string,
  ): Promise<BlockEntity | null> {
    const block = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return block ? this.toEntity(block) : null;
  }

  async remove(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  async listBlockedByUser(userId: string): Promise<BlockEntity[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
    });
    return blocks.map((block) => this.toEntity(block));
  }

  async listBlockingUser(userId: string): Promise<BlockEntity[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockedId: userId },
    });
    return blocks.map((block) => this.toEntity(block));
  }

  async isBlocked(userIdA: string, userIdB: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
    });

    return block !== null;
  }

  private toEntity(block: BlockPrisma): BlockEntity {
    return new BlockEntity({
      blockerId: block.blockerId,
      blockedId: block.blockedId,
      createdAt: block.createdAt,
    });
  }
}
