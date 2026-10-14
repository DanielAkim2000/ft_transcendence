import type { MailLanguage } from '../gdprs/gdpr.messages';

/** [Major · Permissions avancées] Contenu d'un email (sujet, texte) dans une langue. */
interface Mail {
  subject: string;
  text: string;
}

/** [Major · Permissions avancées] Date de fin de ban lisible, en UTC (null = ban permanent). */
function untilLabel(lang: MailLanguage, until: Date | null): string {
  if (!until) {
    return { en: 'permanent', fr: 'définitif', es: 'permanente' }[lang];
  }
  return `${until.toLocaleString(lang, { timeZone: 'UTC' })} UTC`;
}

/** Emails de modération, dans la langue de l'utilisateur (repli sur l'anglais). */
export const banMails = {
  banned: (
    lang: MailLanguage,
    name: string,
    reason: string,
    until: Date | null,
  ): Mail =>
    ({
      en: {
        subject: 'Your account has been banned',
        text: `Hi ${name},\n\nYour account has been banned.\nReason: ${reason}\nDuration: ${untilLabel(lang, until)}\n\nYou are signed out and cannot sign in until the ban ends.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Ton compte a été banni',
        text: `Salut ${name},\n\nTon compte a été banni.\nMotif : ${reason}\nDurée : ${untilLabel(lang, until)}\n\nTu as été déconnecté et tu ne pourras pas te reconnecter avant la fin du bannissement.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Tu cuenta ha sido suspendida',
        text: `Hola ${name},\n\nTu cuenta ha sido suspendida.\nMotivo: ${reason}\nDuración: ${untilLabel(lang, until)}\n\nSe ha cerrado tu sesión y no podrás iniciar sesión hasta que termine la suspensión.\n\n— 42 Baby`,
      },
    })[lang],

  unbanned: (lang: MailLanguage, name: string): Mail =>
    ({
      en: {
        subject: 'Your ban has been lifted',
        text: `Hi ${name},\n\nYour ban has been lifted: you can sign in again.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Ton bannissement a été levé',
        text: `Salut ${name},\n\nTon bannissement a été levé : tu peux te reconnecter.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Tu suspensión ha sido levantada',
        text: `Hola ${name},\n\nTu suspensión ha sido levantada: ya puedes iniciar sesión de nuevo.\n\n— 42 Baby`,
      },
    })[lang],
};
