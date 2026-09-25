import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { BadgesModule } from '../badges/badges.module';
import { MatchesController } from './matches.controller';
import { MatchesGateway } from './matches.gateway';
import { MatchesRepository } from './repositories/matches.repository';
import { MatchesService } from './services/matches.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule),
    TournamentsModule,
    BadgesModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesRepository, MatchesGateway],
})
export class MatchesModule {}
