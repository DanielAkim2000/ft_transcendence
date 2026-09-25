import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TablesRepository } from '../repositories/tables.repository';
import { TableEntity, TableStatus } from '../entities/table.entity';
import { TablesGateway } from '../tables.gateway';
import { QueueService } from '../../queue/services/queue.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class TablesService {
  constructor(
    private readonly tablesRepository: TablesRepository,
    private readonly tablesGateway: TablesGateway,
    private readonly queueService: QueueService,
  ) {}

  list(): Promise<TableEntity[]> {
    return this.tablesRepository.list();
  }

  async occupy(userId: string, tableId: string): Promise<TableEntity> {
    const table = await this.getTable(tableId);
    if (table.currentTournamentTie) {
      throw new ConflictException('Table reserved for an ongoing tournament');
    }
    const reservation = await this.queueService.getActiveReservation(tableId);
    if (reservation && reservation.requester.id !== userId) {
      throw new ConflictException(
        'Table reserved for the next player in the queue',
      );
    }
    try {
      if (!(await this.tablesRepository.occupy(tableId, userId))) {
        throw new ConflictException('Table already occupied');
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You already occupy another table');
      }
      throw error;
    }
    await this.queueService.onTableOccupied(tableId, userId);
    return this.publish(tableId);
  }

  async release(currentUserId: string, tableId: string): Promise<TableEntity> {
    const table = await this.getTable(tableId);
    if (table.status === TableStatus.FREE) {
      throw new ConflictException('Table already free');
    }
    if (table.occupiedBy?.id !== currentUserId) {
      throw new ForbiddenException('You do not occupy this table');
    }
    if (!(await this.tablesRepository.release(tableId, currentUserId))) {
      throw new ConflictException('Table already free');
    }
    const result = await this.publish(tableId);
    await this.queueService.onTableFreed(tableId);
    return result;
  }

  /** Libération forcée (admin/système) : coupe l'occupation en cours, quel qu'en soit l'occupant. */
  async forceRelease(tableId: string): Promise<string | null> {
    const previousOccupantId =
      await this.tablesRepository.forceRelease(tableId);
    if (previousOccupantId) {
      await this.publish(tableId);
      await this.queueService.onTableFreed(tableId);
    }
    return previousOccupantId;
  }

  /** Réserve une table libre pour une rencontre de tournoi (moteur uniquement). */
  async claimForTournament(tableId: string, tieId: string): Promise<boolean> {
    const claimed = await this.tablesRepository.claimForTournament(
      tableId,
      tieId,
    );
    if (claimed) {
      await this.publish(tableId);
    }
    return claimed;
  }

  /** Libère une table réclamée par un tournoi une fois la manche terminée. */
  async releaseTournamentClaim(tableId: string, tieId: string): Promise<void> {
    await this.tablesRepository.releaseTournamentClaim(tieId);
    await this.publish(tableId);
  }

  listFreeUnclaimed(): Promise<string[]> {
    return this.tablesRepository.listFreeUnclaimed();
  }

  private async getTable(tableId: string): Promise<TableEntity> {
    const table = await this.tablesRepository.findById(tableId);
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table;
  }

  private async publish(tableId: string): Promise<TableEntity> {
    const table = await this.getTable(tableId);
    this.tablesGateway.emitTableUpdate(table);
    return table;
  }
}
