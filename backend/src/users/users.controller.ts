import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UsersService } from './services/users.services';
import { UserEntity } from './entities/users.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateSettingsDto } from './dtos/update-settings.dto';
import { SearchUsersQueryDto } from './dtos/search-users-query.dto';
import { RankingQueryDto } from './dtos/ranking-query.dto';
import { ListFriendsQueryDto } from './dtos/list-friends-query.dto';
import { PageQueryDto } from '../common/pagination/page-query.dto';

const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** [Major · Gestion des utilisateurs] Contrôleur HTTP des utilisateurs (profil, amis, classement) : routes REST protégées par les guards d'authentification. */
@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  /** Injecte les dépendances : UsersService. */
  constructor(private readonly usersService: UsersService) {}

  /** [Minor · Recherche avancée] GET /users?q=&page=&limit= : recherche paginée d'utilisateurs (nom ou email) hors utilisateur connecté, avec leur relation d'amitié ; la présence n'est visible que pour les amis. */
  @Get()
  listUsers(
    @Req() req: Request & { user: UserEntity },
    @Query() query: SearchUsersQueryDto,
  ) {
    return this.usersService.searchUsers(req.user.id, query.q, query);
  }

  /** [Minor · Recherche avancée] GET /users/ranking?page=&limit=&q=&scope=&minMatches=&sort= : page du classement par note Elo, avec recherche, filtres et tri. */
  @Get('ranking')
  getRanking(
    @Req() req: Request & { user: UserEntity },
    @Query() query: RankingQueryDto,
  ) {
    return this.usersService.getRanking(req.user.id, query);
  }

  /** [Major · Interaction entre utilisateurs] GET /users/me/friends?page=&limit=&q=&online= : page des amis de l'utilisateur connecté, en ligne d'abord. */
  @Get('me/friends')
  listFriends(
    @Req() req: Request & { user: UserEntity },
    @Query() query: ListFriendsQueryDto,
  ) {
    return this.usersService.listFriends(req.user.id, query, {
      query: query.q,
      onlineOnly: query.online,
    });
  }

  /** [Major · Interaction entre utilisateurs] GET /users/me/friends/pending?page=&limit= : page des demandes d'ami reçues, en attente de réponse. */
  @Get('me/friends/pending')
  listPending(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.usersService.listPendingRequests(req.user.id, query);
  }

  /** [Major · Interaction entre utilisateurs] GET /users/me/friends/outgoing?page=&limit= : page des demandes d'ami envoyées, en attente de réponse. */
  @Get('me/friends/outgoing')
  listOutgoing(
    @Req() req: Request & { user: UserEntity },
    @Query() query: PageQueryDto,
  ) {
    return this.usersService.listOutgoingRequests(req.user.id, query);
  }

  /** [Major · Interaction entre utilisateurs] POST /users/me/friends/:userId : envoie une demande d'ami (ou accepte si l'autre en avait déjà envoyé une). */
  @Post('me/friends/:userId')
  sendFriendRequest(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<UserEntity> {
    return this.usersService.sendFriendRequest(req.user, userId);
  }

  /** [Major · Interaction entre utilisateurs] PATCH /users/me/friends/:userId/accept : accepte la demande d'ami reçue de cet utilisateur. */
  @Patch('me/friends/:userId/accept')
  acceptFriendRequest(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<UserEntity> {
    return this.usersService.acceptFriendRequest(req.user, userId);
  }

  /** [Major · Interaction entre utilisateurs] DELETE /users/me/friends/:userId : supprime l'amitié ou annule/refuse la demande. */
  @Delete('me/friends/:userId')
  async removeFriend(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.usersService.removeFriendship(req.user, userId);
    return { ok: true };
  }

  /** [Major · Gestion des utilisateurs] PATCH /users/me : met à jour le profil (nom d'affichage) de l'utilisateur connecté. */
  @Patch('me')
  updateMe(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    return this.usersService.updateProfile(req.user, dto);
  }

  /** [Major · Gestion des utilisateurs] PATCH /users/me/settings : met à jour les préférences (thème, langue). */
  @Patch('me/settings')
  updateSettings(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserEntity> {
    return this.usersService.updateSettings(req.user, dto);
  }

  /** [Major · Gestion des utilisateurs] POST /users/me/avatar : envoie l'avatar (JPEG/PNG/WebP, 2 Mo max), le stocke sur disque et met à jour le profil. */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(AVATAR_DIR, { recursive: true });
          cb(null, AVATAR_DIR);
        },
        filename: (req: Request & { user?: UserEntity }, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.png';
          cb(null, `${req.user?.id ?? 'user'}-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
          cb(
            new BadRequestException({
              message: 'Invalid image type',
              code: 'INVALID_IMAGE_TYPE',
            }),
            false,
          );
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @Req() req: Request & { user: UserEntity },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserEntity> {
    if (!file) {
      throw new BadRequestException({
        message: 'Avatar file is required',
        code: 'AVATAR_REQUIRED',
      });
    }
    return this.usersService.updateAvatar(req.user, file.filename);
  }

  /** [Major · Interaction entre utilisateurs] GET /users/:id : profil public d'un utilisateur avec le statut d'amitié vis-à-vis de l'utilisateur connecté. */
  @Get(':id')
  async getById(
    @Req() req: Request & { user: UserEntity },
    @Param('id') id: string,
  ): Promise<{
    user: UserEntity;
    friendshipStatus:
      'none' | 'pending_out' | 'pending_in' | 'friends' | 'self';
  }> {
    return this.usersService.getProfileForViewer(req.user.id, id);
  }
}
