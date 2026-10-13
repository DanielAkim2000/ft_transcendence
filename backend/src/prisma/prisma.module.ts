import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PRISMA_ADAPTER } from './constants/injection-tokens';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

/** Accès à la base de données : fournit l'adaptateur PostgreSQL (DATABASE_URL) et exporte PrismaService. */
/** [Minor · ORM Prisma] Module NestJS de l'accès à la base : regroupe contrôleur, services et dépendances. */
@Module({
  providers: [
    {
      provide: PRISMA_ADAPTER,
      /** Crée l'adaptateur PostgreSQL à partir de DATABASE_URL ; échoue au démarrage si la variable est absente. */
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not set');
        }
        return new PrismaPg({
          connectionString: databaseUrl,
        });
      },
      inject: [ConfigService],
    },
    PrismaService,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
