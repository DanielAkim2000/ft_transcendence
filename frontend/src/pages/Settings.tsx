import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMeQuery } from "@/features/auth/authApi";
import {
  setLanguage,
  setTheme,
  type LanguagePreference,
  type ThemePreference,
} from "@/features/settings/settingsSlice";
import { useUpdateSettingsMutation } from "@/features/users/usersApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

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

const themeSwatch: Record<ThemePreference, string> = {
  dark: "bg-[#07090a] border-[#3ddc84]",
  light: "bg-[#f4f1ea] border-[#1f9d55]",
  system: "bg-linear-to-r from-[#07090a] from-50% to-[#f4f1ea] to-50% border-border",
};

export const Settings = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.settings.theme);
  const language = useAppSelector((s) => s.settings.language);
  const { data: me } = useMeQuery();
  const [updateSettings] = useUpdateSettingsMutation();

  const persistSettings = (
    next: Partial<{ theme: ThemePreference; language: LanguagePreference }>,
  ) => {
    const nextTheme = next.theme ?? theme;
    const nextLanguage = next.language ?? language;

    if (next.theme) dispatch(setTheme({ theme: next.theme }));
    if (next.language) dispatch(setLanguage({ language: next.language }));

    void updateSettings({ theme: nextTheme, language: nextLanguage });
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
    </div>
  );
};
