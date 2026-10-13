import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { connect, disconnect } from "./queueSocket";
import { applyQueueUpdateToCache, queueApi, type QueueGroup } from "./queueApi";
import { tablesApi } from "../tables/tablesApi";
import { matchesApi } from "../matches/matchesApi";
import { TAG_TYPES } from "@/constants/tagTypes";
import { ROUTES } from "@/constants/routes";
import { navigate } from "@/lib/navigation";
import { toast } from "@/components/ui/toast";
import i18n from "@/i18n";

/** [Socle produit babyfoot (hors module)] Retrouve le nom d'une table (cache ou requête) pour les toasts. */
async function tableName(
  dispatch: ReturnType<typeof useAppDispatch>,
  tableId: string,
): Promise<string> {
  const result = await dispatch(tablesApi.endpoints.listTables.initiate());
  return result.data?.find((table) => table.id === tableId)?.name ?? "?";
}

/** [Major · Temps réel WebSockets] Connecte le socket de la file d'attente et transforme chaque événement serveur en mise à jour du cache et en toast (invitation, appel à la table, expiration, début/fin/annulation de match). */
export const QueueBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    /** [Socle produit babyfoot (hors module)] Navigue vers la page des tables (action des toasts). */
    const goToTables = () => navigate(ROUTES.TABLES);
    /** [Socle produit babyfoot (hors module)] Invalide les caches de la file et des tables pour les recharger. */
    const refresh = () => {
      dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));
      dispatch(tablesApi.util.invalidateTags([TAG_TYPES.TABLES]));
    };
    /** [Socle produit babyfoot (hors module)] Invalide le cache des matchs. */
    const refreshMatches = () =>
      dispatch(matchesApi.util.invalidateTags([TAG_TYPES.MATCHES]));

    /** [Major · Temps réel WebSockets] Mise à jour de la file d'une table poussée par le serveur : applique les groupes dans le cache. */
    const onUpdate = (payload: { tableId: string; groups: QueueGroup[] }) => {
      applyQueueUpdateToCache(dispatch, payload.tableId, payload.groups);
    };

    /** [Minor · Notifications] Invitation à rejoindre un groupe reçue : toast avec lien vers les tables. */
    const onInvite = async (payload: { tableId: string; from: string }) => {
      refresh();
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.inviteToast", { name: payload.from, table: name }),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    /** [Minor · Notifications] Un invité a refusé : toast d'erreur. */
    const onInviteDeclined = (payload: { by: string }) => {
      refresh();
      toast.add({
        title: i18n.t("queue.inviteDeclinedToast", { name: payload.by }),
        type: "error",
      });
    };

    /** [Minor · Notifications] Le groupe a été fermé : toast d'information. */
    const onGroupClosed = () => {
      refresh();
      toast.add({ title: i18n.t("queue.groupClosedToast"), type: "info" });
    };

    /** [Minor · Notifications] C'est le tour du groupe de l'utilisateur : toast « table libre ». */
    const onCalled = async (payload: { tableId: string }) => {
      refresh();
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.calledToast", { table: name }),
        type: "success",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    /** [Minor · Notifications] Appel ou invitation expiré (délai, tournoi) : toast adapté à la raison. */
    const onExpired = async (payload: { tableId: string; reason?: string }) => {
      refresh();
      const name = await tableName(dispatch, payload.tableId);
      const key =
        payload.reason === "invite"
          ? "queue.inviteExpiredToast"
          : payload.reason === "tournament"
            ? "queue.tournamentToast"
            : payload.reason === "admin"
              ? "queue.adminReleasedToast"
              : "queue.expiredToast";
      toast.add({ title: i18n.t(key, { table: name }), type: "error" });
    };

    /** [Minor · Notifications] Match démarré sur une table : toast de confirmation. */
    const onMatchStarted = async (payload: { tableId: string }) => {
      refresh();
      refreshMatches();
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.matchStartedToast", { table: name }),
        type: "success",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    /** [Minor · Notifications] Le score doit être saisi : toast avec lien vers les tables. */
    const onScoreRequired = () => {
      refresh();
      toast.add({
        title: i18n.t("queue.scoreRequiredToast"),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    /** [Minor · Notifications] Match terminé : indique si le groupe reste ou quitte la table. */
    const onMatchEnded = (payload: { stays: boolean }) => {
      refresh();
      refreshMatches();
      toast.add({
        title: i18n.t(payload.stays ? "queue.staysToast" : "queue.leavesToast"),
        type: "info",
      });
    };

    /** [Minor · Notifications] Match annulé (libération collective, admin…) : toast selon la raison. */
    const onMatchCancelled = (payload: { reason?: string }) => {
      refresh();
      refreshMatches();
      const key =
        payload.reason === "externalRelease"
          ? "queue.matchClosedByOthersToast"
          : payload.reason === "admin"
            ? "queue.adminReleasedToast"
            : "queue.matchCancelledToast";
      toast.add({ title: i18n.t(key), type: "error" });
    };

    /** [Major · Temps réel WebSockets] Après une reconnexion du socket : resynchronise la file. */
    const onReconnect = () => refresh();

    socket.on("queue:update", onUpdate);
    socket.on("queue:invite", onInvite);
    socket.on("queue:inviteDeclined", onInviteDeclined);
    socket.on("queue:groupClosed", onGroupClosed);
    socket.on("queue:called", onCalled);
    socket.on("queue:expired", onExpired);
    socket.on("table:matchStarted", onMatchStarted);
    socket.on("table:scoreRequired", onScoreRequired);
    socket.on("table:matchEnded", onMatchEnded);
    socket.on("table:matchCancelled", onMatchCancelled);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("queue:update", onUpdate);
      socket.off("queue:invite", onInvite);
      socket.off("queue:inviteDeclined", onInviteDeclined);
      socket.off("queue:groupClosed", onGroupClosed);
      socket.off("queue:called", onCalled);
      socket.off("queue:expired", onExpired);
      socket.off("table:matchStarted", onMatchStarted);
      socket.off("table:scoreRequired", onScoreRequired);
      socket.off("table:matchEnded", onMatchEnded);
      socket.off("table:matchCancelled", onMatchCancelled);
      socket.io.off("reconnect", onReconnect);
      disconnect();
    };
  }, [accessToken, dispatch]);

  return <>{children}</>;
};
