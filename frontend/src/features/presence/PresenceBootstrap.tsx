import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useEffect } from "react";
import { connect, disconnect } from "./presenceSocket";
import { clearCredentials, selectAccessToken } from "../auth/authSlice";
import applyPresenceToCache from "./applyPresenceToCache";
import { usersApi } from "../users/usersApi";
import { TAG_TYPES } from "@/constants/tagTypes";
import { ROUTES } from "@/constants/routes";
import { navigate } from "@/lib/navigation";
import { banLoginPath } from "../ban/banHelpers";
import { toast } from "@/components/ui/toast";
import i18n from "@/i18n";
import type { Status } from "../auth/authApi";

interface PresenceBootstrapProps {
  children: React.ReactNode;
}

/** [Major · Temps réel WebSockets] Connecte le socket de présence (statut en ligne des amis, demandes d'ami en direct, ban en direct) et le déconnecte à la déconnexion. */
const PresenceBootstrap: React.FC<PresenceBootstrapProps> = ({ children }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }

    const socket = connect(accessToken);

    /** [Major · Temps réel WebSockets] Changement de statut d'un ami : met à jour les caches de listes. */
    const onUpdate = (_payload: { userId: string; status: Status }) => {
      applyPresenceToCache(dispatch, _payload.userId, _payload.status);
    };

    const onSync = (_payload: {
      onlineFriends: { userId: string; status: Status }[];
    }) => {
      _payload.onlineFriends.forEach((friend) => {
        applyPresenceToCache(dispatch, friend.userId, friend.status);
      });
    };

    /** [Major · Temps réel WebSockets] Invalide les caches des amis et utilisateurs pour les recharger. */
    const invalidateFriends = () => {
      dispatch(
        usersApi.util.invalidateTags([TAG_TYPES.FRIENDS, TAG_TYPES.USERS]),
      );
    };

    /** [Minor · Notifications] Demande d'ami reçue en direct : rafraîchit les listes et affiche un toast avec le nom de l'expéditeur. */
    const onFriendRequest = async (payload: { userId: string }) => {
      invalidateFriends();
      const result = await dispatch(
        usersApi.endpoints.getUser.initiate(payload.userId),
      );
      const name = result.data?.user.displayname ?? "?";
      toast.add({
        title: i18n.t("friends.requestReceivedToast", { name }),
        type: "info",
        actionProps: {
          children: i18n.t("home.review"),
          onClick: () => navigate(ROUTES.FRIENDS),
        },
      });
    };

    /** [Major · Permissions avancées] L'utilisateur vient d'être banni : vide la session, prévient et redirige vers la page de connexion expliquant le ban. */
    const onBanned = (payload: { reason: string; endTime: string | null }) => {
      dispatch(clearCredentials());
      toast.add({ title: i18n.t("ban.notice.title"), type: "error" });
      navigate(banLoginPath(payload.reason, payload.endTime));
    };

    socket?.on("presence:update", onUpdate);
    socket?.on("presence:sync", onSync);
    socket?.on("friend:request", onFriendRequest);
    socket?.on("friend:update", invalidateFriends);
    socket?.on("auth:banned", onBanned);

    return () => {
      socket?.off("presence:update", onUpdate);
      socket?.off("presence:sync", onSync);
      socket?.off("friend:request", onFriendRequest);
      socket?.off("friend:update", invalidateFriends);
      socket?.off("auth:banned", onBanned);
      disconnect();
    };
  }, [accessToken, dispatch]);
  return <>{children}</>;
};

export default PresenceBootstrap;
