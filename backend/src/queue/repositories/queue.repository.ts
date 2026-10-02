import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QueueGroupEntity,
  QueueGroupStatus,
} from '../entities/queue-group.entity';
import { MatchFormat } from '../../matches/entities/match.entity';
import { Prisma } from '../../generated/prisma/client';

const withMembers = {
  members: {
    orderBy: { isRequester: 'desc' },
    select: {
      isRequester: true,
      accepted: true,
      user: { select: { id: true, displayname: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.QueueGroupInclude;

type QueueGroupWithMembers = Prisma.QueueGroupGetPayload<{
  include: typeof withMembers;
}>;

/** Groupes qui ne sont pas encore terminés : ils comptent pour le format de la table. */
const ACTIVE_STATUSES: QueueGroupStatus[] = [
  QueueGroupStatus.INVITING,
  QueueGroupStatus.WAITING,
  QueueGroupStatus.CALLED,
  QueueGroupStatus.ON_TABLE,
];

/** Groupes visibles dans la file (l'invitation en cours n'y figure pas). */
const QUEUED_STATUSES: QueueGroupStatus[] = [
  QueueGroupStatus.WAITING,
  QueueGroupStatus.CALLED,
];

export type TableQueueState = {
  format: MatchFormat | null;
  claimedByTournament: boolean;
  endRequestedAt: Date | null;
};

export type OnTableGroup = { id: string; slot: number; userIds: string[] };

export type StartedMatch = { matchId: string; playerIds: string[] };

export type TableMatchInfo = {
  tableId: string | null;
  tournamentTieId: string | null;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  teamAPlayer1Id: string;
  teamBPlayer1Id: string;
};

@Injectable()
export class QueueRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Format de la table, réservation par un tournoi et demande de fin de match, ou null si la table n'existe pas. */
  async getTable(tableId: string): Promise<TableQueueState | null> {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      select: {
        format: true,
        currentTournamentTieId: true,
        endRequestedAt: true,
      },
    });
    return table
      ? {
          format: table.format as MatchFormat | null,
          claimedByTournament: table.currentTournamentTieId !== null,
          endRequestedAt: table.endRequestedAt,
        }
      : null;
  }

  /** Liste les groupes en file (en attente ou appelés) d'une table, par ordre d'arrivée, avec leur position (à partir de 1). */
  async listQueue(tableId: string): Promise<QueueGroupEntity[]> {
    const groups = await this.prisma.queueGroup.findMany({
      where: { tableId, status: { in: QUEUED_STATUSES } },
      include: withMembers,
      orderBy: { joinedAt: 'asc' },
    });
    return groups.map((group, index) => this.toEntity(group, index + 1));
  }

  /** Retrouve un groupe par son id (avec sa position s'il est en file), ou null. */
  async findGroupById(id: string): Promise<QueueGroupEntity | null> {
    const group = await this.prisma.queueGroup.findUnique({
      where: { id },
      include: withMembers,
    });
    return group ? this.withPosition(group) : null;
  }

  /** Groupe actif de l'utilisateur (invité, en file, appelé ou sur la table), ou null. */
  async findActiveGroupForUser(
    userId: string,
  ): Promise<QueueGroupEntity | null> {
    const member = await this.prisma.queueGroupMember.findFirst({
      where: { userId, active: true },
      select: { group: { include: withMembers } },
    });
    return member ? this.withPosition(member.group) : null;
  }

  /** Retourne le plus ancien groupe en attente (statut WAITING) de la table, ou null. */
  async findNextWaiting(tableId: string): Promise<QueueGroupEntity | null> {
    const group = await this.prisma.queueGroup.findFirst({
      where: { tableId, status: QueueGroupStatus.WAITING },
      include: withMembers,
      orderBy: { joinedAt: 'asc' },
    });
    return group ? this.toEntity(group, 0) : null;
  }

  /** Nombre de groupes en file (en attente ou appelés). */
  countWaiting(tableId: string): Promise<number> {
    return this.prisma.queueGroup.count({
      where: { tableId, status: { in: QUEUED_STATUSES } },
    });
  }

  /** Nombre de groupes appelés qui n'ont pas encore confirmé leur présence. */
  countCalled(tableId: string): Promise<number> {
    return this.prisma.queueGroup.count({
      where: { tableId, status: QueueGroupStatus.CALLED },
    });
  }

  /** Nombre de groupes actuellement sur la table (0 à 2). */
  countOnTable(tableId: string): Promise<number> {
    return this.prisma.queueGroup.count({
      where: { tableId, status: QueueGroupStatus.ON_TABLE },
    });
  }

  /** Groupes présents sur la table, avec leur côté et les ids de leurs joueurs. */
  async listOnTable(tableId: string): Promise<OnTableGroup[]> {
    const groups = await this.prisma.queueGroup.findMany({
      where: { tableId, status: QueueGroupStatus.ON_TABLE },
      orderBy: { slot: 'asc' },
      select: {
        id: true,
        slot: true,
        members: { select: { userId: true } },
      },
    });
    return groups.map((group) => ({
      id: group.id,
      slot: group.slot ?? 0,
      userIds: group.members.map((member) => member.userId),
    }));
  }

  /** Crée un groupe (le demandeur, plus son coéquipier invité en 2v2) et fixe le format de la table s'il est encore libre ; null si la table joue déjà un autre format. */
  async createGroup(params: {
    tableId: string;
    format: MatchFormat;
    requesterId: string;
    teammateId?: string;
    status: QueueGroupStatus;
  }): Promise<QueueGroupEntity | null> {
    const { tableId, format, requesterId, teammateId, status } = params;
    const groupId = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.table.updateMany({
        where: { id: tableId, OR: [{ format: null }, { format }] },
        data: { format },
      });
      if (count === 0) {
        return null;
      }
      const group = await tx.queueGroup.create({
        data: {
          tableId,
          format,
          status,
          members: {
            create: [
              { userId: requesterId, isRequester: true, accepted: true },
              ...(teammateId ? [{ userId: teammateId }] : []),
            ],
          },
        },
        select: { id: true },
      });
      return group.id;
    });
    return groupId ? this.findGroupById(groupId) : null;
  }

  /** Atomique : le coéquipier accepte l'invitation, le groupe passe en file d'attente. */
  async acceptInvite(groupId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.queueGroup.updateMany({
        where: { id: groupId, status: QueueGroupStatus.INVITING },
        data: { status: QueueGroupStatus.WAITING, joinedAt: new Date() },
      });
      if (count !== 1) {
        return false;
      }
      await tx.queueGroupMember.updateMany({
        where: { groupId, userId },
        data: { accepted: true },
      });
      return true;
    });
  }

  /** Atomique : ne réussit que si le groupe est encore en attente. */
  async markCalled(id: string, expiresAt: Date): Promise<boolean> {
    const { count } = await this.prisma.queueGroup.updateMany({
      where: { id, status: QueueGroupStatus.WAITING },
      data: {
        status: QueueGroupStatus.CALLED,
        calledAt: new Date(),
        expiresAt,
      },
    });
    return count === 1;
  }

  /** Atomique : termine un groupe (statut final, libère son côté de table et ses joueurs) s'il est encore dans l'un des statuts `from`. */
  async finishGroup(
    id: string,
    status:
      | QueueGroupStatus.DONE
      | QueueGroupStatus.EXPIRED
      | QueueGroupStatus.CANCELLED,
    from: QueueGroupStatus[],
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.queueGroup.updateMany({
        where: { id, status: { in: from } },
        data: { status, slot: null, expiresAt: null },
      });
      if (count !== 1) {
        return false;
      }
      await tx.queueGroupMember.updateMany({
        where: { groupId: id },
        data: { active: false },
      });
      return true;
    });
  }

  /** Atomique : place un groupe en attente ou appelé sur un côté libre de la table ; null s'il n'y a plus de place. */
  async placeOnTable(
    groupId: string,
  ): Promise<{ tableId: string; slot: number } | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const group = await tx.queueGroup.findUnique({
          where: { id: groupId },
          select: { tableId: true },
        });
        if (!group) {
          return null;
        }
        const used = await tx.queueGroup.findMany({
          where: { tableId: group.tableId, status: QueueGroupStatus.ON_TABLE },
          select: { slot: true },
        });
        const slot = [0, 1].find((s) => !used.some((u) => u.slot === s));
        if (slot === undefined) {
          return null;
        }
        const { count } = await tx.queueGroup.updateMany({
          where: { id: groupId, status: { in: QUEUED_STATUSES } },
          data: { status: QueueGroupStatus.ON_TABLE, slot, expiresAt: null },
        });
        if (count !== 1) {
          return null;
        }
        await tx.table.updateMany({
          where: { id: group.tableId, occupiedAt: null },
          data: { occupiedAt: new Date() },
        });
        await tx.table.update({
          where: { id: group.tableId },
          data: { status: 'BUSY' },
        });
        return { tableId: group.tableId, slot };
      });
    } catch (error) {
      // Deux placements simultanés sur le même côté : l'index unique partiel arbitre.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  /** Si les 2 côtés sont occupés et qu'aucun match de table n'est en cours, crée le match (ACCEPTED) entre les deux groupes. */
  startMatchIfReady(tableId: string): Promise<StartedMatch | null> {
    return this.prisma.$transaction(async (tx) => {
      const groups = await tx.queueGroup.findMany({
        where: { tableId, status: QueueGroupStatus.ON_TABLE },
        orderBy: { slot: 'asc' },
        select: {
          format: true,
          members: {
            orderBy: { isRequester: 'desc' },
            select: { userId: true },
          },
        },
      });
      if (groups.length < 2) {
        return null;
      }
      const existing = await tx.match.findFirst({
        where: { tableId, status: 'ACCEPTED', tournamentTieId: null },
        select: { id: true },
      });
      if (existing) {
        return null;
      }
      const [teamA, teamB] = groups;
      const match = await tx.match.create({
        data: {
          format: teamA.format,
          status: 'ACCEPTED',
          teamAPlayer1Id: teamA.members[0].userId,
          teamAPlayer2Id: teamA.members[1]?.userId,
          teamBPlayer1Id: teamB.members[0].userId,
          teamBPlayer2Id: teamB.members[1]?.userId,
          tableId,
          respondedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.table.update({
        where: { id: tableId },
        data: { occupiedAt: new Date() },
      });
      return {
        matchId: match.id,
        playerIds: [...teamA.members, ...teamB.members].map((m) => m.userId),
      };
    });
  }

  /** Recale l'état de la table sur ses groupes : FREE/BUSY, heure d'occupation, format (libéré si plus aucun groupe actif) et demande de fin de match. Sans effet si un tournoi la réserve. */
  async syncTableState(tableId: string): Promise<void> {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      select: { currentTournamentTieId: true },
    });
    if (!table || table.currentTournamentTieId) {
      return;
    }
    const [onTable, active] = await Promise.all([
      this.countOnTable(tableId),
      this.prisma.queueGroup.count({
        where: { tableId, status: { in: ACTIVE_STATUSES } },
      }),
    ]);
    const data: Prisma.TableUpdateInput = {
      status: onTable > 0 ? 'BUSY' : 'FREE',
    };
    if (onTable === 0) {
      data.occupiedAt = null;
    }
    if (onTable < 2) {
      data.endRequestedAt = null;
    }
    if (active === 0) {
      data.format = null;
    }
    await this.prisma.$transaction([
      this.prisma.table.update({ where: { id: tableId }, data }),
      ...(onTable < 2
        ? [this.prisma.tableReleaseVote.deleteMany({ where: { tableId } })]
        : []),
    ]);
  }

  /** Ajoute ou retire le vote « libérer la table » de l'utilisateur et retourne les ids de tous les votants (n'importe qui peut voter, pas seulement les joueurs). */
  async toggleReleaseVote(tableId: string, userId: string): Promise<string[]> {
    const { count } = await this.prisma.tableReleaseVote.deleteMany({
      where: { tableId, userId },
    });
    if (count === 0) {
      await this.prisma.tableReleaseVote.create({ data: { tableId, userId } });
    }
    const votes = await this.prisma.tableReleaseVote.findMany({
      where: { tableId },
      select: { userId: true },
    });
    return votes.map((vote) => vote.userId);
  }

  /** Atomique : marque la fin de match demandée ; false si elle l'était déjà. */
  async markEndRequested(tableId: string): Promise<boolean> {
    const { count } = await this.prisma.table.updateMany({
      where: { id: tableId, endRequestedAt: null },
      data: { endRequestedAt: new Date() },
    });
    return count === 1;
  }

  /** Id du match de table en cours (ACCEPTED, hors tournoi), ou null. */
  async findCurrentMatchId(tableId: string): Promise<string | null> {
    const match = await this.prisma.match.findFirst({
      where: { tableId, status: 'ACCEPTED', tournamentTieId: null },
      select: { id: true },
    });
    return match?.id ?? null;
  }

  /** Table, tournoi, score et capitaines d'un match, pour décider de la rotation. */
  async getMatchInfo(matchId: string): Promise<TableMatchInfo | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        tableId: true,
        tournamentTieId: true,
        status: true,
        scoreA: true,
        scoreB: true,
        teamAPlayer1Id: true,
        teamBPlayer1Id: true,
      },
    });
  }

  /** Atomique : annule (litige) un match de table qui n'a jamais reçu de score. */
  async cancelMatch(matchId: string): Promise<boolean> {
    const { count } = await this.prisma.match.updateMany({
      where: { id: matchId, status: 'ACCEPTED' },
      data: { status: 'DISPUTED' },
    });
    return count === 1;
  }

  /** Annule tous les groupes actifs d'une table (ex: réquisition par un tournoi), annule son match en cours et la remet à zéro. Retourne les groupes annulés et s'ils étaient sur la table. */
  async cancelAllForTable(
    tableId: string,
  ): Promise<{ id: string; onTable: boolean; userIds: string[] }[]> {
    return this.prisma.$transaction(async (tx) => {
      const groups = await tx.queueGroup.findMany({
        where: { tableId, status: { in: ACTIVE_STATUSES } },
        select: {
          id: true,
          status: true,
          members: { select: { userId: true } },
        },
      });
      const ids = groups.map((group) => group.id);
      await tx.queueGroup.updateMany({
        where: { id: { in: ids } },
        data: {
          status: QueueGroupStatus.CANCELLED,
          slot: null,
          expiresAt: null,
        },
      });
      await tx.queueGroupMember.updateMany({
        where: { groupId: { in: ids } },
        data: { active: false },
      });
      await tx.tableReleaseVote.deleteMany({ where: { tableId } });
      await tx.match.updateMany({
        where: { tableId, status: 'ACCEPTED', tournamentTieId: null },
        data: { status: 'DISPUTED' },
      });
      // Une table réservée par la rencontre d'un tournoi reste occupée : seule la
      // fin de cette rencontre la libère (sinon l'accueil l'affiche « libre » alors
      // qu'un match de tournoi s'y joue).
      const table = await tx.table.findUnique({
        where: { id: tableId },
        select: { currentTournamentTieId: true },
      });
      const claimedByTournament = table?.currentTournamentTieId != null;
      await tx.table.update({
        where: { id: tableId },
        data: {
          status: claimedByTournament ? 'BUSY' : 'FREE',
          occupiedAt: claimedByTournament ? undefined : null,
          format: null,
          endRequestedAt: null,
        },
      });
      return groups.map((group) => ({
        id: group.id,
        onTable:
          (group.status as QueueGroupStatus) === QueueGroupStatus.ON_TABLE,
        userIds: group.members.map((member) => member.userId),
      }));
    });
  }

  /** Groupes appelés en attente de confirmation (reprise des délais après un redémarrage). */
  async listCalled(): Promise<
    { id: string; tableId: string; expiresAt: Date | null }[]
  > {
    return this.prisma.queueGroup.findMany({
      where: { status: QueueGroupStatus.CALLED },
      select: { id: true, tableId: true, expiresAt: true },
    });
  }

  /** Groupes dont le coéquipier n'a pas encore répondu (reprise des délais après un redémarrage). */
  async listInviting(): Promise<{ id: string; tableId: string }[]> {
    return this.prisma.queueGroup.findMany({
      where: { status: QueueGroupStatus.INVITING },
      select: { id: true, tableId: true },
    });
  }

  /** Tables dont la libération est actée mais dont le score n'est pas encore saisi. */
  async listEndRequestedTableIds(): Promise<string[]> {
    const tables = await this.prisma.table.findMany({
      where: { endRequestedAt: { not: null } },
      select: { id: true },
    });
    return tables.map((table) => table.id);
  }

  /** Ajoute la position (nombre de groupes en file arrivés avant ou en même temps) si le groupe est en file. */
  private async withPosition(
    group: QueueGroupWithMembers,
  ): Promise<QueueGroupEntity> {
    const inQueue = QUEUED_STATUSES.includes(group.status as QueueGroupStatus);
    const position = inQueue
      ? await this.prisma.queueGroup.count({
          where: {
            tableId: group.tableId,
            status: { in: QUEUED_STATUSES },
            joinedAt: { lte: group.joinedAt },
          },
        })
      : 0;
    return this.toEntity(group, position);
  }

  /** Convertit une ligne Prisma (avec ses membres) en QueueGroupEntity en y ajoutant la position. */
  private toEntity(
    group: QueueGroupWithMembers,
    position: number,
  ): QueueGroupEntity {
    return new QueueGroupEntity({
      id: group.id,
      tableId: group.tableId,
      format: group.format as MatchFormat,
      status: group.status as QueueGroupStatus,
      players: group.members.map((member) => ({
        id: member.user.id,
        displayname: member.user.displayname,
        avatarUrl: member.user.avatarUrl,
        isRequester: member.isRequester,
        accepted: member.accepted,
      })),
      joinedAt: group.joinedAt,
      calledAt: group.calledAt,
      expiresAt: group.expiresAt,
      position,
    });
  }
}
