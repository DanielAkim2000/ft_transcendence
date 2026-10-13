import { useAppSelector } from "@/store/hooks";
import { useRefreshMutation } from "./authApi";
import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { clearSessionHint, hasSessionHint } from "@/lib/sessionHint";

let bootstrapRefresh: Promise<void> | null = null;

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
      // Sans témoin de session, pas de refresh : il répondrait 401 et le navigateur l'afficherait en console.
      if (!accessToken && hasSessionHint()) {
        bootstrapRefresh ??= refresh()
          .unwrap()
          .then(() => undefined)
          .catch(() => {
            clearSessionHint();
            logger("No session", "error");
          });
        await bootstrapRefresh;
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // Volontairement mount-only : ne doit tourner qu'une fois au boot de l'app,
    // sinon le dédoublonnage via bootstrapRefresh perd son intérêt et on
    // retombe sur la race de double refresh corrigée précédemment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return children;
};
