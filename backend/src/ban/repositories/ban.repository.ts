import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Ban } from '../../generated/prisma/client';
import { CreateBanDto } from '../dto/create-ban.dto';

const HOUR_MS = 60 * 60 * 1000;

/** [Major · Permissions avancées] Dépôt de données des bannissements : requêtes Prisma et conversion en entités. */
@Injectable()
export class BanRepository {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Major · Permissions avancées] Retourne le ban en cours de l'utilisateur (permanent ou pas encore terminé), le plus récent d'abord, ou null. */
  findActiveBan(userId: string): Promise<Ban | null> {
    return this.prisma.ban.findFirst({
      where: {
        userId,
        OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
      },
      orderBy: { startTime: 'desc' },
    });
  }

  /** [Major · Permissions avancées] Historique complet des bans de l'utilisateur, du plus récent au plus ancien. */
  findBans(userId: string): Promise<Ban[]> {
    return this.prisma.ban.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
    });
  }

  /** [Major · Permissions avancées] Crée le ban (durée 0 = permanent) et révoque toutes les sessions de l'utilisateur (refresh tokens), dans la même transaction. */
  async create(userId: string, dto: CreateBanDto): Promise<Ban> {
    const [ban] = await this.prisma.$transaction([
      this.prisma.ban.create({
        data: {
          userId,
          endTime:
            dto.durationHours === 0
              ? null
              : new Date(Date.now() + dto.durationHours * HOUR_MS),
          reason: dto.reason,
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    return ban;
  }

  /** [Major · Permissions avancées] Termine immédiatement les bans en cours de l'utilisateur ; retourne le nombre de bans levés. */
  async unbanUser(userId: string): Promise<number> {
    const result = await this.prisma.ban.updateMany({
      where: {
        userId,
        OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
      },
      data: { endTime: new Date() },
    });
    return result.count;
  }
}
