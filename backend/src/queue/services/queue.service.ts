import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { QueueRepository } from '../repositories/queue.repository';
import {
  QueueGroupEntity,
  QueueGroupStatus,
} from '../entities/queue-group.entity';
import { QueueGateway } from '../queue.gateway';
import { TablesService } from '../../tables/services/tables.service';
import { TableEntity } from '../../tables/entities/table.entity';
import { UsersService } from '../../users/services/users.services';
import { MatchFormat } from '../../matches/entities/match.entity';
import { Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

/** Temps laissé à un groupe appelé pour confirmer sa présence à la table (règle métier : 2-3 min). */
export const QUEUE_TIMEOUT_MS = 2 * 60 * 1000;
/** Temps laissé à un ami pour accepter l'invitation en 2v2. */
export const INVITE_TIMEOUT_MS = 60 * 1000;
/** Temps laissé aux joueurs pour saisir le score après la libération de la table, sinon le match est annulé. */
export const SCORE_ENTRY_TIMEOUT_MS = 10 * 60 * 1000;
/** Nombre de votes distincts (d'une même catégorie) nécessaires pour agir sur « libérer la table ». */
export const RELEASE_VOTES_REQUIRED = 2;

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /** Injecte les dépendances : QueueRepository, QueueGateway, TablesService, UsersService, NotificationsService. */
  constructor(
    private readonly queueRepository: QueueRepository,
    private readonly queueGateway: QueueGateway,
    private readonly tablesService: TablesService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Réarme les délais (appel, invitation, saisie du score) qui étaient en cours avant un redémarrage. */
  async onModuleInit(): Promise<void> {
    try {
      for (const group of await this.queueRepository.listCalled()) {
        const remaining = group.expiresAt
          ? Math.max(0, group.expiresAt.getTime() - Date.now())
          : 0;
        this.scheduleCallExpiry(group.id, group.tableId, remaining);
      }
      for (const group of await this.queueRepository.listInviting()) {
        this.scheduleInviteExpiry(group.id, group.tableId);
      }
      for (const tableId of await this.queueRepository.listEndRequestedTableIds()) {
        this.scheduleScoreTimeout(tableId);
      }
    } catch (error) {
      this.logger.error(`Could not restore queue timers: ${error}`);
    }
  }

  /** Liste les groupes en file (en attente ou appelés) d'une table, dans l'ordre d'arrivée. */
  listForTable(tableId: string): Promise<QueueGroupEntity[]> {
    return this.queueRepository.listQueue(tableId);
  }

  /** Retourne le groupe actif de l'utilisateur (invité, en file, appelé ou sur la table), ou null. */
  getMyGroup(userId: string): Promise<QueueGroupEntity | null> {
    return this.queueRepository.findActiveGroupForUser(userId);
  }

  /** Crée un groupe pour l'utilisateur sur une table : le premier groupe d'une table vide fixe le format, les suivants le suivent ; en 2v2 l'ami choisi reçoit une invitation, sinon le groupe entre directement en file. */
  async join(
    userId: string,
    tableId: string,
    format: MatchFormat | undefined,
    teammateId: string | undefined,
  ): Promise<QueueGroupEntity> {
    const table = await this.queueRepository.getTable(tableId);
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    if (table.claimedByTournament) {
      throw new ConflictException('Table reserved for an ongoing tournament');
    }
    if (await this.queueRepository.findActiveGroupForUser(userId)) {
      throw new ConflictException('You are already on a table or in a queue');
    }
    if (table.format && format && format !== table.format) {
      throw new ConflictException(`This table is playing ${table.format}`);
    }
    const groupFormat = table.format ?? format;
    if (!groupFormat) {
      throw new BadRequestException(
        'format is required when the table is empty',
      );
    }
    const isTwoVTwo = groupFormat === MatchFormat.TWO_V_TWO;
    if (isTwoVTwo) {
      await this.assertValidTeammate(userId, teammateId);
    }

    let group: QueueGroupEntity | null;
    try {
      group = await this.queueRepository.createGroup({
        tableId,
        format: groupFormat,
        requesterId: userId,
        teammateId: isTwoVTwo ? teammateId : undefined,
        status: isTwoVTwo
          ? QueueGroupStatus.INVITING
          : QueueGroupStatus.WAITING,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You or your teammate is already on a table or in a queue',
        );
      }
      throw error;
    }
    if (!group) {
      throw new ConflictException('This table is playing another format');
    }

    if (isTwoVTwo && teammateId) {
      this.scheduleInviteExpiry(group.id, tableId);
      const requester = group.players.find((player) => player.isRequester);
      this.queueGateway.emitToUser(teammateId, 'queue:invite', {
        groupId: group.id,
        tableId,
        from: requester?.displayname ?? '?',
      });
      const table = await this.tablesService.publish(tableId);
      await this.notificationsService.create(
        teammateId,
        NotificationType.QUEUE_INVITE,
        {
          tableId,
          tableName: table.name,
          fromName: requester?.displayname ?? '?',
          groupId: group.id,
        },
      );
      return group;
    }

    await this.advance(tableId, group.id);
    return (await this.queueRepository.findGroupById(group.id)) ?? group;
  }

  /** Le coéquipier invité accepte (le groupe entre en file) ou refuse (le groupe est annulé et le demandeur prévenu). */
  async respondToInvite(
    userId: string,
    groupId: string,
    accept: boolean,
  ): Promise<QueueGroupEntity | null> {
    const group = await this.getGroup(groupId);
    if (group.status !== QueueGroupStatus.INVITING) {
      throw new ConflictException('This invitation is no longer pending');
    }
    const me = group.players.find((player) => player.id === userId);
    if (!me || me.isRequester) {
      throw new ForbiddenException('You are not invited to this group');
    }
    this.clearTimer(`invite:${groupId}`);

    if (!accept) {
      if (
        !(await this.queueRepository.finishGroup(
          groupId,
          QueueGroupStatus.CANCELLED,
          [QueueGroupStatus.INVITING],
        ))
      ) {
        throw new ConflictException('This invitation is no longer pending');
      }
      await this.queueRepository.syncTableState(group.tableId);
      this.queueGateway.emitToUsers(
        group.players.filter((p) => p.isRequester).map((p) => p.id),
        'queue:inviteDeclined',
        { tableId: group.tableId, by: me.displayname },
      );
      const table = await this.tablesService.publish(group.tableId);
      await this.notificationsService.createForUsers(
        group.players.filter((p) => p.isRequester).map((p) => p.id),
        NotificationType.QUEUE_INVITE_DECLINED,
        {
          tableId: group.tableId,
          tableName: table.name,
          byName: me.displayname,
        },
      );
      return null;
    }

    if (!(await this.queueRepository.acceptInvite(groupId, userId))) {
      throw new ConflictException('This invitation is no longer pending');
    }
    await this.advance(group.tableId, groupId);
    return this.queueRepository.findGroupById(groupId);
  }

  /** Un groupe appelé confirme sa présence : il prend sa place sur la table (et le match démarre si l'autre côté est occupé). */
  async confirm(userId: string, groupId: string): Promise<QueueGroupEntity> {
    const group = await this.getGroup(groupId);
    this.assertMember(group, userId);
    if (group.status !== QueueGroupStatus.CALLED) {
      throw new ConflictException('This group has not been called');
    }
    if (!(await this.placeOnTable(groupId))) {
      throw new ConflictException('No free spot on this table');
    }
    await this.publishQueue(group.tableId);
    return (await this.queueRepository.findGroupById(groupId)) ?? group;
  }

  /** Un membre quitte : invitation ou file annulée (le suivant est appelé si le groupe l'était), ou sortie d'un groupe seul sur la table. Impossible en plein match : il faut libérer la table. */
  async leave(userId: string, groupId: string): Promise<void> {
    const group = await this.getGroup(groupId);
    this.assertMember(group, userId);
    if (group.status === QueueGroupStatus.ON_TABLE) {
      if (await this.queueRepository.findCurrentMatchId(group.tableId)) {
        throw new ConflictException(
          'A match is in progress: release the table instead',
        );
      }
    }
    const finalStatus =
      group.status === QueueGroupStatus.ON_TABLE
        ? QueueGroupStatus.DONE
        : QueueGroupStatus.CANCELLED;
    if (
      !(await this.queueRepository.finishGroup(groupId, finalStatus, [
        QueueGroupStatus.INVITING,
        QueueGroupStatus.WAITING,
        QueueGroupStatus.CALLED,
        QueueGroupStatus.ON_TABLE,
      ]))
    ) {
      throw new ConflictException('This group is already resolved');
    }
    this.clearTimer(`invite:${groupId}`);
    this.clearTimer(`call:${groupId}`);
    const remainingIds = group.players
      .filter((p) => p.id !== userId)
      .map((p) => p.id);
    this.queueGateway.emitToUsers(remainingIds, 'queue:groupClosed', {
      tableId: group.tableId,
      by: userId,
    });
    if (remainingIds.length > 0) {
      const byName =
        group.players.find((p) => p.id === userId)?.displayname ?? '?';
      const table = await this.tablesService.getById(group.tableId);
      await this.notificationsService.createForUsers(
        remainingIds,
        NotificationType.QUEUE_GROUP_CLOSED,
        { tableId: group.tableId, tableName: table.name, byName },
      );
    }
    await this.queueRepository.syncTableState(group.tableId);
    await this.advance(group.tableId);
  }

  /** Vote « libérer la table », ouvert à n'importe quel utilisateur connecté (un second appel retire son propre vote) : à 2 joueurs du match distincts, le score est demandé ; à 2 utilisateurs distincts extérieurs au match (spectateurs, file d'attente…), la table est jugée abandonnée et le match est annulé sur-le-champ, sans score. */
  async toggleReleaseVote(
    userId: string,
    tableId: string,
  ): Promise<TableEntity> {
    const table = await this.queueRepository.getTable(tableId);
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    const matchId = await this.queueRepository.findCurrentMatchId(tableId);
    if (!matchId) {
      throw new ConflictException('No match in progress on this table');
    }
    if (table.endRequestedAt) {
      throw new ConflictException(
        'The table is already released: enter the score',
      );
    }
    const voterIds = await this.queueRepository.toggleReleaseVote(
      tableId,
      userId,
    );
    const groups = await this.queueRepository.listOnTable(tableId);
    const onTableUserIds = new Set(groups.flatMap((group) => group.userIds));
    const playerVotes = voterIds.filter((id) => onTableUserIds.has(id));
    const externalVotes = voterIds.filter((id) => !onTableUserIds.has(id));

    if (
      playerVotes.length >= RELEASE_VOTES_REQUIRED &&
      (await this.queueRepository.markEndRequested(tableId))
    ) {
      this.scheduleScoreTimeout(tableId);
      const recipients = groups.flatMap((group) => group.userIds);
      this.queueGateway.emitToUsers(recipients, 'table:scoreRequired', {
        tableId,
        matchId,
      });
      const publishedTable = await this.tablesService.getById(tableId);
      await this.notificationsService.createForUsers(
        recipients,
        NotificationType.TABLE_SCORE_REQUIRED,
        { tableId, tableName: publishedTable.name, matchId },
      );
    } else if (externalVotes.length >= RELEASE_VOTES_REQUIRED) {
      // Table jugée abandonnée par des tiers : pas de score possible, on
      // annule directement plutôt que de l'attendre des joueurs.
      await this.forceCancelMatch(tableId, matchId, 'externalRelease');
    }
    return this.tablesService.publish(tableId);
  }

  /** Appelé par MatchesService quand le score d'un match de table est soumis : le groupe perdant sort ; le gagnant reste si un groupe attend (il est alors appelé), sinon la table est libérée. */
  async onMatchScored(matchId: string): Promise<void> {
    const match = await this.queueRepository.getMatchInfo(matchId);
    if (
      !match?.tableId ||
      match.tournamentTieId ||
      match.scoreA === null ||
      match.scoreB === null
    ) {
      return;
    }
    const tableId = match.tableId;
    const groups = await this.queueRepository.listOnTable(tableId);
    const winnerCaptain =
      match.scoreA > match.scoreB ? match.teamAPlayer1Id : match.teamBPlayer1Id;
    const winner = groups.find((group) =>
      group.userIds.includes(winnerCaptain),
    );
    const loser = groups.find((group) => group !== winner);
    if (!winner || !loser) {
      await this.queueRepository.syncTableState(tableId);
      return;
    }

    this.clearTimer(`score:${tableId}`);
    await this.queueRepository.finishGroup(loser.id, QueueGroupStatus.DONE, [
      QueueGroupStatus.ON_TABLE,
    ]);
    const someoneWaiting =
      (await this.queueRepository.countWaiting(tableId)) > 0;
    if (!someoneWaiting) {
      await this.queueRepository.finishGroup(winner.id, QueueGroupStatus.DONE, [
        QueueGroupStatus.ON_TABLE,
      ]);
    }
    await this.queueRepository.syncTableState(tableId);
    this.queueGateway.emitToUsers(loser.userIds, 'table:matchEnded', {
      tableId,
      stays: false,
    });
    this.queueGateway.emitToUsers(winner.userIds, 'table:matchEnded', {
      tableId,
      stays: someoneWaiting,
    });
    const publishedTable = await this.tablesService.getById(tableId);
    await this.notificationsService.createForUsers(
      loser.userIds,
      NotificationType.TABLE_MATCH_ENDED,
      { tableId, tableName: publishedTable.name, stays: false },
    );
    await this.notificationsService.createForUsers(
      winner.userIds,
      NotificationType.TABLE_MATCH_ENDED,
      { tableId, tableName: publishedTable.name, stays: someoneWaiting },
    );
    await this.advance(tableId);
  }

  /** Vide une table qu'un tournoi vient de réquisitionner (file, groupes sur la table, match en cours) et retourne les joueurs qui étaient sur la table. */
  async clearForTable(tableId: string): Promise<string[]> {
    const cancelled = await this.queueRepository.cancelAllForTable(tableId);
    this.clearTimer(`score:${tableId}`);
    if (cancelled.length > 0) {
      const table = await this.tablesService.getById(tableId);
      for (const group of cancelled) {
        this.clearTimer(`invite:${group.id}`);
        this.clearTimer(`call:${group.id}`);
        this.queueGateway.emitToUsers(group.userIds, 'queue:expired', {
          tableId,
          reason: 'tournament',
        });
        await this.notificationsService.createForUsers(
          group.userIds,
          NotificationType.QUEUE_EXPIRED,
          { tableId, tableName: table.name, reason: 'tournament' },
        );
      }
      await this.publishQueue(tableId);
      await this.tablesService.publish(tableId);
    }
    return cancelled
      .filter((group) => group.onTable)
      .flatMap((group) => group.userIds);
  }

  /** Vérifie l'ami invité : présent, différent du demandeur, existant, ami confirmé, et libre (pas déjà dans un groupe). */
  private async assertValidTeammate(
    userId: string,
    teammateId: string | undefined,
  ): Promise<void> {
    if (!teammateId) {
      throw new BadRequestException('teammateId is required for 2v2');
    }
    if (teammateId === userId) {
      throw new BadRequestException('Invalid teammate');
    }
    if (!(await this.usersService.findUserById(teammateId))) {
      throw new NotFoundException('Teammate not found');
    }
    if (
      (await this.usersService.getFriendshipStatus(userId, teammateId)) !==
      'friends'
    ) {
      throw new ForbiddenException('Your teammate must be one of your friends');
    }
    if (await this.queueRepository.findActiveGroupForUser(teammateId)) {
      throw new ConflictException(
        'Your friend is already on a table or in a queue',
      );
    }
  }

  /** Place le groupe sur la table, lance le match si les 2 côtés sont occupés et diffuse la table ; false s'il n'y a plus de place. */
  private async placeOnTable(groupId: string): Promise<boolean> {
    const placed = await this.queueRepository.placeOnTable(groupId);
    if (!placed) {
      return false;
    }
    this.clearTimer(`call:${groupId}`);
    const started = await this.queueRepository.startMatchIfReady(
      placed.tableId,
    );
    const publishedTable = await this.tablesService.publish(placed.tableId);
    if (started) {
      this.queueGateway.emitToUsers(started.playerIds, 'table:matchStarted', {
        tableId: placed.tableId,
        matchId: started.matchId,
      });
      await this.notificationsService.createForUsers(
        started.playerIds,
        NotificationType.TABLE_MATCH_STARTED,
        {
          tableId: placed.tableId,
          tableName: publishedTable.name,
          matchId: started.matchId,
        },
      );
    }
    return true;
  }

  /** Fait avancer la file : place directement le groupe `directGroupId` s'il est en tête et qu'un côté est libre sans personne d'appelé, puis appelle autant de groupes en attente qu'il y a de côtés libres. */
  private async advance(
    tableId: string,
    directGroupId?: string,
  ): Promise<void> {
    const table = await this.queueRepository.getTable(tableId);
    if (!table || table.claimedByTournament) {
      return;
    }
    const onTable = await this.queueRepository.countOnTable(tableId);
    let called = await this.queueRepository.countCalled(tableId);

    if (directGroupId && onTable < 2 && called === 0) {
      const head = await this.queueRepository.findNextWaiting(tableId);
      if (
        head?.id === directGroupId &&
        (await this.placeOnTable(directGroupId))
      ) {
        await this.publishQueue(tableId);
        return;
      }
    }

    while (onTable + called < 2) {
      const next = await this.queueRepository.findNextWaiting(tableId);
      if (!next) {
        break;
      }
      const expiresAt = new Date(Date.now() + QUEUE_TIMEOUT_MS);
      if (!(await this.queueRepository.markCalled(next.id, expiresAt))) {
        break;
      }
      this.scheduleCallExpiry(next.id, tableId, QUEUE_TIMEOUT_MS);
      const calledIds = next.players.map((player) => player.id);
      this.queueGateway.emitToUsers(calledIds, 'queue:called', {
        tableId,
        groupId: next.id,
        expiresAt,
      });
      const publishedTable = await this.tablesService.getById(tableId);
      await this.notificationsService.createForUsers(
        calledIds,
        NotificationType.QUEUE_CALLED,
        { tableId, tableName: publishedTable.name },
      );
      called++;
    }
    await this.publishQueue(tableId);
    await this.tablesService.publish(tableId);
  }

  /** Programme l'expiration d'un groupe appelé. */
  private scheduleCallExpiry(
    groupId: string,
    tableId: string,
    delayMs: number,
  ): void {
    this.setTimer(`call:${groupId}`, delayMs, () =>
      this.handleCallExpiry(groupId, tableId),
    );
  }

  /** Programme l'annulation d'une invitation restée sans réponse. */
  private scheduleInviteExpiry(groupId: string, tableId: string): void {
    this.setTimer(`invite:${groupId}`, INVITE_TIMEOUT_MS, () =>
      this.handleInviteExpiry(groupId, tableId),
    );
  }

  /** Programme l'annulation du match si le score n'est pas saisi après la libération de la table. */
  private scheduleScoreTimeout(tableId: string): void {
    this.setTimer(`score:${tableId}`, SCORE_ENTRY_TIMEOUT_MS, () =>
      this.handleScoreTimeout(tableId),
    );
  }

  /** Marque le groupe comme expiré s'il est toujours appelé, prévient ses joueurs et appelle le suivant. */
  private async handleCallExpiry(
    groupId: string,
    tableId: string,
  ): Promise<void> {
    const group = await this.queueRepository.findGroupById(groupId);
    if (
      !(await this.queueRepository.finishGroup(
        groupId,
        QueueGroupStatus.EXPIRED,
        [QueueGroupStatus.CALLED],
      ))
    ) {
      return;
    }
    if (group) {
      const recipients = group.players.map((player) => player.id);
      this.queueGateway.emitToUsers(recipients, 'queue:expired', { tableId });
      const table = await this.tablesService.getById(tableId);
      await this.notificationsService.createForUsers(
        recipients,
        NotificationType.QUEUE_EXPIRED,
        { tableId, tableName: table.name },
      );
    }
    await this.queueRepository.syncTableState(tableId);
    await this.advance(tableId);
  }

  /** Annule le groupe dont le coéquipier n'a pas répondu à temps et prévient les deux joueurs. */
  private async handleInviteExpiry(
    groupId: string,
    tableId: string,
  ): Promise<void> {
    const group = await this.queueRepository.findGroupById(groupId);
    if (
      !(await this.queueRepository.finishGroup(
        groupId,
        QueueGroupStatus.CANCELLED,
        [QueueGroupStatus.INVITING],
      ))
    ) {
      return;
    }
    if (group) {
      const recipients = group.players.map((player) => player.id);
      this.queueGateway.emitToUsers(recipients, 'queue:expired', {
        tableId,
        reason: 'invite',
      });
      const table = await this.tablesService.getById(tableId);
      await this.notificationsService.createForUsers(
        recipients,
        NotificationType.QUEUE_EXPIRED,
        { tableId, tableName: table.name, reason: 'invite' },
      );
    }
    await this.queueRepository.syncTableState(tableId);
    await this.tablesService.publish(tableId);
  }

  /** Score jamais saisi dans le délai : le match est annulé et la table repart à zéro. */
  private async handleScoreTimeout(tableId: string): Promise<void> {
    const table = await this.queueRepository.getTable(tableId);
    if (!table?.endRequestedAt) {
      return;
    }
    const matchId = await this.queueRepository.findCurrentMatchId(tableId);
    if (!matchId) {
      return;
    }
    await this.forceCancelMatch(tableId, matchId, 'timeout');
  }

  /** Annule un match de table sans score (délai de saisie écoulé, ou table jugée abandonnée par des tiers) : les deux groupes sortent, la table est remise à zéro et la file avance. */
  private async forceCancelMatch(
    tableId: string,
    matchId: string,
    reason: 'timeout' | 'externalRelease',
  ): Promise<void> {
    this.clearTimer(`score:${tableId}`);
    const groups = await this.queueRepository.listOnTable(tableId);
    await this.queueRepository.cancelMatch(matchId);
    for (const group of groups) {
      await this.queueRepository.finishGroup(group.id, QueueGroupStatus.DONE, [
        QueueGroupStatus.ON_TABLE,
      ]);
    }
    await this.queueRepository.syncTableState(tableId);
    const recipients = groups.flatMap((group) => group.userIds);
    this.queueGateway.emitToUsers(recipients, 'table:matchCancelled', {
      tableId,
      matchId,
      reason,
    });
    const table = await this.tablesService.getById(tableId);
    await this.notificationsService.createForUsers(
      recipients,
      NotificationType.TABLE_MATCH_CANCELLED,
      { tableId, tableName: table.name, reason },
    );
    await this.advance(tableId);
  }

  /** Retrouve un groupe par id ou lève une NotFoundException. */
  private async getGroup(groupId: string): Promise<QueueGroupEntity> {
    const group = await this.queueRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Queue group not found');
    }
    return group;
  }

  /** Lève une ForbiddenException si l'utilisateur ne fait pas partie du groupe. */
  private assertMember(group: QueueGroupEntity, userId: string): void {
    if (!group.players.some((player) => player.id === userId)) {
      throw new ForbiddenException('Not your group');
    }
  }

  /** Diffuse en temps réel la liste à jour de la file d'une table à tous les clients. */
  private async publishQueue(tableId: string): Promise<void> {
    const groups = await this.queueRepository.listQueue(tableId);
    this.queueGateway.emitQueueUpdate(tableId, groups);
  }

  /** Arme (en remplaçant l'éventuel précédent) un minuteur dont les erreurs sont journalisées au lieu de faire tomber le process. */
  private setTimer(
    key: string,
    delayMs: number,
    task: () => Promise<void>,
  ): void {
    this.clearTimer(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      task().catch((error: unknown) =>
        this.logger.error(`Timer ${key} failed: ${String(error)}`),
      );
    }, delayMs);
    this.timers.set(key, timer);
  }

  /** Annule et oublie un minuteur, s'il existe. */
  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
