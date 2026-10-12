import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PRISMA_ADAPTER } from './constants/injection-tokens';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** Injecte les dépendances : PrismaPg. */
  constructor(@Inject(PRISMA_ADAPTER) adapter: PrismaPg) {
    super({
      adapter: adapter,
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  /** Ouvre la connexion à la base au démarrage du module. */
  async onModuleInit() {
    await this.$connect();
  }

  /** Ferme la connexion à la base à l'arrêt du module. */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
