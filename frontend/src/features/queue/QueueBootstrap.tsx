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

async function tableName(
  dispatch: ReturnType<typeof useAppDispatch>,
  tableId: string,
): Promise<string> {
  const result = await dispatch(tablesApi.endpoints.listTables.initiate());
  return result.data?.find((table) => table.id === tableId)?.name ?? "?";
}

export const QueueBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    const goToTables = () => navigate(ROUTES.TABLES);
    const refresh = () => {
      dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));
      dispatch(tablesApi.util.invalidateTags([TAG_TYPES.TABLES]));
    };
    const refreshMatches = () =>
      dispatch(matchesApi.util.invalidateTags([TAG_TYPES.MATCHES]));

    const onUpdate = (payload: { tableId: string; groups: QueueGroup[] }) => {
      applyQueueUpdateToCache(dispatch, payload.tableId, payload.groups);
    };

    const onInvite = async (payload: { tableId: string; from: string }) => {
      refresh();
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.inviteToast", { name: payload.from, table: name }),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    const onInviteDeclined = (payload: { by: string }) => {
      refresh();
      toast.add({
        title: i18n.t("queue.inviteDeclinedToast", { name: payload.by }),
        type: "error",
      });
    };

    const onGroupClosed = () => {
      refresh();
      toast.add({ title: i18n.t("queue.groupClosedToast"), type: "info" });
    };

    const onCalled = async (payload: { tableId: string }) => {
      refresh();
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.calledToast", { table: name }),
        type: "success",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    const onExpired = async (payload: { tableId: string; reason?: string }) => {
      refresh();
      const name = await tableName(dispatch, payload.tableId);
      const key =
        payload.reason === "invite"
          ? "queue.inviteExpiredToast"
          : payload.reason === "tournament"
            ? "queue.tournamentToast"
            : "queue.expiredToast";
      toast.add({ title: i18n.t(key, { table: name }), type: "error" });
    };

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

    const onScoreRequired = () => {
      refresh();
      toast.add({
        title: i18n.t("queue.scoreRequiredToast"),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    const onMatchEnded = (payload: { stays: boolean }) => {
      refresh();
      refreshMatches();
      toast.add({
        title: i18n.t(payload.stays ? "queue.staysToast" : "queue.leavesToast"),
        type: "info",
      });
    };

    const onMatchCancelled = (payload: { reason?: string }) => {
      refresh();
      refreshMatches();
      const key =
        payload.reason === "externalRelease"
          ? "queue.matchClosedByOthersToast"
          : "queue.matchCancelledToast";
      toast.add({ title: i18n.t(key), type: "error" });
    };

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
