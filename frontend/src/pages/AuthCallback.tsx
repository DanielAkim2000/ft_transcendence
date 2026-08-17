import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { setAccessToken, setPreAuthToken } from "@/features/auth/authSlice";
import { useAppDispatch } from "@/store/hooks";

export const AuthCallback = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const preAuthToken = searchParams.get("preAuthToken");

    if (accessToken) {
      dispatch(setAccessToken({ accessToken }));
      navigate("/", { replace: true });
      return;
    }

    if (preAuthToken) {
      dispatch(setPreAuthToken({ preAuthToken }));
      navigate("/login", { replace: true });
      return;
    }

    navigate("/login", { replace: true });
  }, [dispatch, navigate, searchParams]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <p className="font-sans text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
};
