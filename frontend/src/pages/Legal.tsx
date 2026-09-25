import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LegalLinks } from "@/components/legal-links";
import { ROUTES } from "@/constants/routes";
import { useAppSelector } from "@/store/hooks";

type Section = { title: string; body: string };

export const Legal = ({ kind }: { kind: "privacy" | "terms" }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isLoggedIn = useAppSelector((s) => Boolean(s.auth.accessToken));
  const sections = t(`legal.${kind}.sections`, {
    returnObjects: true,
  }) as Section[];

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="w-fit text-xs text-muted-foreground hover:text-primary"
      >
        {t("legal.back")}
      </button>
      <article className="flex flex-col gap-6 border border-border bg-card p-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {t("legal.label")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {t(`legal.${kind}.title`)}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("legal.updated")}
          </p>
        </header>
        {sections.map((section, index) => (
          <section key={section.title} className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold">
              <span className="mr-2 text-primary">{index + 1}.</span>
              {section.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </article>
      <footer className="flex items-center justify-between">
        <LegalLinks />
        <Link
          to={isLoggedIn ? ROUTES.HOME : ROUTES.LOGIN}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          {isLoggedIn ? t("nav.home") : t("auth.login.submit")}
        </Link>
      </footer>
    </div>
  );
};
