import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { setTwoFactorRequired } from "@/features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useLazyCheck2faPendingQuery } from "@/features/auth/authApi";
import { ROUTES } from "@/constants/routes";

export const AuthCallback = () => {
  const { t } = useTranslation();
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
    <div className="flex min-h-svh items-center justify-center px-4">
      <p className="font-sans text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
};
