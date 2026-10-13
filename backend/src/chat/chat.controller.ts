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
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { SendMessageDto } from './dtos/send-message.dto';

/** [Major · Interaction entre utilisateurs] Contrôleur HTTP du chat (conversations, messages, blocages) : routes REST protégées par les guards d'authentification. */
@Controller('chat')
export class ChatController {
  /** Injecte les dépendances : ChatService. */
  constructor(private readonly chatService: ChatService) {}

  /** [Major · Interaction entre utilisateurs] POST /chat/conversations : retrouve ou crée la conversation entre l'utilisateur connecté et un autre utilisateur (amis uniquement). */
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

  /** [Major · Interaction entre utilisateurs] GET /chat/conversations : liste les conversations de l'utilisateur avec dernier message et compteur de non-lus. */
  @Get('conversations')
  @UseGuards(AccessTokenGuard)
  listConversations(@Req() req: Request & { user: UserEntity }) {
    return this.chatService.listConversations(req.user.id);
  }

  /** [Minor · Chat avancé] POST /chat/conversations/:conversationId/read : marque la conversation comme lue par l'utilisateur connecté. */
  @Post('conversations/:conversationId/read')
  @UseGuards(AccessTokenGuard)
  async markRead(
    @Req() req: Request & { user: UserEntity },
    @Param('conversationId') conversationId: string,
  ): Promise<{ ok: true }> {
    await this.chatService.markConversationRead(req.user.id, conversationId);
    return { ok: true };
  }

  /** [Minor · Chat avancé] GET /chat/blocks?page=&limit= : page des utilisateurs bloqués par l'utilisateur connecté. */
  @Get('blocks')
  @UseGuards(AccessTokenGuard)
  listBlocked(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.chatService.listBlockedUsers(req.user.id, query);
  }

  /** [Minor · Chat avancé] GET /chat/blocks/:userId : indique si l'utilisateur connecté a bloqué cet utilisateur. */
  @Get('blocks/:userId')
  @UseGuards(AccessTokenGuard)
  isBlocked(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ) {
    return this.chatService.isBlockedByMe(req.user.id, userId);
  }

  /** [Minor · Chat avancé] POST /chat/blocks/:userId : bloque un utilisateur. */
  @Post('blocks/:userId')
  @UseGuards(AccessTokenGuard)
  async blockUser(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.chatService.blockUser(req.user.id, userId);
    return { ok: true };
  }

  /** [Minor · Chat avancé] DELETE /chat/blocks/:userId : débloque un utilisateur. */
  @Delete('blocks/:userId')
  @UseGuards(AccessTokenGuard)
  async unblockUser(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.chatService.unblockUser(req.user.id, userId);
    return { ok: true };
  }

  /** [Major · Interaction entre utilisateurs] GET /chat/conversations/:conversationId/messages : messages d'une conversation, paginés par curseur. */
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

  /** [Major · Interaction entre utilisateurs] POST /chat/conversations/:conversationId/messages : envoie un message dans la conversation. */
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
