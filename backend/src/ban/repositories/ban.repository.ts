import { PrismaService } from "../../prisma/prisma.service";


export class BanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBanStatus(userId: string) : Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      orderBy: { createdAt: 'desc' },
    });
    if (user === null) {
      return false;
    }
    const banStatus = await user.banReceived.findUnique({
      where: { OR: [{ endTime: null }, { endTime: { gt: new Date() } }]},
      orderBy: { createdAt: 'desc' },
    });
    return banStatus === null ? true : false;
  }
};
