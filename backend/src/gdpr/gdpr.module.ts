import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GdprController } from './gdpr.controller';
import { GdprRepository } from './gdpr.repository';
import { GdprService } from './gdpr.service';

/** Conformité RGPD : export des données personnelles et suppression du compte avec confirmation par email. */
@Module({
  imports: [PrismaModule],
  controllers: [GdprController],
  providers: [GdprService, GdprRepository],
})
export class GdprModule {}
