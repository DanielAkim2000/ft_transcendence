import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store/hooks";

interface I18nSyncProps {
  children: React.ReactNode;
}

/** [Minor · Multilingue] Applique à i18next la langue choisie dans le store (changement instantané de toutes les traductions). */
export function I18nSync({ children }: I18nSyncProps) {
  const language = useAppSelector((s) => s.settings.language);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return children;
}
