import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, Status, UserEntity } from '../entities/users.entity';
import type {
  LanguagePreference,
  ThemePreference,
} from '../entities/users.entity';
import { Prisma, RefreshToken, User } from '../../generated/prisma/client';
import {
  PageQueryDto,
  pageOffset,
} from '../../common/pagination/page-query.dto';
import { Profile42Dto } from '../../auth/dtos/profile42.dto';
import { RefreshToken as RefreshTokenEntity } from '../entities/users.entity';
import { RankingEntry } from '../entities/ranking-entry.entity';
import { RankingQueryDto } from '../dtos/ranking-query.dto';

@Injectable()
export class UserRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** Retrouve un utilisateur par id, avec ses refresh tokens, ou null. */
  async findUserById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    // Un compte anonymisé (RGPD) est traité comme inexistant : plus de connexion, ni de profil.
    return user && !user.deletedAt ? this.mapUser(user) : null;
  }

  /** Retrouve un utilisateur par email, avec ses refresh tokens, ou null. */
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return user ? this.mapUser(user) : null;
  }

  /** Retrouve un utilisateur par login 42, avec ses refresh tokens, ou null. */
  async findUserByLogin(login: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { login42: login },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return user ? this.mapUser(user) : null;
  }

  /** Crée un utilisateur à partir d'un profil 42 (login, email, nom complet, avatar). */
  async createUserFrom42Profile(profile: Profile42Dto): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        login42: profile._json.login,
        email: profile._json.email,
        displayname: profile._json.first_name + ' ' + profile._json.last_name,
        avatarUrl: profile._json.image?.link,
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return this.mapUser(user);
  }

  /** Crée un utilisateur à partir d'une inscription classique (email, nom, mot de passe haché). */
  async createUserFromRegisterInfo(user: UserEntity): Promise<UserEntity> {
    const newUser = await this.prisma.user.create({
      data: {
        email: user.email,
        displayname: user.displayname,
        passwordHash: user.passwordHash,
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return this.mapUser(newUser);
  }

  /** Met à jour les champs modifiables de l'utilisateur (2FA, présence, rôle, avatar, mot de passe, nom, email, préférences). */
  async updateUser(user: UserEntity): Promise<UserEntity> {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorSecret: user.twoFactorSecret,
        twoFactorPendingSecret: user.twoFactorPendingSecret,
        isOnline: user.isOnline,
        status: user.status,
        role: user.role,
        avatarUrl: user.avatarUrl,
        passwordHash: user.passwordHash,
        displayname: user.displayname,
        email: user.email,
        theme: user.theme,
        language: user.language,
        accent: user.accent,
        radius: user.radius,
      },
      include: {
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return this.mapUser(updatedUser);
  }

  /** Insère un refresh token (hash + expiration) pour l'utilisateur. */
  async addRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  /** Supprime un refresh token de l'utilisateur ; retourne true si au moins une ligne a été supprimée. */
  async deleteRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        tokenHash,
      },
    });
    return result.count > 0;
  }

  /** Retrouve un refresh token par son hash, uniquement s'il appartient à l'utilisateur, sinon null. */
  async findRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<RefreshTokenEntity | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!refreshToken || refreshToken.userId !== userId) {
      return null;
    }
    return new RefreshTokenEntity({
      id: refreshToken.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
      createdAt: refreshToken.createdAt,
    });
  }

  /** Remplace le jeton de réinitialisation du mot de passe de l'utilisateur (un seul actif à la fois). */
  async replacePasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      }),
    ]);
  }

  /** Consomme un jeton de réinitialisation valide (usage unique) : change le mot de passe et révoque toutes les sessions. Retourne l'utilisateur concerné, ou null si le jeton est inconnu, expiré ou déjà utilisé. */
  async consumePasswordResetToken(
    tokenHash: string,
    passwordHash: string,
  ): Promise<UserEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!stored || stored.expiresAt.getTime() <= Date.now()) return null;
      // Le contrôle du compteur garantit l'usage unique même en cas de requêtes concurrentes.
      const deleted = await tx.passwordResetToken.deleteMany({
        where: { tokenHash },
      });
      if (deleted.count === 0) return null;
      await tx.passwordResetToken.deleteMany({
        where: { userId: stored.userId },
      });
      await tx.refreshToken.deleteMany({ where: { userId: stored.userId } });
      const user = await tx.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
        include: { refreshTokens: { orderBy: { createdAt: 'desc' } } },
      });
      return this.mapUser(user);
    });
  }

  /** Cherche des utilisateurs par nom ou email (insensible à la casse), triés par nom, en excluant l'utilisateur donné : une page de résultats plus le total. */
  async searchUsers(
    excludeUserId: string,
    query: string | undefined,
    page: PageQueryDto,
  ): Promise<{ users: UserEntity[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      id: { not: excludeUserId },
      deletedAt: null,
      ...this.textFilter(query),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          refreshTokens: {
            orderBy: { createdAt: 'desc' as const },
          },
        },
        orderBy: { displayname: 'asc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: users.map((user) => this.mapUser(user)), total };
  }

  /** Relation d'amitié de l'utilisateur avec chacun des `otherIds` ('friends', 'pending_out' ou 'pending_in') ; les absents n'ont aucune relation. */
  async findFriendshipStatuses(
    userId: string,
    otherIds: string[],
  ): Promise<Map<string, 'friends' | 'pending_out' | 'pending_in'>> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: { in: otherIds } },
          { addresseeId: userId, requesterId: { in: otherIds } },
        ],
      },
      select: { requesterId: true, addresseeId: true, status: true },
    });
    const statuses = new Map<
      string,
      'friends' | 'pending_out' | 'pending_in'
    >();
    for (const row of rows) {
      const isRequester = row.requesterId === userId;
      const otherId = isRequester ? row.addresseeId : row.requesterId;
      statuses.set(
        otherId,
        row.status === 'ACCEPTED'
          ? 'friends'
          : isRequester
            ? 'pending_out'
            : 'pending_in',
      );
    }
    return statuses;
  }

  /** Filtre Prisma « le nom ou l'email contient le texte » (insensible à la casse) ; vide si aucun texte. */
  private textFilter(query?: string): Prisma.UserWhereInput {
    const text = query?.trim();
    if (!text) {
      return {};
    }
    return {
      OR: [
        { displayname: { contains: text, mode: 'insensitive' } },
        { email: { contains: text, mode: 'insensitive' } },
      ],
    };
  }

  /** Retrouve la relation d'amitié entre deux utilisateurs, quel que soit celui qui a fait la demande. */
  async findFriendshipBetween(userIdA: string, userIdB: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userIdA, addresseeId: userIdB },
          { requesterId: userIdB, addresseeId: userIdA },
        ],
      },
    });
  }

  /** Crée une demande d'ami au statut PENDING. */
  async createFriendRequest(requesterId: string, addresseeId: string) {
    return this.prisma.friendship.create({
      data: { requesterId, addresseeId, status: 'PENDING' },
    });
  }

  /** Passe une relation d'amitié au statut ACCEPTED. */
  async acceptFriendship(id: string) {
    return this.prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
  }

  /** Supprime une relation d'amitié ou une demande. */
  async deleteFriendship(id: string) {
    await this.prisma.friendship.delete({ where: { id } });
  }

  /** Liste les amis confirmés de l'utilisateur (l'autre partie de chaque amitié acceptée), en ligne d'abord puis par nom : une page plus le total. Filtres optionnels : texte (nom ou email) et « en ligne seulement ». */
  async listAcceptedFriends(
    userId: string,
    page: PageQueryDto,
    filters: { query?: string; onlineOnly?: boolean } = {},
  ): Promise<{ users: UserEntity[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      OR: [
        {
          friendshipsReceived: {
            some: { requesterId: userId, status: 'ACCEPTED' },
          },
        },
        {
          friendshipsSent: {
            some: { addresseeId: userId, status: 'ACCEPTED' },
          },
        },
      ],
      ...(filters.onlineOnly ? { isOnline: true } : {}),
      ...(filters.query?.trim()
        ? { AND: [this.textFilter(filters.query)] }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { refreshTokens: true },
        orderBy: [{ isOnline: 'desc' }, { displayname: 'asc' }],
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: users.map((user) => this.mapUser(user)), total };
  }

  /** Liste les utilisateurs ayant envoyé une demande d'ami en attente à cet utilisateur, les plus récentes d'abord : une page plus le total. */
  async listIncomingRequests(
    userId: string,
    page: PageQueryDto,
  ): Promise<{ users: UserEntity[]; total: number }> {
    const where: Prisma.FriendshipWhereInput = {
      addresseeId: userId,
      status: 'PENDING',
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.friendship.findMany({
        where,
        include: { requester: { include: { refreshTokens: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.friendship.count({ where }),
    ]);
    return { users: rows.map((row) => this.mapUser(row.requester)), total };
  }

  /** Liste les utilisateurs auxquels cet utilisateur a envoyé une demande d'ami en attente, les plus récentes d'abord : une page plus le total. */
  async listOutgoingRequests(
    userId: string,
    page: PageQueryDto,
  ): Promise<{ users: UserEntity[]; total: number }> {
    const where: Prisma.FriendshipWhereInput = {
      requesterId: userId,
      status: 'PENDING',
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.friendship.findMany({
        where,
        include: { addressee: { include: { refreshTokens: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.friendship.count({ where }),
    ]);
    return { users: rows.map((row) => this.mapUser(row.addressee)), total };
  }

  /** Ids de tous les amis confirmés de l'utilisateur (sans pagination : usage interne, ex. diffusion de la présence). */
  async listAcceptedFriendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((row) =>
      row.requesterId === userId ? row.addresseeId : row.requesterId,
    );
  }

  /** Classement des joueurs actifs par note Elo (ex æquo = même rang), filtré par nom, périmètre (amis) et nombre de matchs, trié, une page plus le total. Le rang affiché reste le rang général, quel que soit le filtre. */
  async listRanking(
    userId: string,
    query: RankingQueryDto,
  ): Promise<{ entries: RankingEntry[]; total: number }> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayname: true,
        avatarUrl: true,
        rating: true,
        matchesPlayed: true,
      },
      orderBy: [{ rating: 'desc' }, { createdAt: 'asc' }],
    });
    let previousRating: number | null = null;
    let currentRank = 0;
    let ranked = users.map((user, index) => {
      if (user.rating !== previousRating) {
        currentRank = index + 1;
        previousRating = user.rating;
      }
      return new RankingEntry({ ...user, rank: currentRank });
    });

    if (query.scope === 'friends') {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = new Set(
        friendships.flatMap((f) => [f.requesterId, f.addresseeId]),
      );
      // Toi aussi, pour te situer parmi tes amis.
      friendIds.add(userId);
      ranked = ranked.filter((entry) => friendIds.has(entry.id));
    }
    const text = query.q?.trim().toLowerCase();
    if (text) {
      ranked = ranked.filter((entry) =>
        entry.displayname.toLowerCase().includes(text),
      );
    }
    if (query.minMatches) {
      const min = query.minMatches;
      ranked = ranked.filter((entry) => entry.matchesPlayed >= min);
    }
    if (query.sort === 'matches') {
      ranked.sort(
        (a, b) => b.matchesPlayed - a.matchesPlayed || a.rank - b.rank,
      );
    } else if (query.sort === 'name') {
      ranked.sort((a, b) => a.displayname.localeCompare(b.displayname));
    }
    const skip = pageOffset(query);
    return {
      entries: ranked.slice(skip, skip + query.limit),
      total: ranked.length,
    };
  }

  /** Met à jour l'état de connexion et le statut de l'utilisateur. */
  async updatePresence(
    userId: string,
    isOnline: boolean,
    status: Status,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, status },
    });
  }

  /** Convertit un utilisateur Prisma (avec refresh tokens) en UserEntity, en normalisant statut, rôle et préférences. */
  private mapUser(user: User & { refreshTokens: RefreshToken[] }): UserEntity {
    let status: Status = Status.OFFLINE;
    switch (user.status) {
      case 'ONLINE':
        status = Status.ONLINE;
        break;
      case 'OFFLINE':
        status = Status.OFFLINE;
        break;
      case 'IN_GAME':
        status = Status.IN_GAME;
        break;
    }
    let role: Role = Role.USER;
    switch (user.role) {
      case 'ADMIN':
        role = Role.ADMIN;
        break;
      case 'USER':
        role = Role.USER;
        break;
    }
    const theme: ThemePreference = user.theme;
    const language: LanguagePreference = user.language;
    return new UserEntity({
      id: user.id,
      login42: user.login42,
      email: user.email,
      displayname: user.displayname,
      avatarUrl: user.avatarUrl,
      passwordHash: user.passwordHash,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      twoFactorPendingSecret: user.twoFactorPendingSecret,
      isOnline: user.isOnline,
      status,
      theme: theme,
      language: language,
      accent: user.accent,
      radius: user.radius,
      role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      refreshTokens: user.refreshTokens.map(
        (refreshToken) =>
          new RefreshTokenEntity({
            id: refreshToken.id,
            tokenHash: refreshToken.tokenHash,
            expiresAt: refreshToken.expiresAt,
            createdAt: refreshToken.createdAt,
          }),
      ),
    });
  }
}
