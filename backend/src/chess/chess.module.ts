import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ChessController } from './chess.controller';
import { ChessGateway } from './chess.gateway';
import { ChessService } from './services/chess.service';

@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [ChessController],
  providers: [ChessService, ChessGateway]
})
export class ChessModule { }
