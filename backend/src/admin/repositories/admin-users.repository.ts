import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  PageQueryDto,
  pageOffset,
} from '../../common/pagination/page-query.dto';
import { Role, Status } from '../../users/entities/users.entity';

const adminSelect = {
  id: true,
  login42: true,
  email: true,
  displayname: true,
  avatarUrl: true,
  role: true,
  twoFactorEnabled: true,
  isOnline: true,
  status: true,
  rating: true,
  matchesPlayed: true,
  wins: true,
  // Jamais renvoyé tel quel : sert uniquement à calculer `hasPassword`.
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** [Major · Permissions avancées] Ban en cours : permanent (pas de date de fin) ou pas encore terminé. */
const activeBan = (): Prisma.BanWhereInput => ({
  OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
});

/** [Major · Permissions avancées] Construit le `select` Prisma d'un utilisateur côté admin, enrichi de son ban actif le plus récent. */
const adminSelectWithBan = () =>
  ({
    ...adminSelect,
    banReceived: {
      where: activeBan(),
      orderBy: { startTime: 'desc' },
      take: 1,
      select: { reason: true, startTime: true, endTime: true },
    },
  }) satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{
  select: ReturnType<typeof adminSelectWithBan>;
}>;

/** Vue d'un utilisateur pour l'administration : jamais de hash, de secret 2FA ni de jeton. */
export interface AdminUserView {
  id: string;
  login42: string | null;
  email: string;
  displayname: string;
  avatarUrl: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  isOnline: boolean;
  status: Status;
  rating: number;
  matchesPlayed: number;
  wins: number;
  hasPassword: boolean;
  /** Ban en cours (null si l'utilisateur n'est pas banni ; endTime null = permanent). */
  ban: { reason: string; startTime: Date; endTime: Date | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

/** [Major · Permissions avancées] Dépôt de données de l'administration des utilisateurs (CRUD réservé aux admins) : requêtes Prisma et conversion en entités. */
@Injectable()
export class AdminUsersRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Major · Permissions avancées] Une page d'utilisateurs actifs (comptes supprimés exclus) filtrés par nom, email ou login 42, triés par nom, plus le total. */
  async list(
    q: string | undefined,
    page: PageQueryDto,
    bannedOnly = false,
  ): Promise<{ users: AdminUserView[]; total: number }> {
    const term = q?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(bannedOnly ? { banReceived: { some: activeBan() } } : {}),
      ...(term
        ? {
            OR: [
              { displayname: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
              { login42: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: adminSelectWithBan(),
        orderBy: [{ displayname: 'asc' }, { id: 'asc' }],
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: users.map((user) => this.toView(user)), total };
  }

  /** [Major · Permissions avancées] Retrouve un utilisateur actif par id, ou null (inconnu ou supprimé). */
  async findById(id: string): Promise<AdminUserView | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: adminSelectWithBan(),
    });
    return user ? this.toView(user) : null;
  }

  /** [Major · Permissions avancées] Retrouve l'id d'un utilisateur par email exact (colonne unique), ou null. */
  async findIdByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /** [Major · Permissions avancées] Nombre d'administrateurs actifs. */
  countAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { role: Role.ADMIN, deletedAt: null },
    });
  }

  /** [Major · Permissions avancées] Crée un utilisateur avec mot de passe déjà haché et rôle donné. */
  async create(data: {
    email: string;
    displayname: string;
    passwordHash: string;
    role: Role;
  }): Promise<AdminUserView> {
    const user = await this.prisma.user.create({
      data,
      select: adminSelectWithBan(),
    });
    return this.toView(user);
  }

  /** [Major · Permissions avancées] Met à jour les champs fournis ; si le mot de passe change, révoque toutes les sessions (refresh tokens) et jetons de réinitialisation, dans la même transaction. */
  async update(
    id: string,
    data: {
      email?: string;
      displayname?: string;
      role?: Role;
      passwordHash?: string;
    },
  ): Promise<AdminUserView> {
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: adminSelectWithBan(),
      });
      if (data.passwordHash) {
        await tx.refreshToken.deleteMany({ where: { userId: id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      }
      return updated;
    });
    return this.toView(user);
  }

  /** [Major · Permissions avancées] Convertit une ligne Prisma en vue d'administration (sans hash). */
  private toView(user: AdminUserRow): AdminUserView {
    const { passwordHash, role, status, banReceived, ...rest } = user;
    return {
      ...rest,
      ban: banReceived[0] ?? null,
      role: role as Role,
      status: status as Status,
      hasPassword: passwordHash !== null,
    };
  }
}
