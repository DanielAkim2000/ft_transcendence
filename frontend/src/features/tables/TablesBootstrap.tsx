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

export const TablesBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    const onUpdate = (table: BabyTable) => applyTableToCache(dispatch, table);
    const onRemoved = ({ id }: { id: string }) => removeTableFromCache(dispatch, id);
    // après une coupure, on resynchronise l'état complet
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
