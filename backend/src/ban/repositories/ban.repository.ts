import { PrismaService } from "../../prisma/prisma.service";
import { Injectable } from "@nestjs/common"
import { CreateBanDto } from "../dto/create-ban.dto";
import { Ban } from "../../generated/prisma/client";
import { NotFoundException } from "@nestjs/common"

@Injectable()
export class BanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBanStatus(userId: string) : Promise<boolean> {
    const banStatus = await this.prisma.ban.findFirst({
      where: { userId: userId, OR: [{ endTime: null }, { endTime: { gt: new Date() } }]},
      orderBy: { startTime: 'desc' },
    });
    return banStatus === null ? false : true;
  }

  async findBans(userId: string) : Promise<Ban[]> {
    const bans = await this.prisma.ban.findMany({
      where: {userId: userId},
      orderBy: { startTime: "desc" }
    });
    return bans;
  }

  async create(
    userId: string,
    dto: CreateBanDto,
  ) : Promise<void> {
    await this.prisma.ban.create({
      data: {
        userId,
        endTime: dto.durationHours == 0 ? null
          : new Date(Date.now().valueOf() + dto.durationHours * 3600000),
        reason: dto.reason,
      }
    });
  }

  async unbanUser(userId: string) : Promise<number> {
    const result = await this.prisma.ban.updateMany({
      where: {
        userId: userId,
        OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
      },
      data: { endTime: new Date()},
    });
    return result.count;
  }
};
