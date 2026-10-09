import type { Message } from "./chatApi";

type Translate = (key: string) => string;

/** Texte court d'un message pour les aperçus (liste des conversations, accueil) : une invitation aux échecs est traduite au lieu d'afficher son texte technique. */
export function messagePreview(message: Message, t: Translate): string {
  return message.chessGameId ? t("chess.invite.preview") : message.content;
}
