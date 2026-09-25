import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal-links";
import { setLanguage } from "@/features/settings/settingsSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const language = useAppSelector((s) => s.settings.language);

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_14%,transparent)_0%,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_6%,transparent)_1px,transparent_1px)] bg-size-[48px_48px] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      <main className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="font-heading text-xs font-bold tracking-[0.2em] text-primary uppercase">
            {">_ "}
            {t("common.brand")}
          </p>
          <div className="flex gap-1">
            {(["en", "fr", "es"] as const).map((lng) => (
              <Button
                key={lng}
                type="button"
                size="xs"
                variant={language === lng ? "default" : "ghost"}
                onClick={() => dispatch(setLanguage({ language: lng }))}
              >
                {lng.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        {children}
        <LegalLinks className="mt-4 justify-center" />
      </main>
    </div>
  );
}
