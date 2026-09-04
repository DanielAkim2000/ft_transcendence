import { Navigate, Outlet } from "react-router";
import { useAppSelector } from "@/store/hooks";
import PresenceBootstrap from "@/features/presence/PresenceBootstrap";
import { SettingsBootstrap } from "@/features/settings/SettingsBootstrap";
import { ROUTES } from "@/constants/routes";

export const ProtectedLayout = () => {
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  if (!accessToken) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <SettingsBootstrap>
      <PresenceBootstrap>
        <Outlet />
      </PresenceBootstrap>
    </SettingsBootstrap>
  );
};
