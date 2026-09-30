import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMeQuery } from "@/features/auth/authApi";
import {
  ACCENT_PREFERENCES,
  RADIUS_PREFERENCES,
  setAccent,
  setLanguage,
  setRadius,
  setTheme,
  type AccentPreference,
  type LanguagePreference,
  type RadiusPreference,
  type ThemePreference,
} from "@/features/settings/settingsSlice";
import { useUpdateSettingsMutation } from "@/features/users/usersApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/get-error-message";
import { useRequestAccountDeletionMutation } from "@/features/gdpr/gdprApi";
import { ExportDataDialog } from "@/features/gdpr/ExportDataDialog";

const tileClass =
  "relative flex cursor-pointer flex-col items-center justify-center gap-2 border border-border px-3 py-4 text-xs tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent has-data-checked:border-primary has-data-checked:bg-primary/10 has-data-checked:text-foreground";

const hiddenRadio = "absolute inset-0 size-full opacity-0 after:hidden";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

/** Pastille de prévisualisation de chaque couleur (teinte du thème clair). */
const accentSwatch: Record<AccentPreference, string> = {
  green: "#1f9d55",
  blue: "#2563eb",
  purple: "#7c3aed",
  pink: "#be185d",
  red: "#d9342b",
  orange: "#c2410c",
  amber: "#a16207",
  teal: "#0f766e",
};

/** Aperçu de l'arrondi : rayon du coin de la case. */
const radiusPreview: Record<RadiusPreference, string> = {
  none: "0",
  medium: "0.5rem",
  large: "1rem",
};

const themeSwatch: Record<ThemePreference, string> = {
  dark: "bg-[#07090a] border-[#3ddc84]",
  light: "bg-[#f4f1ea] border-[#1f9d55]",
  system:
    "bg-linear-to-r from-[#07090a] from-50% to-[#f4f1ea] to-50% border-border",
};

export const Settings = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.settings.theme);
  const language = useAppSelector((s) => s.settings.language);
  const accent = useAppSelector((s) => s.settings.accent);
  const radius = useAppSelector((s) => s.settings.radius);
  const { data: me } = useMeQuery();
  const [updateSettings] = useUpdateSettingsMutation();
  const [requestDeletion, { isLoading: requestingDeletion }] =
    useRequestAccountDeletionMutation();

  /** Étape 1 de la suppression : envoie l'email de confirmation (le compte n'est pas encore supprimé). */
  const handleRequestDeletion = async () => {
    try {
      await requestDeletion().unwrap();
      toast.add({ title: t("settings.privacy.requested"), type: "success" });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("settings.privacy.requestFailed")),
        type: "error",
      });
    }
  };

  const persistSettings = (
    next: Partial<{
      theme: ThemePreference;
      language: LanguagePreference;
      accent: AccentPreference;
      radius: RadiusPreference;
    }>,
  ) => {
    const nextTheme = next.theme ?? theme;
    const nextLanguage = next.language ?? language;
    const nextAccent = next.accent ?? accent;
    const nextRadius = next.radius ?? radius;

    if (next.theme) dispatch(setTheme({ theme: next.theme }));
    if (next.language) dispatch(setLanguage({ language: next.language }));
    if (next.accent) dispatch(setAccent({ accent: next.accent }));
    if (next.radius) dispatch(setRadius({ radius: next.radius }));

    void updateSettings({
      theme: nextTheme,
      language: nextLanguage,
      accent: nextAccent,
      radius: nextRadius,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 border border-border bg-card p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.description")}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("settings.theme.title")}</SectionTitle>
        <RadioGroup
          value={theme}
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") {
              persistSettings({ theme: value });
            }
          }}
          className="grid grid-cols-3 gap-3"
        >
          {(["dark", "light", "system"] as const).map((value) => (
            <Label key={value} className={cn(tileClass, "uppercase")}>
              <RadioGroupItem value={value} className={hiddenRadio} />
              <span className={cn("h-4 w-8 border", themeSwatch[value])} />
              {t(`settings.theme.${value}`)}
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("settings.accent.title")}</SectionTitle>
        <p className="text-xs text-muted-foreground">
          {t("settings.accent.description")}
        </p>
        <RadioGroup
          value={accent}
          onValueChange={(value) => {
            if ((ACCENT_PREFERENCES as readonly string[]).includes(value)) {
              persistSettings({ accent: value as AccentPreference });
            }
          }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {ACCENT_PREFERENCES.map((value) => (
            <Label key={value} className={tileClass}>
              <RadioGroupItem value={value} className={hiddenRadio} />
              <span
                className="size-6 rounded-full"
                style={{ backgroundColor: accentSwatch[value] }}
              />
              {t(`settings.accent.${value}`)}
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("settings.radius.title")}</SectionTitle>
        <p className="text-xs text-muted-foreground">
          {t("settings.radius.description")}
        </p>
        <RadioGroup
          value={radius}
          onValueChange={(value) => {
            if ((RADIUS_PREFERENCES as readonly string[]).includes(value)) {
              persistSettings({ radius: value as RadiusPreference });
            }
          }}
          className="grid grid-cols-3 gap-3"
        >
          {RADIUS_PREFERENCES.map((value) => (
            <Label key={value} className={tileClass}>
              <RadioGroupItem value={value} className={hiddenRadio} />
              <span
                className="h-6 w-10 border-2 border-primary"
                style={{ borderRadius: radiusPreview[value] }}
              />
              {t(`settings.radius.${value}`)}
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("settings.language.title")}</SectionTitle>
        <RadioGroup
          value={language}
          onValueChange={(value) => {
            if (value === "en" || value === "fr" || value === "es") {
              persistSettings({ language: value });
            }
          }}
          className="grid grid-cols-3 gap-3"
        >
          {(["en", "fr", "es"] as const).map((value) => (
            <Label key={value} className={tileClass}>
              <RadioGroupItem value={value} className={hiddenRadio} />
              <span className="text-sm font-semibold uppercase">{value}</span>
              {t(`settings.language.${value}`)}
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("settings.security.title")}</SectionTitle>
        <div className="flex items-center justify-between gap-3 border border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t("settings.security.twoFactor")}
            </p>
            <p
              className={cn(
                "text-xs",
                me?.twoFactorEnabled ? "text-primary" : "text-muted-foreground",
              )}
            >
              {me?.twoFactorEnabled
                ? t("settings.security.active")
                : t("settings.security.inactive")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            render={<Link to={ROUTES.SETTINGS_2FA} />}
          >
            {t("settings.security.manage")}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("settings.privacy.title")}</SectionTitle>
        <p className="text-xs text-muted-foreground">
          {t("settings.privacy.description")}
        </p>
        <div className="flex items-center justify-between gap-3 border border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t("settings.privacy.exportTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.privacy.exportDescription")}
            </p>
          </div>
          <ExportDataDialog>
            <Button size="sm" variant="outline">
              {t("settings.privacy.exportAction")}
            </Button>
          </ExportDataDialog>
        </div>
        <div className="flex items-center justify-between gap-3 border border-destructive/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t("settings.privacy.deleteTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.privacy.deleteDescription")}
            </p>
          </div>
          <ConfirmDialog
            title={t("settings.privacy.dialogTitle")}
            description={t("settings.privacy.dialogDescription")}
            confirmLabel={t("settings.privacy.dialogConfirm")}
            loading={requestingDeletion}
            onConfirm={handleRequestDeletion}
          >
            <Button size="sm" variant="destructive">
              {t("settings.privacy.deleteAction")}
            </Button>
          </ConfirmDialog>
        </div>
      </section>
    </div>
  );
};
