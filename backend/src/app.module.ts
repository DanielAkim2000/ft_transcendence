import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PresenceModule } from './presence/presence.module';
import { ChatModule } from './chat/chat.module';
import { TablesModule } from './tables/tables.module';
import { QueueModule } from './queue/queue.module';
import { MatchesModule } from './matches/matches.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { BadgesModule } from './badges/badges.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PrismaModule,
    PresenceModule,
    AuthModule,
    UsersModule,
    ChatModule,
    TablesModule,
    QueueModule,
    MatchesModule,
    TournamentsModule,
    BadgesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
