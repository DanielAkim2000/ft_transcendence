import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockEntity } from '../entities/block.entity';
import type { Block as BlockPrisma } from '../../generated/prisma/client';
import {
  PageQueryDto,
  pageOffset,
} from '../../common/pagination/page-query.dto';

/** [Minor · Chat avancé] Dépôt des blocages : création, suppression, listes et test de blocage entre deux utilisateurs. */
@Injectable()
export class BlockRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Minor · Chat avancé] Enregistre le blocage de blockedId par blockerId. */
  async create(blockerId: string, blockedId: string): Promise<BlockEntity> {
    const block = await this.prisma.block.create({
      data: { blockerId, blockedId },
    });

    return this.toEntity(block);
  }

  /** [Minor · Chat avancé] Retrouve le blocage exact de blockedId par blockerId (dans ce sens), ou null. */
  async findBlock(
    blockerId: string,
    blockedId: string,
  ): Promise<BlockEntity | null> {
    const block = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return block ? this.toEntity(block) : null;
  }

  /** [Minor · Chat avancé] Supprime le blocage de blockedId par blockerId. */
  async remove(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  /** [Minor · Chat avancé] Liste une page des blocages émis par l'utilisateur (ceux qu'il a bloqués), les plus récents d'abord, plus le total. */
  async listBlockedByUser(
    userId: string,
    page: PageQueryDto,
  ): Promise<{ blocks: BlockEntity[]; total: number }> {
    const where = { blockerId: userId };
    const [blocks, total] = await this.prisma.$transaction([
      this.prisma.block.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.block.count({ where }),
    ]);
    return { blocks: blocks.map((block) => this.toEntity(block)), total };
  }

  /** [Minor · Chat avancé] Liste les blocages reçus par l'utilisateur (ceux qui l'ont bloqué). */
  async listBlockingUser(userId: string): Promise<BlockEntity[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockedId: userId },
    });
    return blocks.map((block) => this.toEntity(block));
  }

  /** [Minor · Chat avancé] Indique si l'un des deux utilisateurs a bloqué l'autre, dans un sens ou dans l'autre. */
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

  /** [Minor · Chat avancé] Convertit un blocage Prisma en BlockEntity. */
  private toEntity(block: BlockPrisma): BlockEntity {
    return new BlockEntity({
      blockerId: block.blockerId,
      blockedId: block.blockedId,
      createdAt: block.createdAt,
    });
  }
}
