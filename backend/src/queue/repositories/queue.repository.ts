import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QueueEntryEntity,
  QueueEntryStatus,
} from '../entities/queue-entry.entity';
import type { Prisma } from '../../generated/prisma/client';

const withPlayers = {
  requester: { select: { id: true, displayname: true, avatarUrl: true } },
} satisfies Prisma.QueueEntryInclude;

type QueueEntryWithPlayers = Prisma.QueueEntryGetPayload<{
  include: typeof withPlayers;
}>;

const ACTIVE_STATUSES: QueueEntryStatus[] = [
  QueueEntryStatus.WAITING,
  QueueEntryStatus.CALLED,
];

@Injectable()
export class QueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveForTable(tableId: string): Promise<QueueEntryEntity[]> {
    const entries = await this.prisma.queueEntry.findMany({
      where: { tableId, status: { in: ACTIVE_STATUSES } },
      include: withPlayers,
      orderBy: { joinedAt: 'asc' },
    });
    return entries.map((entry, index) => this.toEntity(entry, index + 1));
  }

  async findById(id: string): Promise<QueueEntryEntity | null> {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
      include: withPlayers,
    });
    return entry ? this.toEntity(entry, 0) : null;
  }

  /** Entrée active (en attente ou appelée) où l'utilisateur est demandeur. */
  async findActiveForUser(userId: string): Promise<QueueEntryEntity | null> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        status: { in: ACTIVE_STATUSES },
        requesterId: userId,
      },
      include: withPlayers,
      orderBy: { joinedAt: 'asc' },
    });
    if (!entry) {
      return null;
    }
    const position = await this.computePosition(entry.tableId, entry.joinedAt);
    return this.toEntity(entry, position);
  }

  async hasActiveQueue(tableId: string): Promise<boolean> {
    const count = await this.prisma.queueEntry.count({
      where: { tableId, status: { in: ACTIVE_STATUSES } },
    });
    return count > 0;
  }

  async findNextWaiting(tableId: string): Promise<QueueEntryEntity | null> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { tableId, status: QueueEntryStatus.WAITING },
      include: withPlayers,
      orderBy: { joinedAt: 'asc' },
    });
    return entry ? this.toEntity(entry, 0) : null;
  }

  async findActiveCalledForTable(
    tableId: string,
  ): Promise<QueueEntryEntity | null> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { tableId, status: QueueEntryStatus.CALLED },
      include: withPlayers,
    });
    return entry ? this.toEntity(entry, 0) : null;
  }

  async create(
    tableId: string,
    requesterId: string,
  ): Promise<QueueEntryEntity> {
    const entry = await this.prisma.queueEntry.create({
      data: { tableId, requesterId },
      include: withPlayers,
    });
    const position = await this.computePosition(tableId, entry.joinedAt);
    return this.toEntity(entry, position);
  }

  private async computePosition(
    tableId: string,
    joinedAt: Date,
  ): Promise<number> {
    return this.prisma.queueEntry.count({
      where: {
        tableId,
        status: { in: ACTIVE_STATUSES },
        joinedAt: { lte: joinedAt },
      },
    });
  }

  /** Atomique : ne réussit que si l'entrée est encore en attente. */
  async markCalled(id: string, expiresAt: Date): Promise<boolean> {
    const { count } = await this.prisma.queueEntry.updateMany({
      where: { id, status: QueueEntryStatus.WAITING },
      data: {
        status: QueueEntryStatus.CALLED,
        calledAt: new Date(),
        expiresAt,
      },
    });
    return count === 1;
  }

  /** Atomique : ne réussit que si l'entrée est encore appelée (pas déjà confirmée/annulée). */
  async markExpired(id: string): Promise<boolean> {
    const { count } = await this.prisma.queueEntry.updateMany({
      where: { id, status: QueueEntryStatus.CALLED },
      data: { status: QueueEntryStatus.EXPIRED },
    });
    return count === 1;
  }

  /** Atomique : ne réussit que si l'entrée est encore appelée. */
  async markDone(id: string): Promise<boolean> {
    const { count } = await this.prisma.queueEntry.updateMany({
      where: { id, status: QueueEntryStatus.CALLED },
      data: { status: QueueEntryStatus.DONE },
    });
    return count === 1;
  }

  async getTableStatus(
    tableId: string,
  ): Promise<{ status: 'FREE' | 'BUSY'; claimedByTournament: boolean } | null> {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      select: { status: true, currentTournamentTieId: true },
    });
    return table
      ? {
          status: table.status,
          claimedByTournament: table.currentTournamentTieId !== null,
        }
      : null;
  }

  /** Annule toutes les entrées actives d'une table (ex: la table est réclamée par un tournoi). */
  async cancelAllForTable(tableId: string): Promise<QueueEntryEntity[]> {
    const entries = await this.listActiveForTable(tableId);
    if (entries.length > 0) {
      await this.prisma.queueEntry.updateMany({
        where: { tableId, status: { in: ACTIVE_STATUSES } },
        data: { status: QueueEntryStatus.CANCELLED },
      });
    }
    return entries;
  }

  /** Atomique : seul le demandeur peut annuler sa propre entrée. */
  async cancel(id: string, requesterId: string): Promise<boolean> {
    const { count } = await this.prisma.queueEntry.updateMany({
      where: { id, requesterId, status: { in: ACTIVE_STATUSES } },
      data: { status: QueueEntryStatus.CANCELLED },
    });
    return count === 1;
  }

  private toEntity(
    entry: QueueEntryWithPlayers,
    position: number,
  ): QueueEntryEntity {
    return new QueueEntryEntity({
      id: entry.id,
      tableId: entry.tableId,
      status: entry.status as QueueEntryStatus,
      requester: entry.requester,
      joinedAt: entry.joinedAt,
      calledAt: entry.calledAt,
      expiresAt: entry.expiresAt,
      position,
    });
  }
}
