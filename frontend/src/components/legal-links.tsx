import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

export function LegalLinks({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <nav
      className={cn(
        "flex gap-3 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <Link to={ROUTES.PRIVACY} className="hover:text-primary">
        {t("legal.nav.privacy")}
      </Link>
      <span aria-hidden>·</span>
      <Link to={ROUTES.TERMS} className="hover:text-primary">
        {t("legal.nav.terms")}
      </Link>
    </nav>
  );
}
