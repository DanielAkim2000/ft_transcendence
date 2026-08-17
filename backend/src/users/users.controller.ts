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
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { UsersService } from './services/users.services';
import { UserEntity } from './entities/users.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';

const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers(
    @Req() req: Request & { user: UserEntity },
    @Query('q') query?: string,
  ): Promise<UserEntity[]> {
    return this.usersService.searchUsers(req.user.id, query);
  }

  @Get('me/friends')
  listFriends(
    @Req() req: Request & { user: UserEntity },
  ): Promise<UserEntity[]> {
    return this.usersService.listFriends(req.user.id);
  }

  @Get('me/friends/pending')
  listPending(
    @Req() req: Request & { user: UserEntity },
  ): Promise<UserEntity[]> {
    return this.usersService.listPendingRequests(req.user.id);
  }

  @Post('me/friends/:userId')
  sendFriendRequest(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<UserEntity> {
    return this.usersService.sendFriendRequest(req.user, userId);
  }

  @Patch('me/friends/:userId/accept')
  acceptFriendRequest(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<UserEntity> {
    return this.usersService.acceptFriendRequest(req.user, userId);
  }

  @Delete('me/friends/:userId')
  async removeFriend(
    @Req() req: Request & { user: UserEntity },
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.usersService.removeFriendship(req.user, userId);
    return { ok: true };
  }

  @Patch('me')
  updateMe(
    @Req() req: Request & { user: UserEntity },
    @Body() dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    return this.usersService.updateProfile(req.user, dto);
  }

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
          cb(new BadRequestException('Invalid image type'), false);
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
      throw new BadRequestException('Avatar file is required');
    }
    return this.usersService.updateAvatar(req.user, file.filename);
  }

  @Get(':id')
  async getById(
    @Req() req: Request & { user: UserEntity },
    @Param('id') id: string,
  ): Promise<{
    user: UserEntity;
    friendshipStatus: 'none' | 'pending_out' | 'pending_in' | 'friends' | 'self';
  }> {
    const user = await this.usersService.getProfile(id);
    const friendshipStatus = await this.usersService.getFriendshipStatus(
      req.user.id,
      id,
    );
    return { user, friendshipStatus };
  }
}
