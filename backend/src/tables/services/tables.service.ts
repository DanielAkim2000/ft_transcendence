import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TablesRepository } from '../repositories/tables.repository';
import { TableEntity } from '../entities/table.entity';
import { TablesGateway } from '../tables.gateway';

/** [Socle produit babyfoot (hors module)] Service métier des tables de babyfoot. */
@Injectable()
export class TablesService {
  /** [Socle produit babyfoot (hors module)] Injecte les dépendances : TablesRepository, TablesGateway. */
  constructor(
    private readonly tablesRepository: TablesRepository,
    private readonly tablesGateway: TablesGateway,
  ) {}

  /** [Socle produit babyfoot (hors module)] Liste toutes les tables, triées par nom. */
  list(): Promise<TableEntity[]> {
    return this.tablesRepository.list();
  }

  /** [Socle produit babyfoot (hors module)] Relit la table, la diffuse via la gateway et la retourne (appelé par la file après chaque changement d'état). */
  async publish(tableId: string): Promise<TableEntity> {
    const table = await this.getById(tableId);
    this.tablesGateway.emitTableUpdate(table);
    return table;
  }

  /** [Socle produit babyfoot (hors module)] Retrouve une table par id sans la diffuser (usage interne, ex. libellé pour une notification). */
  async getById(tableId: string): Promise<TableEntity> {
    const table = await this.tablesRepository.findById(tableId);
    if (!table) {
      throw new NotFoundException({
        message: 'Table not found',
        code: 'TABLE_NOT_FOUND',
      });
    }
    return table;
  }

  /** [Socle produit babyfoot (hors module)] Crée une table (nom unique) et la diffuse à tous les clients. */
  async create(name: string): Promise<TableEntity> {
    await this.assertNameAvailable(name);
    const table = await this.tablesRepository.create(name);
    this.tablesGateway.emitTableUpdate(table);
    return table;
  }

  /** [Socle produit babyfoot (hors module)] Renomme une table (nom unique) et diffuse la mise à jour. */
  async rename(tableId: string, name: string): Promise<TableEntity> {
    const current = await this.getById(tableId);
    if (current.name !== name) {
      await this.assertNameAvailable(name);
    }
    const table = await this.tablesRepository.rename(tableId, name);
    this.tablesGateway.emitTableUpdate(table);
    return table;
  }

  /** [Socle produit babyfoot (hors module)] Supprime une table inutilisée (libre, sans file ni tournoi) et prévient les clients ; lève une ConflictException sinon. */
  async remove(tableId: string): Promise<void> {
    await this.getById(tableId);
    if (await this.tablesRepository.isInUse(tableId)) {
      throw new ConflictException({
        message:
          'This table is in use: wait until it is free (no game, queue or tournament match)',
        code: 'TABLE_IN_USE',
      });
    }
    await this.tablesRepository.delete(tableId);
    this.tablesGateway.emitTableRemoved(tableId);
  }

  /** [Socle produit babyfoot (hors module)] Lève une ConflictException si une autre table porte déjà ce nom. */
  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.tablesRepository.findIdByName(name)) {
      throw new ConflictException({
        message: 'A table with this name already exists',
        code: 'TABLE_NAME_TAKEN',
      });
    }
  }

  /** [Socle produit babyfoot (hors module)] Réserve une table libre pour une rencontre de tournoi (moteur uniquement). */
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

  /** [Socle produit babyfoot (hors module)] Libère une table réclamée par un tournoi une fois la manche terminée. */
  async releaseTournamentClaim(tableId: string, tieId: string): Promise<void> {
    await this.tablesRepository.releaseTournamentClaim(tieId);
    await this.publish(tableId);
  }

  /** [Socle produit babyfoot (hors module)] Libère toutes les tables réservées par un tournoi (annulation) et diffuse leur nouvel état. */
  async releaseClaimsForTournament(tournamentId: string): Promise<void> {
    const tableIds =
      await this.tablesRepository.releaseClaimsForTournament(tournamentId);
    for (const tableId of tableIds) {
      await this.publish(tableId);
    }
  }

  /** [Socle produit babyfoot (hors module)] Retourne les ids des tables libres et non réclamées par un tournoi, dans un ordre aléatoire. */
  listFreeUnclaimed(): Promise<string[]> {
    return this.tablesRepository.listFreeUnclaimed();
  }
}
