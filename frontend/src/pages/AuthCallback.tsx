import { useEffect } from "react";
import { useNavigate } from "react-router";
import { setTwoFactorRequired } from "@/features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useLazyCheck2faPendingQuery } from "@/features/auth/authApi";
import { ROUTES } from "@/constants/routes";
import { PageFallback } from "@/components/page-fallback";

/** [Minor · OAuth 42] Page de retour de l'OAuth 42 : si AuthBootstrap a déjà récupéré la session (cookie de refresh), redirige vers l'accueil ; sinon vérifie si une pré-authentification 2FA est en attente (marque alors la 2FA comme requise) et renvoie vers /login. */
export const AuthCallback = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const [check2faPending] = useLazyCheck2faPendingQuery();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // AuthBootstrap already attempted /auth/refresh via the httpOnly cookie.
      if (accessToken) {
        navigate(ROUTES.HOME, { replace: true });
        return;
      }

      try {
        await check2faPending().unwrap();
        if (!cancelled) {
          dispatch(setTwoFactorRequired());
          navigate(ROUTES.LOGIN, { replace: true });
        }
      } catch {
        if (!cancelled) {
          navigate(ROUTES.LOGIN, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, check2faPending, dispatch, navigate]);

  return (
    <PageFallback fullscreen />
  );
};
