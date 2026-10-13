import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { connect, disconnect } from "./tournamentsSocket";
import { applyTournamentToCache, tournamentsApi, type Tournament } from "./tournamentsApi";
import { TAG_TYPES } from "@/constants/tagTypes";
import { ROUTES } from "@/constants/routes";
import { navigate } from "@/lib/navigation";
import { toast } from "@/components/ui/toast";
import i18n from "@/i18n";

/** [Minor · Tournois] Retrouve le nom d'un tournoi (cache ou requête) pour les toasts. */
async function tournamentName(
  dispatch: ReturnType<typeof useAppDispatch>,
  tournamentId: string,
): Promise<string> {
  const result = await dispatch(
    tournamentsApi.endpoints.getTournament.initiate(tournamentId),
  );
  return result.data?.name ?? "?";
}

/** [Major · Temps réel WebSockets] Connecte le socket des tournois et affiche des toasts en direct (lancement, table reprise, match prêt, victoire, élimination, fin) en gardant le cache à jour. */
export const TournamentsBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    /** [Minor · Tournois] Navigue vers la liste des tournois. */
    const goToTournaments = () => navigate(ROUTES.TOURNAMENTS);
    /** [Minor · Tournois] Navigue vers la page des tables. */
    const goToTables = () => navigate(ROUTES.TABLES);

    /** [Major · Temps réel WebSockets] Tournoi créé ou modifié côté serveur : met à jour le cache. */
    const onSync = (tournament: Tournament) => applyTournamentToCache(dispatch, tournament);

    /** [Minor · Notifications] Tournoi lancé : cache + toast. */
    const onLaunched = (tournament: Tournament) => {
      applyTournamentToCache(dispatch, tournament);
      toast.add({
        title: i18n.t("tournaments.launchedToast", { name: tournament.name }),
        type: "info",
        actionProps: { children: i18n.t("home.review"), onClick: goToTournaments },
      });
    };

    /** [Minor · Notifications] Une table réservée au tournoi a été reprise : toast d'erreur. */
    const onTableReclaimed = async (payload: { tableId: string; tournamentId: string }) => {
      const name = await tournamentName(dispatch, payload.tournamentId);
      toast.add({
        title: i18n.t("tournaments.tableReclaimedToast", { name }),
        type: "error",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    /** [Minor · Notifications] Un match de tournoi démarre pour l'utilisateur : toast avec lien vers les tables. */
    const onTieStarted = async (payload: { tournamentId: string }) => {
      const name = await tournamentName(dispatch, payload.tournamentId);
      toast.add({
        title: i18n.t("tournaments.tieStartedToast", { name }),
        type: "success",
        actionProps: { children: i18n.t("home.review"), onClick: goToTables },
      });
    };

    /** [Minor · Notifications] L'utilisateur a gagné sa confrontation : toast de succès. */
    const onTieWon = async (payload: { tournamentId: string }) => {
      const name = await tournamentName(dispatch, payload.tournamentId);
      toast.add({ title: i18n.t("tournaments.tieWonToast", { name }), type: "success" });
    };

    /** [Minor · Notifications] L'utilisateur est éliminé : toast. */
    const onEliminated = async (payload: { tournamentId: string }) => {
      const name = await tournamentName(dispatch, payload.tournamentId);
      toast.add({ title: i18n.t("tournaments.eliminatedToast", { name }), type: "error" });
    };

    /** [Minor · Notifications] Tournoi terminé : cache + toast. */
    const onCompleted = (tournament: Tournament) => {
      applyTournamentToCache(dispatch, tournament);
      toast.add({
        title: i18n.t("tournaments.completedToast", { name: tournament.name }),
        type: "success",
        actionProps: { children: i18n.t("home.review"), onClick: goToTournaments },
      });
    };

    /** [Major · Temps réel WebSockets] Après une reconnexion : recharge les tournois. */
    const onReconnect = () =>
      dispatch(tournamentsApi.util.invalidateTags([TAG_TYPES.TOURNAMENTS]));

    socket.on("tournament:created", onSync);
    socket.on("tournament:updated", onSync);
    socket.on("tournament:launched", onLaunched);
    socket.on("tournament:tableReclaimed", onTableReclaimed);
    socket.on("tournament:tieStarted", onTieStarted);
    socket.on("tournament:tieWon", onTieWon);
    socket.on("tournament:eliminated", onEliminated);
    socket.on("tournament:completed", onCompleted);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("tournament:created", onSync);
      socket.off("tournament:updated", onSync);
      socket.off("tournament:launched", onLaunched);
      socket.off("tournament:tableReclaimed", onTableReclaimed);
      socket.off("tournament:tieStarted", onTieStarted);
      socket.off("tournament:tieWon", onTieWon);
      socket.off("tournament:eliminated", onEliminated);
      socket.off("tournament:completed", onCompleted);
      socket.io.off("reconnect", onReconnect);
      disconnect();
    };
  }, [accessToken, dispatch]);

  return <>{children}</>;
};
