import { Navigate, Outlet } from "react-router";
import { useAppSelector } from "@/store/hooks";

export const ProtectedLayout = () => {
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
