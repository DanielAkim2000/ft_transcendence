import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { connect, disconnect } from "./queueSocket";
import { applyQueueUpdateToCache, queueApi, type QueueEntry } from "./queueApi";
import { tablesApi } from "../tables/tablesApi";
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

    const onUpdate = (payload: { tableId: string; entries: QueueEntry[] }) => {
      applyQueueUpdateToCache(dispatch, payload.tableId, payload.entries);
    };

    const onCalled = async (payload: { tableId: string; expiresAt: string }) => {
      dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.calledToast", { table: name }),
        type: "success",
        actionProps: {
          children: i18n.t("home.review"),
          onClick: () => navigate(ROUTES.TABLES),
        },
      });
    };

    const onExpired = async (payload: { tableId: string }) => {
      dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));
      const name = await tableName(dispatch, payload.tableId);
      toast.add({
        title: i18n.t("queue.expiredToast", { table: name }),
        type: "error",
      });
    };

    const onReconnect = () => dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));

    socket.on("queue:update", onUpdate);
    socket.on("queue:called", onCalled);
    socket.on("queue:expired", onExpired);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("queue:update", onUpdate);
      socket.off("queue:called", onCalled);
      socket.off("queue:expired", onExpired);
      socket.io.off("reconnect", onReconnect);
      disconnect();
    };
  }, [accessToken, dispatch]);

  return <>{children}</>;
};
