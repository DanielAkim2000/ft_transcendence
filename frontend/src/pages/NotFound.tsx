import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/layouts/AuthShell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

/** Page 404 : même ambiance « terminal » que le logo et l'écran de chargement. */
export const NotFound = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <AuthShell>
      <div className="flex flex-col gap-5 border border-border bg-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {t("notFoundPage.label")}
        </p>

        <div
          aria-hidden
          className="flex items-baseline justify-center font-heading text-7xl font-extrabold tracking-tight sm:text-8xl"
        >
          <span className="text-primary">{">_ "}</span>
          <span>404</span>
          <span className="ml-2 inline-block h-[0.7em] w-[0.12em] self-center bg-primary animate-loader-blink motion-reduce:animate-none" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {t("notFoundPage.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("notFoundPage.description")}
          </p>
        </div>

        <p className="break-all border border-border bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground">
          <span className="text-primary">$</span> cd {pathname}
          <br />
          <span className="text-destructive">
            cd: {t("notFoundPage.error")}
          </span>
        </p>

        <Button render={<Link to={ROUTES.HOME} />}>
          {t("notFoundPage.home")}
        </Button>
      </div>
    </AuthShell>
  );
};
