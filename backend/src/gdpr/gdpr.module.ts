import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GdprController } from './gdpr.controller';
import { GdprRepository } from './gdpr.repository';
import { GdprService } from './gdpr.service';

/** Conformité RGPD : export des données personnelles et suppression du compte avec confirmation par email. */
/** [Minor · RGPD] Module NestJS RGPD (export des données et suppression du compte) : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [PrismaModule],
  controllers: [GdprController],
  providers: [GdprService, GdprRepository],
  exports: [GdprService],
})
export class GdprModule {}
