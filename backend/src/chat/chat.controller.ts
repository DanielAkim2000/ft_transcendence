import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/user.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { SendMessageDto } from './dtos/send-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @UseGuards(AccessTokenGuard)
  async createConversation(
    @Req() req: Request & { user: UserEntity },
    @Body() createConversationDto: CreateConversationDto,
  ) {
    const currentUserId = req.user.id;
    const { otherUserId } = createConversationDto;
    const conversation = await this.chatService.findOrCreateConversation(
      currentUserId,
      otherUserId,
    );
    return conversation;
  }

  @Get('conversations')
  @UseGuards(AccessTokenGuard)
  listConversations(@Req() req: Request & { user: UserEntity }) {
    return this.chatService.listConversations(req.user.id);
  }

  @Get('blocks')
  @UseGuards(AccessTokenGuard)
  listBlocked(@Req() req: Request & { user: UserEntity }) {
    return this.chatService.listBlockedUsers(req.user.id);
  }

  @Post('blocks/:userId')
  @UseGuards(AccessTokenGuard)
  async blockUser(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.chatService.blockUser(req.user.id, userId);
    return { ok: true };
  }

  @Delete('blocks/:userId')
  @UseGuards(AccessTokenGuard)
  async unblockUser(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.chatService.unblockUser(req.user.id, userId);
    return { ok: true };
  }

  @Get('conversations/:conversationId/messages')
  @UseGuards(AccessTokenGuard)
  getMessages(
    @Req() req: Request & { user: UserEntity },
    @Param('conversationId') conversationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.chatService.getMessages(
      req.user.id,
      conversationId,
      pagination,
    );
  }

  @Post('conversations/:conversationId/messages')
  @UseGuards(AccessTokenGuard)
  sendMessage(
    @Req() req: Request & { user: UserEntity },
    @Param('conversationId') conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      req.user.id,
      conversationId,
      sendMessageDto.content,
    );
  }
}
