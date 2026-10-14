import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Santé de l'application : endpoint public /health (API, base de données, sauvegardes). */
/** [Minor · Health check et sauvegardes] Module NestJS du health check : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
