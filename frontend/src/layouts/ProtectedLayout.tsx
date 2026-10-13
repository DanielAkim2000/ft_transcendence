import { Navigate, Outlet } from "react-router";
import { useAppSelector } from "@/store/hooks";
import PresenceBootstrap from "@/features/presence/PresenceBootstrap";
import { ChatBootstrap } from "@/features/chat/ChatBootstrap";
import { TablesBootstrap } from "@/features/tables/TablesBootstrap";
import { QueueBootstrap } from "@/features/queue/QueueBootstrap";
import { MatchesBootstrap } from "@/features/matches/MatchesBootstrap";
import { TournamentsBootstrap } from "@/features/tournaments/TournamentsBootstrap";
import { BadgesBootstrap } from "@/features/badges/BadgesBootstrap";
import { NotificationsBootstrap } from "@/features/notifications/NotificationsBootstrap";
import { SettingsBootstrap } from "@/features/settings/SettingsBootstrap";
import { ROUTES } from "@/constants/routes";

/** [Major · Gestion des utilisateurs] Garde des pages privées : sans access token, redirige vers /login ; sinon monte les bootstraps temps réel (réglages, présence, chat, tables, file, matchs, tournois, badges, notifications) autour de la page. */
export const ProtectedLayout = () => {
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  if (!accessToken) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <SettingsBootstrap>
      <PresenceBootstrap>
        <ChatBootstrap>
          <TablesBootstrap>
            <QueueBootstrap>
              <MatchesBootstrap>
                <TournamentsBootstrap>
                  <BadgesBootstrap>
                    <NotificationsBootstrap>
                      <Outlet />
                    </NotificationsBootstrap>
                  </BadgesBootstrap>
                </TournamentsBootstrap>
              </MatchesBootstrap>
            </QueueBootstrap>
          </TablesBootstrap>
        </ChatBootstrap>
      </PresenceBootstrap>
    </SettingsBootstrap>
  );
};
