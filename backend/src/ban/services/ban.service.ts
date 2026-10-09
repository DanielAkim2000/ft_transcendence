import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BanRepository } from '../repositories/ban.repository';
import { CreateBanDto } from '../dto/create-ban.dto';
import { Ban } from '../../generated/prisma/client';
import { UsersService } from '../../users/services/users.services';
import { Role, UserEntity } from '../../users/entities/users.entity';
import { MailService } from '../../mail/mail.service';
import { PresenceGateway } from '../../presence/presence.gateway';
import { banMails } from '../ban.messages';
import type { MailLanguage } from '../../gdpr/gdpr.messages';

@Injectable()
export class BanService {
  /** Injecte les dépendances : BanRepository, UsersService, MailService, PresenceGateway. */
  constructor(
    private readonly banRepository: BanRepository,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => PresenceGateway))
    private readonly presenceGateway: PresenceGateway,
  ) {}

  /** Langue des emails de l'utilisateur, avec repli sur l'anglais. */
  private mailLanguage(user: UserEntity): MailLanguage {
    return user.language === 'fr' || user.language === 'es'
      ? user.language
      : 'en';
  }

  /** Retourne le ban en cours de l'utilisateur, ou null. */
  findActiveBan(userId: string): Promise<Ban | null> {
    return this.banRepository.findActiveBan(userId);
  }

  /** Historique des bans de l'utilisateur, du plus récent au plus ancien. */
  findBans(userId: string): Promise<Ban[]> {
    return this.banRepository.findBans(userId);
  }

  /** Bannit un utilisateur : refuse un administrateur ou un utilisateur déjà banni, révoque ses sessions, le déconnecte en temps réel et l'informe par email. */
  async banUser(userId: string, dto: CreateBanDto): Promise<Ban> {
    const user = await this.usersService.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException({
        message: 'An administrator cannot be banned',
        code: 'ADMIN_CANNOT_BE_BANNED',
      });
    }
    if (await this.findActiveBan(userId)) {
      throw new ConflictException({
        message: 'This user is already banned',
        code: 'ALREADY_BANNED',
      });
    }
    const ban = await this.banRepository.create(userId, dto);
    this.presenceGateway.kickBannedUser(userId, {
      reason: ban.reason,
      endTime: ban.endTime,
    });
    const mail = banMails.banned(
      this.mailLanguage(user),
      user.displayname,
      ban.reason,
      ban.endTime,
    );
    await this.mailService.sendQuietly(user.email, mail.subject, mail.text);
    return ban;
  }

  /** Lève le ban en cours ; lève une NotFoundException si l'utilisateur n'est pas banni. L'utilisateur en est informé par email. */
  async unbanUser(userId: string): Promise<void> {
    if ((await this.banRepository.unbanUser(userId)) === 0) {
      throw new NotFoundException({
        message: 'This user is not banned',
        code: 'NOT_BANNED',
      });
    }
    const user = await this.usersService.findUserById(userId);
    if (user) {
      const mail = banMails.unbanned(this.mailLanguage(user), user.displayname);
      await this.mailService.sendQuietly(user.email, mail.subject, mail.text);
    }
  }
}
