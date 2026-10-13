import { CrownIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  useAcceptChessGameMutation,
  useDeclineChessGameMutation,
  useGetChessGameQuery,
} from "@/features/chess/chessApi";
import { ROUTES } from "@/constants/routes";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

type Props = {
  gameId: string;
  meId?: string;
  /** Nom de l'autre joueur, pour les libellés. */
  peerName: string;
};

/** Carte affichée dans le chat à la place d'un message texte : invitation à une partie d'échecs, toujours à jour (en attente, acceptée, refusée, terminée) avec les actions utiles. */
export function ChessInviteCard({ gameId, meId, peerName }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: game, isError } = useGetChessGameQuery(gameId);
  const [acceptGame, { isLoading: accepting }] = useAcceptChessGameMutation();
  const [declineGame, { isLoading: declining }] = useDeclineChessGameMutation();

  const openGame = () => navigate(`${ROUTES.CHESS}?gameId=${gameId}`);
  const isChallenger = game?.challengerId === meId;
  const busy = accepting || declining;

  const handleAccept = async () => {
    try {
      await acceptGame(gameId).unwrap();
      openGame();
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("chess.invite.failed")),
        type: "error",
      });
    }
  };

  const handleDecline = async () => {
    try {
      await declineGame(gameId).unwrap();
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("chess.invite.failed")),
        type: "error",
      });
    }
  };

  const status = game?.status;
  const title =
    status === "PENDING"
      ? isChallenger
        ? t("chess.invite.sentTitle", { name: peerName })
        : t("chess.invite.receivedTitle", { name: peerName })
      : status === "ACTIVE"
        ? t("chess.invite.activeTitle")
        : status === "DECLINED"
          ? t("chess.invite.declinedTitle")
          : status === "FINISHED"
            ? t("chess.invite.finishedTitle")
            : t("chess.invite.preview");

  return (
    <div
      className={cn(
        "flex w-64 flex-col gap-3 border p-3 sm:w-72",
        status === "PENDING" && !isChallenger
          ? "border-primary/60 bg-primary/10"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center border border-primary/40 bg-primary/10 text-primary"
        >
          <CrownIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
            {t("chess.invite.label")}
          </p>
          <p className="font-sans text-sm leading-snug font-medium">{title}</p>
        </div>
      </div>

      {isError ? (
        <p className="font-sans text-xs text-muted-foreground">
          {t("chess.invite.unavailable")}
        </p>
      ) : null}

      {status === "PENDING" && !isChallenger ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" loading={busy} onClick={() => void handleAccept()}>
            {t("chess.invite.accept")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void handleDecline()}
          >
            {t("chess.invite.decline")}
          </Button>
        </div>
      ) : null}

      {status === "ACTIVE" || status === "FINISHED" ? (
        <Button type="button" size="sm" variant="outline" onClick={openGame}>
          {status === "ACTIVE"
            ? t("chess.invite.openGame")
            : t("chess.invite.viewGame")}
        </Button>
      ) : null}
    </div>
  );
}
