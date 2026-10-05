import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useEffect } from "react";
import { connect, disconnect } from "./presenceSocket";
import { clearCredentials, selectAccessToken } from "../auth/authSlice";
import applyPresenceToCache from "./applyPresenceToCache";
import { usersApi } from "../users/usersApi";
import { TAG_TYPES } from "@/constants/tagTypes";
import { ROUTES } from "@/constants/routes";
import { navigate } from "@/lib/navigation";
import { toast } from "@/components/ui/toast";
import i18n from "@/i18n";
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

    const invalidateFriends = () => {
      dispatch(
        usersApi.util.invalidateTags([TAG_TYPES.FRIENDS, TAG_TYPES.USERS]),
      );
    };

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

    const onBanned =  (payload: { reason: string }) => {
      dispatch(clearCredentials());
      toast.add({ title: `You have been banned: ${payload.reason}`, type: "error" });
      navigate(ROUTES.LOGIN);
    }

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
