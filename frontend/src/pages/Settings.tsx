import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  setLanguage,
  setTheme,
  type LanguagePreference,
  type ThemePreference,
} from "@/features/settings/settingsSlice";
import { useUpdateSettingsMutation } from "@/features/users/usersApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export const Settings = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.settings.theme);
  const language = useAppSelector((s) => s.settings.language);
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {t("settings.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.theme.title")}</CardTitle>
          <CardDescription>{t("settings.theme.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value) => {
              if (value === "light" || value === "dark" || value === "system") {
                persistSettings({ theme: value });
              }
            }}
            className="gap-3"
          >
            {(
              [
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
                { value: "system", label: t("settings.theme.system") },
              ] as const
            ).map((option) => (
              <Label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 has-data-checked:border-primary"
              >
                <RadioGroupItem value={option.value} />
                <span className="font-sans text-sm">{option.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language.title")}</CardTitle>
          <CardDescription>
            {t("settings.language.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={language}
            onValueChange={(value) => {
              if (value === "en" || value === "fr" || value === "es") {
                persistSettings({ language: value });
              }
            }}
            className="gap-3"
          >
            {(
              [
                { value: "en", label: t("settings.language.en") },
                { value: "fr", label: t("settings.language.fr") },
                { value: "es", label: t("settings.language.es") },
              ] as const
            ).map((option) => (
              <Label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 has-data-checked:border-primary"
              >
                <RadioGroupItem value={option.value} />
                <span className="font-sans text-sm">{option.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};
