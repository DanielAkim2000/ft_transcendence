import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TableEntity, TableStatus } from '../entities/table.entity';
import type { Prisma } from '../../generated/prisma/client';

const withOccupant = {
  occupiedBy: {
    select: { id: true, displayname: true, avatarUrl: true },
  },
  currentTournamentTie: {
    include: {
      tournament: { select: { id: true, name: true, totalRounds: true } },
      entryA: {
        select: {
          player1: { select: { displayname: true } },
          player2: { select: { displayname: true } },
        },
      },
      entryB: {
        select: {
          player1: { select: { displayname: true } },
          player2: { select: { displayname: true } },
        },
      },
    },
  },
} satisfies Prisma.TableInclude;

type TableWithOccupant = Prisma.TableGetPayload<{
  include: typeof withOccupant;
}>;

function entryLabel(
  entry: {
    player1: { displayname: string };
    player2: { displayname: string } | null;
  } | null,
): string {
  if (!entry) return '?';
  return entry.player2
    ? `${entry.player1.displayname} + ${entry.player2.displayname}`
    : entry.player1.displayname;
}

function roundLabelFor(round: number, totalRounds: number | null): string {
  const distance = (totalRounds ?? round) - round;
  if (distance === 0) return 'FINAL';
  if (distance === 1) return 'SEMI';
  if (distance === 2) return 'QUARTER';
  if (distance === 3) return 'ROUND_OF_16';
  return `ROUND_${round}`;
}

@Injectable()
export class TablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TableEntity[]> {
    const tables = await this.prisma.table.findMany({
      orderBy: { name: 'asc' },
      include: withOccupant,
    });
    return tables.map((table) => this.toEntity(table));
  }

  async findById(id: string): Promise<TableEntity | null> {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: withOccupant,
    });
    return table ? this.toEntity(table) : null;
  }

  /** Atomique : ne réussit que si la table est encore libre et non réservée par un tournoi. */
  async occupy(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.table.updateMany({
      where: { id, status: TableStatus.FREE, currentTournamentTieId: null },
      data: {
        status: TableStatus.BUSY,
        occupiedAt: new Date(),
        occupiedById: userId,
      },
    });
    return count === 1;
  }

  /** Atomique : ne réussit que si la table est encore occupée par cet utilisateur. */
  async release(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.table.updateMany({
      where: { id, status: TableStatus.BUSY, occupiedById: userId },
      data: {
        status: TableStatus.FREE,
        occupiedAt: null,
        occupiedById: null,
      },
    });
    return count === 1;
  }

  /** Libération forcée (admin/système), quel que soit l'occupant actuel. */
  async forceRelease(id: string): Promise<string | null> {
    const table = await this.prisma.table.findUnique({
      where: { id },
      select: { occupiedById: true, status: true },
    });
    if (!table || table.status !== 'BUSY') {
      return null;
    }
    await this.prisma.table.update({
      where: { id },
      data: { status: TableStatus.FREE, occupiedAt: null, occupiedById: null },
    });
    return table.occupiedById;
  }

  /** Atomique : réserve une table libre et non déjà réclamée pour une rencontre de tournoi. */
  async claimForTournament(id: string, tieId: string): Promise<boolean> {
    const { count } = await this.prisma.table.updateMany({
      where: { id, status: TableStatus.FREE, currentTournamentTieId: null },
      data: {
        status: TableStatus.BUSY,
        currentTournamentTieId: tieId,
        occupiedAt: new Date(),
      },
    });
    return count === 1;
  }

  async releaseTournamentClaim(tieId: string): Promise<void> {
    await this.prisma.table.updateMany({
      where: { currentTournamentTieId: tieId },
      data: {
        status: TableStatus.FREE,
        currentTournamentTieId: null,
        occupiedAt: null,
        occupiedById: null,
      },
    });
  }

  /** Tables libres et non réclamées par un tournoi, dans un ordre aléatoire. */
  async listFreeUnclaimed(): Promise<string[]> {
    const tables = await this.prisma.table.findMany({
      where: { status: TableStatus.FREE, currentTournamentTieId: null },
      select: { id: true },
    });
    const ids = tables.map((table) => table.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  private toEntity(table: TableWithOccupant): TableEntity {
    return new TableEntity({
      id: table.id,
      name: table.name,
      status: table.status as TableStatus,
      occupiedAt: table.occupiedAt,
      occupiedBy: table.occupiedBy,
      currentTournamentTie: table.currentTournamentTie
        ? {
            id: table.currentTournamentTie.id,
            tournamentId: table.currentTournamentTie.tournament.id,
            tournamentName: table.currentTournamentTie.tournament.name,
            round: table.currentTournamentTie.round,
            roundLabel: roundLabelFor(
              table.currentTournamentTie.round,
              table.currentTournamentTie.tournament.totalRounds,
            ),
            entryALabel: entryLabel(table.currentTournamentTie.entryA),
            entryBLabel: entryLabel(table.currentTournamentTie.entryB),
          }
        : null,
    });
  }
}
