import { useAppSelector } from "@/store/hooks";
import { useRefreshMutation } from "./authApi";
import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

interface AuthBootstrapProps {
  children: React.ReactNode;
}

export const AuthBootstrap = ({ children }: AuthBootstrapProps) => {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const [refresh] = useRefreshMutation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!accessToken) {
        try {
          await refresh().unwrap();
        } catch {
          logger("No session", "error");
        }
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return children;
};
