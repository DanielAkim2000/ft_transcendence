import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal-links";
import { GridBackdrop } from "@/components/grid-backdrop";
import { Logo } from "@/components/logo";
import { setLanguage } from "@/features/settings/settingsSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

/** [Minor · Multilingue] Cadre des pages d'authentification (login, inscription…) : fond, logo, sélecteur de langue EN/FR/ES et liens légaux. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const language = useAppSelector((s) => s.settings.language);

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <GridBackdrop />

      <main className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Logo className="text-base" />
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
