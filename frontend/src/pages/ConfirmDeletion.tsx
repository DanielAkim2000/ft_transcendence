import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/layouts/AuthShell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { clearCredentials } from "@/features/auth/authSlice";
import { useConfirmAccountDeletionMutation } from "@/features/gdpr/gdprApi";
import { api } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";

const REDIRECT_DELAY_MS = 5000;

/** Page ouverte depuis le lien de l'email : la suppression n'a lieu qu'au clic (pas au simple chargement de la page). */
export const ConfirmDeletion = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [confirm, { isLoading }] = useConfirmAccountDeletionMutation();
  // État local : resetApiState() ci-dessous remet à zéro l'état de la mutation,
  // ce qui ferait réapparaître le formulaire juste après la suppression.
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<"invalid" | "gone" | "blocked" | null>(
    null,
  );

  useEffect(() => {
    if (!deleted) return;
    // Le lien ne sert plus : on quitte la page (remplacée dans l'historique, le retour arrière n'y revient pas).
    const timer = setTimeout(
      () => navigate(ROUTES.LOGIN, { replace: true }),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [deleted, navigate]);

  const handleConfirm = async () => {
    if (!token) return;
    setError(null);
    try {
      await confirm(token).unwrap();
      setDeleted(true);
      // Le compte n'existe plus : on vide la session locale et le cache.
      dispatch(clearCredentials());
      dispatch(api.util.resetApiState());
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 404 ? "gone" : status === 409 ? "blocked" : "invalid",
      );
    }
  };

  return (
    <AuthShell>
      <div className="flex flex-col gap-4 border border-border bg-card p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {t("confirmDeletion.label")}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            {t("confirmDeletion.title")}
          </h1>
        </div>

        {deleted ? (
          <div role="status" className="flex flex-col gap-1">
            <p className="text-sm text-primary">{t("confirmDeletion.done")}</p>
            <p className="text-xs text-muted-foreground">
              {t("confirmDeletion.redirecting")}
            </p>
          </div>
        ) : !token ? (
          <p role="alert" className="text-sm text-destructive">
            {t("confirmDeletion.missingToken")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("confirmDeletion.warning")}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {t(`confirmDeletion.error_${error}`)}
              </p>
            ) : null}
            {error !== "gone" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isLoading}
                onClick={() => void handleConfirm()}
              >
                {isLoading
                  ? t("confirmDeletion.deleting")
                  : t("confirmDeletion.action")}
              </Button>
            ) : null}
          </>
        )}

        <Link
          to={ROUTES.LOGIN}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          {t("confirmDeletion.toLogin")}
        </Link>
      </div>
    </AuthShell>
  );
};
