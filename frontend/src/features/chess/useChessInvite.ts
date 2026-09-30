import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/toast";

/**
 * Invitation à une partie d'échecs depuis le chat.
 *
 * Point de branchement : le jeu d'échecs n'est pas encore intégré. Quand il le
 * sera, remplacer le corps de `inviteToChess` par l'appel réel (création de la
 * partie / invitation via l'API ou le socket du jeu) ; le bouton du chat
 * (`Chat.tsx`) n'a rien d'autre à changer.
 */
export function useChessInvite() {
  const { t } = useTranslation();

  /** Invite le joueur `peerId` à une partie d'échecs (pour l'instant : simple message « bientôt disponible »). */
  const inviteToChess = (peerId: string) => {
    void peerId; // sera utilisé par l'appel réel
    toast.add({ title: t("chat.chessSoon"), type: "info" });
  };

  return { inviteToChess };
}
