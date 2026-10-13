import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { connect, disconnect } from "./notificationsSocket";
import { notificationsApi } from "./notificationsApi";
import { TAG_TYPES } from "@/constants/tagTypes";

/**
 * [Minor · Notifications]
 * Tient à jour le compteur de non-lus et la liste de l'historique.
 * Les toasts « en direct » restent affichés par les bootstraps de chaque
 * feature (chat excepté) ; ce bootstrap ne fait que synchroniser la pastille
 * et la page /notifications avec ce que le backend vient de persister.
 */
export const NotificationsBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    // Les invitations aux échecs (reçues, acceptées, refusées) passent par une notification : on en profite pour rafraîchir les parties (carte du chat, point du bouton flottant).
    /** [Minor · Notifications] À chaque notification poussée par le serveur : invalide le cache des notifications et des parties d'échecs pour rafraîchir la pastille et les listes. */
    const refresh = () =>
      dispatch(
        notificationsApi.util.invalidateTags([
          TAG_TYPES.NOTIFICATIONS,
          TAG_TYPES.CHESS,
        ]),
      );

    socket.on("notifications:new", refresh);
    socket.on("notifications:read", refresh);
    socket.io.on("reconnect", refresh);
    return () => {
      socket.off("notifications:new", refresh);
      socket.off("notifications:read", refresh);
      socket.io.off("reconnect", refresh);
      disconnect();
    };
  }, [accessToken, dispatch]);

  return <>{children}</>;
};
