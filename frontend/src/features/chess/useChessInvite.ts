import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/toast";
import { useCreateChessGameMutation } from "@/features/chess/chessApi";
import { getErrorMessage } from "@/lib/get-error-message";

/** [Minor · Chat avancé] Invitation à une partie d'échecs depuis le chat ou un profil : crée le défi ; l'adversaire le reçoit dans le chat (entre amis) et dans ses notifications. */
export function useChessInvite() {
  const { t } = useTranslation();
  const [createGame, { isLoading: inviting }] = useCreateChessGameMutation();

  /** [Minor · Chat avancé] Invite le joueur `peerId` ; affiche un toast de confirmation ou l'erreur (ex. une partie existe déjà avec lui). */
  const inviteToChess = async (peerId: string) => {
    try {
      await createGame({ opponentId: peerId, color: "RANDOM" }).unwrap();
      toast.add({ title: t("chess.invite.sentToast"), type: "success" });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("chess.invite.failed")),
        type: "error",
      });
    }
  };

  return { inviteToChess, inviting };
}
