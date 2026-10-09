import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ChatService } from './services/chat.service';
import { BlockRepository } from './repositories/block.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';

/** Messagerie privée entre amis : conversations, messages, blocage et événements temps réel. Exporte ChatService. */
@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    BlockRepository,
    ConversationRepository,
    MessageRepository,
  ],
  exports: [ChatService],
})
export class ChatModule {}
