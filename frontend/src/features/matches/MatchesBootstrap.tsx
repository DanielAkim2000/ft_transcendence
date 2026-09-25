import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { useMeQuery } from "../auth/authApi";
import { connect, disconnect } from "./matchesSocket";
import { applyMatchToCache, type Match } from "./matchesApi";
import { teamOf } from "./matchHelpers";
import { ROUTES } from "@/constants/routes";
import { navigate } from "@/lib/navigation";
import { toast } from "@/components/ui/toast";
import i18n from "@/i18n";

export const MatchesBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const { data: me } = useMeQuery();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken || !me) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    const goToRanking = () => navigate(ROUTES.RANKING);

    const onProposed = (match: Match) => {
      applyMatchToCache(dispatch, match);
      const challenger = match.teamA[0];
      toast.add({
        title: i18n.t("matches.proposedToast", { name: challenger?.displayname ?? "?" }),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToRanking },
      });
    };

    const onResponded = (match: Match) => {
      applyMatchToCache(dispatch, match);
      if (match.status === "DECLINED") {
        if (teamOf(match, me.id) !== "A") return;
        const opponent = match.teamB[0];
        toast.add({
          title: i18n.t("matches.declinedToast", { name: opponent?.displayname ?? "?" }),
          type: "error",
        });
        return;
      }
      toast.add({
        title: i18n.t("matches.acceptedToast"),
        type: "success",
        actionProps: { children: i18n.t("home.review"), onClick: goToRanking },
      });
    };

    const onScoreSubmitted = (match: Match) => {
      applyMatchToCache(dispatch, match);
      if (match.submittedBy?.id === me.id) return;
      const myTeam = teamOf(match, me.id);
      const submitterTeam = match.submittedBy ? teamOf(match, match.submittedBy.id) : null;
      toast.add({
        title:
          myTeam !== null && myTeam !== submitterTeam
            ? i18n.t("matches.scoreToValidateToast", {
                a: match.scoreA,
                b: match.scoreB,
              })
            : i18n.t("matches.scoreSubmittedToast", {
                a: match.scoreA,
                b: match.scoreB,
              }),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToRanking },
      });
    };

    const onCompleted = (match: Match) => {
      applyMatchToCache(dispatch, match);
      const myTeam = teamOf(match, me.id);
      const myScore = myTeam === "A" ? match.scoreA : match.scoreB;
      const otherScore = myTeam === "A" ? match.scoreB : match.scoreA;
      const won = myScore !== null && otherScore !== null && myScore > otherScore;
      toast.add({
        title: i18n.t(won ? "matches.wonToast" : "matches.lostToast", {
          a: match.scoreA,
          b: match.scoreB,
        }),
        type: won ? "success" : "info",
      });
    };

    const onDisputed = (match: Match) => {
      applyMatchToCache(dispatch, match);
      toast.add({ title: i18n.t("matches.disputedToast"), type: "error" });
    };

    socket.on("match:proposed", onProposed);
    socket.on("match:responded", onResponded);
    socket.on("match:scoreSubmitted", onScoreSubmitted);
    socket.on("match:completed", onCompleted);
    socket.on("match:disputed", onDisputed);
    return () => {
      socket.off("match:proposed", onProposed);
      socket.off("match:responded", onResponded);
      socket.off("match:scoreSubmitted", onScoreSubmitted);
      socket.off("match:completed", onCompleted);
      socket.off("match:disputed", onDisputed);
      disconnect();
    };
  }, [accessToken, me, dispatch]);

  return <>{children}</>;
};
