import { Injectable, NotFoundException } from '@nestjs/common';
import { TablesRepository } from '../repositories/tables.repository';
import { TableEntity } from '../entities/table.entity';
import { TablesGateway } from '../tables.gateway';

@Injectable()
export class TablesService {
  /** Injecte les dépendances : TablesRepository, TablesGateway. */
  constructor(
    private readonly tablesRepository: TablesRepository,
    private readonly tablesGateway: TablesGateway,
  ) {}

  /** Liste toutes les tables, triées par nom. */
  list(): Promise<TableEntity[]> {
    return this.tablesRepository.list();
  }

  /** Relit la table, la diffuse via la gateway et la retourne (appelé par la file après chaque changement d'état). */
  async publish(tableId: string): Promise<TableEntity> {
    const table = await this.tablesRepository.findById(tableId);
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    this.tablesGateway.emitTableUpdate(table);
    return table;
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

  /** Retourne les ids des tables libres et non réclamées par un tournoi, dans un ordre aléatoire. */
  listFreeUnclaimed(): Promise<string[]> {
    return this.tablesRepository.listFreeUnclaimed();
  }
}
