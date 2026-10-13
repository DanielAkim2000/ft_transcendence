import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { connect, disconnect } from "./tablesSocket";
import {
  applyTableToCache,
  removeTableFromCache,
  tablesApi,
  type BabyTable,
} from "./tablesApi";

/** [Major · Temps réel WebSockets] Connecte le socket des tables et garde la liste à jour en temps réel (mise à jour, suppression, resynchronisation après coupure). */
export const TablesBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    /** [Major · Temps réel WebSockets] Table modifiée côté serveur : met à jour le cache. */
    const onUpdate = (table: BabyTable) => applyTableToCache(dispatch, table);
    /** [Major · Temps réel WebSockets] Table supprimée côté serveur : la retire du cache. */
    const onRemoved = ({ id }: { id: string }) => removeTableFromCache(dispatch, id);
    // après une coupure, on resynchronise l'état complet
    /** [Major · Temps réel WebSockets] Après une reconnexion : recharge l'état complet des tables. */
    const onReconnect = () => dispatch(tablesApi.util.invalidateTags(["Tables"]));
    socket.on("table:update", onUpdate);
    socket.on("table:removed", onRemoved);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("table:update", onUpdate);
      socket.off("table:removed", onRemoved);
      socket.io.off("reconnect", onReconnect);
      disconnect();
    };
  }, [accessToken, dispatch]);

  return <>{children}</>;
};
