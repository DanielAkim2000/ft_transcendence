import { Navigate, Outlet } from "react-router";
import { useMeQuery } from "@/features/auth/authApi";
import { PageFallback } from "@/components/page-fallback";
import { ROUTES } from "@/constants/routes";

/** [Major · Permissions avancées] Réserve les routes enfants aux administrateurs (les autres sont renvoyés à l'accueil ; le backend refuse de toute façon les appels). */
export const RequireAdmin = () => {
  const { data: me, isLoading } = useMeQuery();

  if (isLoading) {
    return <PageFallback />;
  }
  if (me?.role !== "ADMIN") {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return <Outlet />;
};
