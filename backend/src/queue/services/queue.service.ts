import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueueRepository } from '../repositories/queue.repository';
import {
  QueueEntryEntity,
  QueueEntryStatus,
} from '../entities/queue-entry.entity';
import { QueueGateway } from '../queue.gateway';
import { Prisma } from '../../generated/prisma/client';

/** Temps laissé pour prendre la table une fois appelé (règle métier : 2-3 min). */
export const QUEUE_TIMEOUT_MS = 2 * 60 * 1000;

@Injectable()
export class QueueService {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly queueRepository: QueueRepository,
    private readonly queueGateway: QueueGateway,
  ) {}

  listForTable(tableId: string): Promise<QueueEntryEntity[]> {
    return this.queueRepository.listActiveForTable(tableId);
  }

  getMyEntry(userId: string): Promise<QueueEntryEntity | null> {
    return this.queueRepository.findActiveForUser(userId);
  }

  async join(userId: string, tableId: string): Promise<QueueEntryEntity> {
    const table = await this.queueRepository.getTableStatus(tableId);
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    if (table.claimedByTournament) {
      throw new ConflictException('Table reserved for an ongoing tournament');
    }
    const hasActiveQueue = await this.queueRepository.hasActiveQueue(tableId);
    if (table.status === 'FREE' && !hasActiveQueue) {
      throw new ConflictException('Table is free, take it directly');
    }
    if (await this.queueRepository.findActiveForUser(userId)) {
      throw new ConflictException('You are already in a queue');
    }
    try {
      const entry = await this.queueRepository.create(tableId, userId);
      await this.publish(tableId);
      return entry;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You are already in a queue');
      }
      throw error;
    }
  }

  async cancel(userId: string, entryId: string): Promise<void> {
    const entry = await this.queueRepository.findById(entryId);
    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }
    if (entry.requester.id !== userId) {
      throw new ForbiddenException('Not your queue entry');
    }
    if (!(await this.queueRepository.cancel(entryId, userId))) {
      throw new ConflictException('Queue entry already resolved');
    }
    this.clearTimer(entryId);
    await this.publish(entry.tableId);
    if (entry.status === QueueEntryStatus.CALLED) {
      await this.advanceQueue(entry.tableId);
    }
  }

  /** Réservation en cours pour cette table, s'il y en a une (appelée par TablesService.occupy). */
  getActiveReservation(tableId: string): Promise<QueueEntryEntity | null> {
    return this.queueRepository.findActiveCalledForTable(tableId);
  }

  /** Appelé par TablesService après une occupation réussie. */
  async onTableOccupied(tableId: string, userId: string): Promise<void> {
    const called = await this.queueRepository.findActiveCalledForTable(tableId);
    if (!called || called.requester.id !== userId) {
      return;
    }
    if (await this.queueRepository.markDone(called.id)) {
      this.clearTimer(called.id);
      await this.publish(tableId);
    }
  }

  /** Appelé par TablesService après une libération réussie. */
  onTableFreed(tableId: string): Promise<void> {
    return this.advanceQueue(tableId);
  }

  /** Vide la file d'une table qu'un tournoi vient de réquisitionner. */
  async clearForTable(tableId: string): Promise<void> {
    const entries = await this.queueRepository.cancelAllForTable(tableId);
    for (const entry of entries) {
      this.clearTimer(entry.id);
      this.queueGateway.emitToUser(entry.requester.id, 'queue:expired', {
        tableId,
        reason: 'tournament',
      });
    }
    if (entries.length > 0) {
      await this.publish(tableId);
    }
  }

  private async advanceQueue(tableId: string): Promise<void> {
    const table = await this.queueRepository.getTableStatus(tableId);
    if (!table || table.status !== 'FREE' || table.claimedByTournament) {
      return;
    }
    if (await this.queueRepository.findActiveCalledForTable(tableId)) {
      return;
    }
    const next = await this.queueRepository.findNextWaiting(tableId);
    if (!next) {
      return;
    }
    const expiresAt = new Date(Date.now() + QUEUE_TIMEOUT_MS);
    if (!(await this.queueRepository.markCalled(next.id, expiresAt))) {
      return;
    }
    this.scheduleExpiry(next.id, tableId);
    this.queueGateway.emitToUser(next.requester.id, 'queue:called', {
      tableId,
      expiresAt,
    });
    await this.publish(tableId);
  }

  private scheduleExpiry(entryId: string, tableId: string): void {
    const timer = setTimeout(() => {
      void this.handleExpiry(entryId, tableId);
    }, QUEUE_TIMEOUT_MS);
    this.timers.set(entryId, timer);
  }

  private async handleExpiry(entryId: string, tableId: string): Promise<void> {
    this.timers.delete(entryId);
    const entry = await this.queueRepository.findById(entryId);
    if (!(await this.queueRepository.markExpired(entryId))) {
      return;
    }
    if (entry) {
      this.queueGateway.emitToUser(entry.requester.id, 'queue:expired', {
        tableId,
      });
    }
    await this.publish(tableId);
    await this.advanceQueue(tableId);
  }

  private clearTimer(entryId: string): void {
    const timer = this.timers.get(entryId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(entryId);
    }
  }

  private async publish(tableId: string): Promise<void> {
    const entries = await this.queueRepository.listActiveForTable(tableId);
    this.queueGateway.emitQueueUpdate(tableId, entries);
  }
}
