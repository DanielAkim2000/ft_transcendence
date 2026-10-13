import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { useMeQuery } from "../auth/authApi";
import { connect, disconnect } from "./badgesSocket";
import { badgesApi, type BadgeCode } from "./badgesApi";
import { TAG_TYPES } from "@/constants/tagTypes";
import { toast } from "@/components/ui/toast";
import i18n from "@/i18n";

export const BadgesBootstrap = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const accessToken = useAppSelector(selectAccessToken);
  const { data: me } = useMeQuery();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken || !me) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);

    /** [Minor · Gamification] Quand le serveur annonce un badge gagné : invalide le cache des badges du joueur et affiche un toast de félicitations. */
    const onEarned = (payload: { code: BadgeCode }) => {
      dispatch(
        badgesApi.util.invalidateTags([{ type: TAG_TYPES.BADGES, id: me.id }]),
      );
      toast.add({
        title: i18n.t("badges.earnedToast", {
          name: i18n.t(`badges.catalog.${payload.code}.name`),
        }),
        type: "success",
      });
    };

    socket.on("badges:earned", onEarned);
    return () => {
      socket.off("badges:earned", onEarned);
      disconnect();
    };
  }, [accessToken, me, dispatch]);

  return <>{children}</>;
};
