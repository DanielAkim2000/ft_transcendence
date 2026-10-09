import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TableEntity, TableStatus } from '../entities/table.entity';
import { MatchFormat } from '../../matches/entities/match.entity';
import type { Prisma } from '../../generated/prisma/client';

const withState = {
  queueGroups: {
    where: { status: 'ON_TABLE' },
    orderBy: { slot: 'asc' },
    select: {
      id: true,
      slot: true,
      members: {
        orderBy: { isRequester: 'desc' },
        select: {
          user: { select: { id: true, displayname: true, avatarUrl: true } },
        },
      },
    },
  },
  releaseVotes: { select: { userId: true } },
  // Match de table en cours : les manches de tournoi ont leur propre suivi.
  matchLegs: {
    where: { status: 'ACCEPTED', tournamentTieId: null },
    select: { id: true },
    take: 1,
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

type TableWithState = Prisma.TableGetPayload<{
  include: typeof withState;
}>;

/** Construit le libellé d'une équipe de tournoi (« Joueur1 + Joueur2 » en double, nom seul en simple, « ? » si inconnue). */
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

/** Convertit un numéro de tour en libellé (FINAL, SEMI, QUARTER, ROUND_OF_16, sinon ROUND_n) selon le nombre total de tours. */
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
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Liste toutes les tables triées par nom, avec leurs groupes, le match en cours et la rencontre de tournoi en cours. */
  async list(): Promise<TableEntity[]> {
    const tables = await this.prisma.table.findMany({
      orderBy: { name: 'asc' },
      include: withState,
    });
    return tables.map((table) => this.toEntity(table));
  }

  /** Retrouve une table par son id (avec groupes, match et rencontre de tournoi), ou null. */
  async findById(id: string): Promise<TableEntity | null> {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: withState,
    });
    return table ? this.toEntity(table) : null;
  }

  /** Retrouve l'id d'une table par son nom exact, ou null. */
  async findIdByName(name: string): Promise<string | null> {
    const table = await this.prisma.table.findUnique({
      where: { name },
      select: { id: true },
    });
    return table?.id ?? null;
  }

  /** Crée une table libre. */
  async create(name: string): Promise<TableEntity> {
    const table = await this.prisma.table.create({
      data: { name },
      include: withState,
    });
    return this.toEntity(table);
  }

  /** Renomme une table. */
  async rename(id: string, name: string): Promise<TableEntity> {
    const table = await this.prisma.table.update({
      where: { id },
      data: { name },
      include: withState,
    });
    return this.toEntity(table);
  }

  /** Vrai si la table est utilisée : occupée, réservée par un tournoi ou avec un groupe encore actif (en file, appelé ou installé). */
  async isInUse(id: string): Promise<boolean> {
    const table = await this.prisma.table.findUnique({
      where: { id },
      select: {
        status: true,
        currentTournamentTieId: true,
        _count: {
          select: {
            queueGroups: {
              where: {
                status: { in: ['INVITING', 'WAITING', 'CALLED', 'ON_TABLE'] },
              },
            },
          },
        },
      },
    });
    return (
      !!table &&
      (String(table.status) !== String(TableStatus.FREE) ||
        table.currentTournamentTieId !== null ||
        table._count.queueGroups > 0)
    );
  }

  /** Supprime une table (ses groupes terminés et votes partent avec elle, ses manches de tournoi restent sans table). */
  async delete(id: string): Promise<void> {
    await this.prisma.table.delete({ where: { id } });
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

  /** Libère la table réclamée par la rencontre de tournoi donnée et la remet à FREE. */
  async releaseTournamentClaim(tieId: string): Promise<void> {
    await this.prisma.table.updateMany({
      where: { currentTournamentTieId: tieId },
      data: {
        status: TableStatus.FREE,
        currentTournamentTieId: null,
        occupiedAt: null,
      },
    });
  }

  /** Libère toutes les tables réservées par les rencontres d'un tournoi (annulation) et retourne leurs ids. */
  async releaseClaimsForTournament(tournamentId: string): Promise<string[]> {
    const claimed = await this.prisma.table.findMany({
      where: { currentTournamentTie: { tournamentId } },
      select: { id: true },
    });
    if (claimed.length === 0) return [];
    await this.prisma.table.updateMany({
      where: { id: { in: claimed.map((table) => table.id) } },
      data: {
        status: TableStatus.FREE,
        currentTournamentTieId: null,
        occupiedAt: null,
      },
    });
    return claimed.map((table) => table.id);
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

  /** Convertit une ligne Prisma en TableEntity, en calculant les libellés de la rencontre de tournoi en cours. */
  private toEntity(table: TableWithState): TableEntity {
    return new TableEntity({
      id: table.id,
      name: table.name,
      status: table.status as TableStatus,
      format: table.format as MatchFormat | null,
      occupiedAt: table.occupiedAt,
      groups: table.queueGroups.map((group) => ({
        id: group.id,
        slot: group.slot ?? 0,
        players: group.members.map((member) => member.user),
      })),
      currentMatchId: table.matchLegs[0]?.id ?? null,
      releaseVoterIds: table.releaseVotes.map((vote) => vote.userId),
      endRequestedAt: table.endRequestedAt,
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
