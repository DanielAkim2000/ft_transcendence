import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Envoi d'emails (SMTP). Global : utilisable par n'importe quel module. */
@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
