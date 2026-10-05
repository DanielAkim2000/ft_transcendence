import type { MailLanguage } from '../gdpr/gdpr.messages';

interface Mail {
  subject: string;
  text: string;
}

/** Emails d'authentification, dans la langue de l'utilisateur (repli sur l'anglais). */
export const authMails = {
  resetPassword: (
    lang: MailLanguage,
    name: string,
    link: string,
    minutes: number,
  ): Mail =>
    ({
      en: {
        subject: 'Reset your password',
        text: `Hi ${name},\n\nYou asked to reset your password. To choose a new one, open this link (valid ${minutes} minutes, single use):\n${link}\n\nIf you did not ask for this, ignore this email: your password stays unchanged.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Réinitialise ton mot de passe',
        text: `Salut ${name},\n\nTu as demandé la réinitialisation de ton mot de passe. Pour en choisir un nouveau, ouvre ce lien (valable ${minutes} minutes, usage unique) :\n${link}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe reste inchangé.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Restablece tu contraseña',
        text: `Hola ${name},\n\nHas pedido restablecer tu contraseña. Para elegir una nueva, abre este enlace (válido ${minutes} minutos, de un solo uso):\n${link}\n\nSi no lo has pedido tú, ignora este correo: tu contraseña no cambiará.\n\n— 42 Baby`,
      },
    })[lang],

  passwordChanged: (lang: MailLanguage, name: string): Mail =>
    ({
      en: {
        subject: 'Your password has been changed',
        text: `Hi ${name},\n\nYour password was just changed and all your sessions were signed out. If this was not you, reset your password again right away.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Ton mot de passe a été modifié',
        text: `Salut ${name},\n\nTon mot de passe vient d'être modifié et toutes tes sessions ont été déconnectées. Si ce n'était pas toi, réinitialise-le immédiatement.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Tu contraseña ha sido cambiada',
        text: `Hola ${name},\n\nTu contraseña se acaba de cambiar y se han cerrado todas tus sesiones. Si no has sido tú, restablécela de inmediato.\n\n— 42 Baby`,
      },
    })[lang],
};
