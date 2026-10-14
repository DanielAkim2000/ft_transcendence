export type MailLanguage = 'en' | 'fr' | 'es';

/** [Minor · RGPD] Contenu d'un email (sujet, texte) dans une langue. */
interface Mail {
  subject: string;
  text: string;
}

/** Emails de conformité RGPD, dans la langue de l'utilisateur (repli sur l'anglais). */
export const gdprMails = {
  exported: (lang: MailLanguage, name: string): Mail =>
    ({
      en: {
        subject: 'Your data export',
        text: `Hi ${name},\n\nA copy of your personal data was just downloaded from your account. If this was not you, change your password now.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Export de tes données',
        text: `Salut ${name},\n\nUne copie de tes données personnelles vient d'être téléchargée depuis ton compte. Si ce n'était pas toi, change ton mot de passe maintenant.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Exportación de tus datos',
        text: `Hola ${name},\n\nSe acaba de descargar una copia de tus datos personales desde tu cuenta. Si no has sido tú, cambia tu contraseña ahora.\n\n— 42 Baby`,
      },
    })[lang],

  confirmDeletion: (
    lang: MailLanguage,
    name: string,
    link: string,
    minutes: number,
  ): Mail =>
    ({
      en: {
        subject: 'Confirm the deletion of your account',
        text: `Hi ${name},\n\nYou asked to delete your account. This permanently erases your personal data (profile, email, friends, messages, badges). Your past matches stay in your opponents' history under the name "Deleted user".\n\nTo confirm, open this link (valid ${minutes} minutes):\n${link}\n\nIf you did not ask for this, ignore this email: nothing will be deleted.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Confirme la suppression de ton compte',
        text: `Salut ${name},\n\nTu as demandé la suppression de ton compte. Cela efface définitivement tes données personnelles (profil, email, amis, messages, badges). Tes anciens matchs restent dans l'historique de tes adversaires sous le nom « Deleted user ».\n\nPour confirmer, ouvre ce lien (valable ${minutes} minutes) :\n${link}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email : rien ne sera supprimé.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Confirma la eliminación de tu cuenta',
        text: `Hola ${name},\n\nHas pedido eliminar tu cuenta. Esto borra de forma permanente tus datos personales (perfil, correo, amigos, mensajes, insignias). Tus partidos anteriores permanecen en el historial de tus rivales con el nombre «Deleted user».\n\nPara confirmar, abre este enlace (válido ${minutes} minutos):\n${link}\n\nSi no lo has pedido tú, ignora este correo: no se borrará nada.\n\n— 42 Baby`,
      },
    })[lang],

  deleted: (lang: MailLanguage, name: string): Mail =>
    ({
      en: {
        subject: 'Your account has been deleted',
        text: `Hi ${name},\n\nYour personal data has been permanently erased and your account anonymised. Thanks for playing.\n\n— 42 Baby`,
      },
      fr: {
        subject: 'Ton compte a été supprimé',
        text: `Salut ${name},\n\nTes données personnelles ont été définitivement effacées et ton compte est anonymisé. Merci d'avoir joué.\n\n— 42 Baby`,
      },
      es: {
        subject: 'Tu cuenta ha sido eliminada',
        text: `Hola ${name},\n\nTus datos personales se han borrado de forma permanente y tu cuenta ha sido anonimizada. Gracias por jugar.\n\n— 42 Baby`,
      },
    })[lang],
};
