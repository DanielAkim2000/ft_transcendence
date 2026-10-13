import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { MailService } from '../mail/mail.service';
import { UserEntity } from '../users/entities/users.entity';
import { GdprRepository } from './gdpr.repository';
import { gdprMails, type MailLanguage } from './gdpr.messages';
import { toCsv } from './gdpr.csv';
import type { ExportFormat } from './dtos/export-query.dto';

const DELETION_TOKEN_TTL_MINUTES = 60;
const DELETION_REQUEST_COOLDOWN_MS = 60_000;
const DELETION_PURPOSE = 'account-deletion';
const AVATAR_PREFIX = '/uploads/avatars/';

/** [Minor · RGPD] Service métier RGPD (export des données et suppression du compte). */
@Injectable()
export class GdprService {
  private readonly lastRequestAt = new Map<string, number>();

  /** [Minor · RGPD] Injecte les dépendances : GdprRepository, MailService, JwtService. */
  constructor(
    private readonly gdprRepository: GdprRepository,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  /** [Minor · RGPD] Clé de signature dédiée aux jetons de suppression : dérivée du secret de refresh, jamais acceptée comme access token. */
  private deletionSecret(): string {
    return `${process.env.JWT_REFRESH_TOKEN_SECRET}:gdpr-deletion`;
  }

  /** [Minor · RGPD] Langue des emails de l'utilisateur, avec repli sur l'anglais. */
  private mailLanguage(user: UserEntity): MailLanguage {
    return user.language === 'fr' || user.language === 'es'
      ? user.language
      : 'en';
  }

  /** [Minor · RGPD] Droit d'accès / portabilité : toutes les données de l'utilisateur, en JSON (indenté) ou en CSV, plus un email d'information. */
  async exportData(
    user: UserEntity,
    format: ExportFormat = 'json',
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const data = await this.gdprRepository.collectUserData(user.id);
    const exportedAt = new Date().toISOString();
    const mail = gdprMails.exported(this.mailLanguage(user), user.displayname);
    await this.mailService.sendQuietly(user.email, mail.subject, mail.text);
    const filename = `ft_transcendence_data_${exportedAt.slice(0, 10)}.${format}`;
    return format === 'csv'
      ? {
          filename,
          contentType: 'text/csv; charset=utf-8',
          body: toCsv(data, user.id, exportedAt),
        }
      : {
          filename,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ exportedAt, ...data }, null, 2),
        };
  }

  /** [Minor · RGPD] Lève une 409 si un tournoi ouvert (créé ou rejoint) ou une partie en cours empêche de supprimer le compte. */
  private async assertDeletable(userId: string): Promise<void> {
    const blockers = await this.gdprRepository.findDeletionBlockers(userId);
    if (blockers.openTournamentsCreated > 0) {
      throw new ConflictException({
        message:
          'You have a tournament in progress or in preparation: finish or cancel it before deleting your account',
        code: 'DELETION_BLOCKED_TOURNAMENT_CREATED',
      });
    }
    if (blockers.openTournamentsJoined > 0) {
      throw new ConflictException({
        message:
          'You are in a tournament that is not finished: wait for it to end',
        code: 'DELETION_BLOCKED_TOURNAMENT_JOINED',
      });
    }
    if (blockers.onTable > 0) {
      throw new ConflictException({
        message: 'You are playing on a table: finish your game first',
        code: 'DELETION_BLOCKED_ON_TABLE',
      });
    }
  }

  /** [Minor · RGPD] Étape 1 de la suppression : refuse si quelque chose bloque, puis envoie un lien de confirmation valable une heure. */
  async requestDeletion(user: UserEntity): Promise<void> {
    await this.assertDeletable(user.id);
    const last = this.lastRequestAt.get(user.id) ?? 0;
    if (Date.now() - last < DELETION_REQUEST_COOLDOWN_MS) {
      throw new ConflictException({
        message: 'A confirmation email was just sent, check your inbox',
        code: 'CONFIRMATION_EMAIL_RECENTLY_SENT',
      });
    }
    const token = await this.jwtService.signAsync(
      { sub: user.id, purpose: DELETION_PURPOSE },
      {
        secret: this.deletionSecret(),
        expiresIn: `${DELETION_TOKEN_TTL_MINUTES}m`,
      },
    );
    const link = `${process.env.FRONTEND_URL}/confirm-deletion?token=${token}`;
    const mail = gdprMails.confirmDeletion(
      this.mailLanguage(user),
      user.displayname,
      link,
      DELETION_TOKEN_TTL_MINUTES,
    );
    await this.mailService.send(user.email, mail.subject, mail.text);
    this.lastRequestAt.set(user.id, Date.now());
  }

  /** [Minor · RGPD] Étape 2 : vérifie le jeton reçu par email, anonymise le compte et efface ses données personnelles (avatar compris) et envoie l'email de confirmation. */
  async confirmDeletion(token: string): Promise<void> {
    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        purpose: string;
      }>(token, { secret: this.deletionSecret() });
      if (payload.purpose !== DELETION_PURPOSE) throw new Error('purpose');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid or expired confirmation link',
        code: 'CONFIRMATION_LINK_INVALID',
      });
    }
    await this.eraseAccount(userId);
  }

  /** [Minor · RGPD] Supprime définitivement un compte : refuse si un tournoi ou une partie l'en empêche, anonymise le compte, efface son avatar et envoie l'email de confirmation. Utilisé par la confirmation par email et par les administrateurs. */
  async eraseAccount(userId: string): Promise<void> {
    const data = await this.gdprRepository.collectUserData(userId);
    const profile = data.profile;
    if (!profile) {
      throw new NotFoundException({
        message: 'Account already deleted',
        code: 'ACCOUNT_ALREADY_DELETED',
      });
    }
    await this.assertDeletable(userId);
    await this.gdprRepository.anonymizeUser(userId);
    if (profile.avatarUrl?.startsWith(AVATAR_PREFIX)) {
      const file = join(
        process.cwd(),
        'uploads',
        'avatars',
        profile.avatarUrl.slice(AVATAR_PREFIX.length),
      );
      await unlink(file).catch(() => undefined);
    }
    const lang =
      profile.language === 'fr' || profile.language === 'es'
        ? profile.language
        : 'en';
    const mail = gdprMails.deleted(lang, profile.displayname);
    await this.mailService.sendQuietly(profile.email, mail.subject, mail.text);
  }
}
