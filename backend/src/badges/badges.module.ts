import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { BadgesController } from './badges.controller';
import { BadgesGateway } from './badges.gateway';
import { BadgesRepository } from './repositories/badges.repository';
import { BadgesService } from './services/badges.service';

@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [BadgesController],
  providers: [BadgesService, BadgesRepository, BadgesGateway],
  exports: [BadgesService],
})
export class BadgesModule {}
