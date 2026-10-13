import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { UserRepository } from '../repositories/users.repository';
import { PresenceGateway } from '../../presence/presence.gateway';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { RefreshToken, Status, UserEntity } from '../entities/users.entity';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';
import { RegisterDto } from '../../auth/dtos/register.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { UpdateSettingsDto } from '../dtos/update-settings.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { Paginated, toPaginated } from '../../common/pagination/paginated';
import { RankingEntry } from '../entities/ranking-entry.entity';
import { RankingQueryDto } from '../dtos/ranking-query.dto';

/** Utilisateur renvoyé par la recherche, avec sa relation d'amitié avec l'utilisateur connecté. */
export type UserWithFriendship = UserEntity & {
  friendshipStatus: 'none' | 'pending_out' | 'pending_in' | 'friends';
};

/** [Major · Gestion des utilisateurs] Service métier des utilisateurs (profil, amis, classement). */
@Injectable()
export class UsersService {
  /** [Major · Gestion des utilisateurs] Injecte les dépendances : UserRepository, PresenceGateway, NotificationsService. */
  constructor(
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => PresenceGateway))
    private readonly presenceGateway: PresenceGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /** [Major · Gestion des utilisateurs] Retrouve un utilisateur par id, ou null. */
  findUserById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findUserById(id);
  }

  /** [Major · Gestion des utilisateurs] Retrouve un utilisateur par email, ou null. */
  findUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findUserByEmail(email);
  }

  /** [Major · Gestion des utilisateurs] Retrouve un utilisateur par login 42, ou null. */
  findUserByLogin(login: string): Promise<UserEntity | null> {
    return this.userRepository.findUserByLogin(login);
  }

  /** [Major · Interaction entre utilisateurs] Retourne un utilisateur par id ou lève une NotFoundException. */
  async getProfile(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findUserById(id);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    return user;
  }

  /** [Major · Interaction entre utilisateurs] Profil public : la presence n'est visible qu'aux amis (ou soi-même). */
  async getProfileForViewer(
    viewerId: string,
    targetId: string,
  ): Promise<{
    user: UserEntity;
    friendshipStatus:
      'none' | 'pending_out' | 'pending_in' | 'friends' | 'self';
  }> {
    const user = await this.getProfile(targetId);
    const friendshipStatus = await this.getFriendshipStatus(viewerId, targetId);
    if (friendshipStatus !== 'friends' && friendshipStatus !== 'self') {
      return { user: this.hidePresence(user), friendshipStatus };
    }
    return { user, friendshipStatus };
  }

  /** [Minor · Recherche avancée] Recherche paginée d'utilisateurs (hors l'utilisateur courant) : chaque résultat porte sa relation d'amitié avec l'utilisateur, et la présence des non-amis est masquée. */
  async searchUsers(
    excludeUserId: string,
    query: string | undefined,
    page: PageQueryDto,
  ): Promise<Paginated<UserWithFriendship>> {
    const { users, total } = await this.userRepository.searchUsers(
      excludeUserId,
      query,
      page,
    );
    const statuses = await this.userRepository.findFriendshipStatuses(
      excludeUserId,
      users.map((user) => user.id),
    );
    const items = users.map((user): UserWithFriendship => {
      const friendshipStatus: UserWithFriendship['friendshipStatus'] =
        statuses.get(user.id) ?? 'none';
      const visible =
        friendshipStatus === 'friends' ? user : this.hidePresence(user);
      return Object.assign(visible, { friendshipStatus });
    });
    return toPaginated(items, total, page);
  }

  /** [Major · Gestion des utilisateurs] Masque isOnline / status pour les non-amis. */
  private hidePresence(user: UserEntity): UserEntity {
    user.isOnline = false;
    user.status = Status.OFFLINE;
    return user;
  }

  /** [Major · Gestion des utilisateurs] Crée un utilisateur à partir du profil renvoyé par l'OAuth 42. */
  createUserFrom42Profile(profile: Profile42Dto): Promise<UserEntity> {
    return this.userRepository.createUserFrom42Profile(profile);
  }

  /** [Major · Gestion des utilisateurs] Crée un utilisateur avec mot de passe haché (bcrypt) ; lève une ConflictException si l'email est déjà pris. */
  async createUserFromRegisterInfo(
    registerDto: RegisterDto,
  ): Promise<UserEntity> {
    try {
      const passwordHash = await bcrypt.hash(registerDto.password, 10);
      const user = new UserEntity({
        email: registerDto.email,
        displayname: registerDto.username,
        passwordHash,
      });
      return await this.userRepository.createUserFromRegisterInfo(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Email already in use',
          code: 'EMAIL_ALREADY_USED',
        });
      }
      throw error;
    }
  }

  /** [Major · Gestion des utilisateurs] Enregistre en base l'état complet de l'entité utilisateur. */
  updateUser(user: UserEntity): Promise<UserEntity> {
    return this.userRepository.updateUser(user);
  }

  /** [Major · Gestion des utilisateurs] Met à jour le nom d'affichage (espaces retirés) de l'utilisateur. */
  async updateProfile(
    user: UserEntity,
    dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    user.displayname = dto.displayname.trim();
    return this.userRepository.updateUser(user);
  }

  /** [Major · Gestion des utilisateurs] Met à jour le thème, la langue, la couleur principale et l'arrondi des bordures de l'utilisateur. */
  async updateSettings(
    user: UserEntity,
    dto: UpdateSettingsDto,
  ): Promise<UserEntity> {
    user.theme = dto.theme;
    user.language = dto.language;
    if (dto.accent) user.accent = dto.accent;
    if (dto.radius) user.radius = dto.radius;
    return this.userRepository.updateUser(user);
  }

  /** [Major · Gestion des utilisateurs] Enregistre le nouvel avatar et supprime l'ancien fichier s'il était stocké localement. */
  async updateAvatar(user: UserEntity, filename: string): Promise<UserEntity> {
    const previous = user.avatarUrl;
    user.avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await this.userRepository.updateUser(user);
    if (previous?.startsWith('/uploads/avatars/')) {
      const previousPath = join(process.cwd(), previous);
      await unlink(previousPath).catch(() => undefined);
    }
    return updated;
  }

  /** [Major · Interaction entre utilisateurs] Envoie une demande d'ami et notifie le destinataire ; si l'autre avait déjà envoyé une demande, l'amitié est acceptée. Refuse si on se cible soi-même, déjà amis ou demande déjà envoyée. */
  async sendFriendRequest(
    requester: UserEntity,
    addresseeId: string,
  ): Promise<UserEntity> {
    if (requester.id === addresseeId) {
      throw new BadRequestException({
        message: 'Cannot add yourself as a friend',
        code: 'CANNOT_FRIEND_SELF',
      });
    }
    const addressee = await this.getProfile(addresseeId);
    const existing = await this.userRepository.findFriendshipBetween(
      requester.id,
      addresseeId,
    );
    if (!existing) {
      await this.userRepository.createFriendRequest(requester.id, addresseeId);
      this.presenceGateway.emitToUser(addresseeId, 'friend:request', {
        userId: requester.id,
      });
      await this.notificationsService.create(
        addresseeId,
        NotificationType.FRIEND_REQUEST,
        { fromId: requester.id, fromName: requester.displayname },
      );
      return addressee;
    }
    if (existing.status === 'ACCEPTED') {
      throw new ConflictException({
        message: 'Already friends',
        code: 'ALREADY_FRIENDS',
      });
    }
    if (existing.requesterId === requester.id) {
      throw new ConflictException({
        message: 'Friend request already sent',
        code: 'FRIEND_REQUEST_ALREADY_SENT',
      });
    }
    await this.userRepository.acceptFriendship(existing.id);
    this.presenceGateway.emitToUser(addresseeId, 'friend:update', {
      userId: requester.id,
    });
    return addressee;
  }

  /** [Major · Interaction entre utilisateurs] Accepte la demande d'ami reçue d'un utilisateur et le notifie ; 404 si aucune demande en attente ne lui est adressée. */
  async acceptFriendRequest(
    currentUser: UserEntity,
    requesterId: string,
  ): Promise<UserEntity> {
    const existing = await this.userRepository.findFriendshipBetween(
      currentUser.id,
      requesterId,
    );
    if (
      !existing ||
      existing.status !== 'PENDING' ||
      existing.addresseeId !== currentUser.id
    ) {
      throw new NotFoundException({
        message: 'Friend request not found',
        code: 'FRIEND_REQUEST_NOT_FOUND',
      });
    }
    await this.userRepository.acceptFriendship(existing.id);
    this.presenceGateway.emitToUser(requesterId, 'friend:update', {
      userId: currentUser.id,
    });
    return this.getProfile(requesterId);
  }

  /** [Major · Interaction entre utilisateurs] Supprime l'amitié ou la demande entre deux utilisateurs et notifie l'autre ; 404 si aucune relation n'existe. */
  async removeFriendship(
    currentUser: UserEntity,
    otherUserId: string,
  ): Promise<void> {
    const existing = await this.userRepository.findFriendshipBetween(
      currentUser.id,
      otherUserId,
    );
    if (!existing) {
      throw new NotFoundException({
        message: 'Friendship not found',
        code: 'FRIENDSHIP_NOT_FOUND',
      });
    }
    await this.userRepository.deleteFriendship(existing.id);
    this.presenceGateway.emitToUser(otherUserId, 'friend:update', {
      userId: currentUser.id,
    });
  }

  /** [Major · Interaction entre utilisateurs] Supprime silencieusement la relation d'amitié entre deux utilisateurs si elle existe (utilisé au blocage). */
  async removeFriendshipIfExists(
    userId: string,
    otherUserId: string,
  ): Promise<void> {
    const existing = await this.userRepository.findFriendshipBetween(
      userId,
      otherUserId,
    );
    if (existing) {
      await this.userRepository.deleteFriendship(existing.id);
    }
  }

  /** [Major · Interaction entre utilisateurs] Liste une page des amis confirmés de l'utilisateur (en ligne d'abord), avec filtres optionnels texte / en ligne. */
  async listFriends(
    userId: string,
    page: PageQueryDto,
    filters: { query?: string; onlineOnly?: boolean } = {},
  ): Promise<Paginated<UserEntity>> {
    const { users, total } = await this.userRepository.listAcceptedFriends(
      userId,
      page,
      filters,
    );
    return toPaginated(users, total, page);
  }

  /** [Major · Interaction entre utilisateurs] Ids de tous les amis confirmés (sans pagination : usage interne, ex. présence en temps réel). */
  listFriendIds(userId: string): Promise<string[]> {
    return this.userRepository.listAcceptedFriendIds(userId);
  }

  /** [Major · Interaction entre utilisateurs] Liste une page des demandes d'ami reçues par l'utilisateur et non encore acceptées. */
  async listPendingRequests(
    userId: string,
    page: PageQueryDto,
  ): Promise<Paginated<UserEntity>> {
    const { users, total } = await this.userRepository.listIncomingRequests(
      userId,
      page,
    );
    return toPaginated(users, total, page);
  }

  /** [Major · Interaction entre utilisateurs] Liste une page des demandes d'ami envoyées par l'utilisateur et non encore acceptées. */
  async listOutgoingRequests(
    userId: string,
    page: PageQueryDto,
  ): Promise<Paginated<UserEntity>> {
    const { users, total } = await this.userRepository.listOutgoingRequests(
      userId,
      page,
    );
    return toPaginated(users, total, page);
  }

  /** [Major · Interaction entre utilisateurs] Retourne la relation entre deux utilisateurs : 'self', 'none', 'pending_out', 'pending_in' ou 'friends'. */
  async getFriendshipStatus(
    currentUserId: string,
    otherUserId: string,
  ): Promise<'none' | 'pending_out' | 'pending_in' | 'friends' | 'self'> {
    if (currentUserId === otherUserId) {
      return 'self';
    }
    const existing = await this.userRepository.findFriendshipBetween(
      currentUserId,
      otherUserId,
    );
    if (!existing) {
      return 'none';
    }
    if (existing.status === 'ACCEPTED') {
      return 'friends';
    }
    return existing.requesterId === currentUserId
      ? 'pending_out'
      : 'pending_in';
  }

  /** [Major · Gestion des utilisateurs] Enregistre le hash d'un refresh token pour l'utilisateur, avec sa date d'expiration. */
  addRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.userRepository.addRefreshToken(userId, tokenHash, expiresAt);
  }

  /** [Major · Gestion des utilisateurs] Révoque (supprime) un refresh token ; retourne true s'il existait. */
  async revokeRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    return this.userRepository.deleteRefreshToken(userId, tokenHash);
  }

  /** [Major · Gestion des utilisateurs] Enregistre le hash du jeton de réinitialisation de mot de passe de l'utilisateur (remplace le précédent). */
  savePasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.userRepository.replacePasswordResetToken(
      userId,
      tokenHash,
      expiresAt,
    );
  }

  /** [Major · Gestion des utilisateurs] Consomme un jeton de réinitialisation (usage unique), change le mot de passe et révoque les sessions ; null si le jeton est invalide ou expiré. */
  async consumePasswordResetToken(
    tokenHash: string,
    newPassword: string,
  ): Promise<UserEntity | null> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.userRepository.consumePasswordResetToken(
      tokenHash,
      passwordHash,
    );
  }

  /** [Minor · 2FA] Remplace les codes de secours 2FA de l'utilisateur par un nouveau lot (hashs). */
  replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void> {
    return this.userRepository.replaceRecoveryCodes(userId, codeHashes);
  }

  /** [Minor · 2FA] Supprime les codes de secours 2FA de l'utilisateur. */
  deleteRecoveryCodes(userId: string): Promise<void> {
    return this.userRepository.deleteRecoveryCodes(userId);
  }

  /** [Minor · 2FA] Consomme un code de secours (usage unique) ; retourne true s'il était valide. */
  consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    return this.userRepository.consumeRecoveryCode(userId, codeHash);
  }

  /** [Minor · 2FA] Nombre de codes de secours encore utilisables. */
  countUnusedRecoveryCodes(userId: string): Promise<number> {
    return this.userRepository.countUnusedRecoveryCodes(userId);
  }

  /** [Major · Gestion des utilisateurs] Retrouve un refresh token de l'utilisateur à partir de son hash, ou null. */
  findRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    return this.userRepository.findRefreshToken(userId, tokenHash);
  }

  /** [Major · Temps réel WebSockets] Met à jour l'état de connexion et le statut (en ligne, hors ligne, en jeu) de l'utilisateur. */
  updatePresence(
    userId: string,
    isOnline: boolean,
    status: Status,
  ): Promise<void> {
    return this.userRepository.updatePresence(userId, isOnline, status);
  }

  /** [Minor · Stats et historique] Retourne une page du classement des joueurs par note Elo, avec recherche, filtres et tri. */
  async getRanking(
    userId: string,
    query: RankingQueryDto,
  ): Promise<Paginated<RankingEntry>> {
    const { entries, total } = await this.userRepository.listRanking(
      userId,
      query,
    );
    return toPaginated(entries, total, query);
  }
}
