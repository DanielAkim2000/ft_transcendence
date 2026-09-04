import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useEffect } from "react";
import { connect, disconnect } from "./presenceSocket";
import { selectAccessToken } from "../auth/authSlice";
import applyPresenceToCache from "./applyPresenceToCache";
import type { Status } from "../auth/authApi";

interface PresenceBootstrapProps {
  children: React.ReactNode;
}

const PresenceBootstrap: React.FC<PresenceBootstrapProps> = ({ children }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }

    const socket = connect(accessToken);

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

    socket?.on("presence:update", onUpdate);
    socket?.on("presence:sync", onSync);

    return () => {
      socket?.off("presence:update", onUpdate);
      socket?.off("presence:sync", onSync);
      disconnect();
    };
  }, [accessToken]);
  return <>{children}</>;
};

export default PresenceBootstrap;
