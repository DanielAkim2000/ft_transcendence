import { PrismaService } from "../../prisma/prisma.service";


export class BanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBanStatus(userId: string) : Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const banStatus = await user.ban.findUnique({
      where: { OR: [{ endTime: null }, { endTime: { gt: new Date() } }]},
      orderBy: { createdAt: 'desc' },
    });
    return banStatus === null ? true : false;
  }
};
