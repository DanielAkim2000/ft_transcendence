import { useEffect } from "react";
import { useMeQuery } from "@/features/auth/authApi";
import { hydrateSettings } from "@/features/settings/settingsSlice";
import { useAppDispatch } from "@/store/hooks";

/**
 * Quand l'utilisateur est connecté, la BDD est la source de vérité :
 * on hydrate Redux (+ persist local) depuis /auth/me.
 */
export function SettingsBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { data: user } = useMeQuery();

  useEffect(() => {
    if (!user?.theme || !user?.language) return;
    dispatch(
      hydrateSettings({
        theme: user.theme,
        language: user.language,
        accent: user.accent,
        radius: user.radius,
      }),
    );
  }, [user, dispatch]);

  return children;
}
