import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChessController } from './chess.controller';
import { ChessGateway } from './chess.gateway';
import { ChessService } from './services/chess.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UsersModule),
    ChatModule,
    NotificationsModule,
  ],
  controllers: [ChessController],
  providers: [ChessService, ChessGateway],
})
export class ChessModule {}
