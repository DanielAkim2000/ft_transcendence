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
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { GdprModule } from './gdpr/gdpr.module';
import { ChessModule } from './chess/chess.module';
import { BanModule } from './ban/ban.module';
import { AdminModule } from './admin/admin.module';

/** Module racine : charge la config (.env), le JWT global (access token, 1 h) et tous les modules fonctionnels de l'application. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync({
      global: true,
      /** Configure le JWT global : secret de l'access token et expiration par défaut d'1 h. */
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
    NotificationsModule,
    ChessModule,
    HealthModule,
    MailModule,
    GdprModule,
    BanModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
