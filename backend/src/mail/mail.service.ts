import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

const DEFAULT_SMTP_PORT = 1025;
const DEFAULT_FROM = '42 Baby <no-reply@ft.local>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  /** Crée le transport SMTP si SMTP_HOST est défini ; sinon les emails sont simplement écrits dans les logs (dev sans serveur mail). */
  constructor() {
    const host = process.env.SMTP_HOST;
    this.transporter = host
      ? createTransport({
          host,
          port: Number(process.env.SMTP_PORT ?? DEFAULT_SMTP_PORT),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        })
      : null;
  }

  /** Envoie un email texte ; lève une ServiceUnavailableException si l'envoi échoue. */
  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP_HOST non défini, email non envoyé.\nTo: ${to}\nSubject: ${subject}\n${text}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? DEFAULT_FROM,
        to,
        subject,
        text,
      });
    } catch (error) {
      this.logger.error(`Envoi de l'email à ${to} échoué`, error as Error);
      throw new ServiceUnavailableException('Unable to send the email');
    }
  }

  /** Comme send, mais n'échoue jamais : pour les emails de simple information (l'opération a déjà eu lieu). */
  async sendQuietly(to: string, subject: string, text: string): Promise<void> {
    try {
      await this.send(to, subject, text);
    } catch {
      // déjà loggé par send()
    }
  }
}
