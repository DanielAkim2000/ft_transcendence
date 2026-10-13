import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

type LoaderProps = {
  /** Texte sous la barre ; « Chargement… » par défaut. */
  label?: string;
  className?: string;
};

/** [Minor · Design system] Indicateur de chargement aux couleurs de l'app : invite de terminal, barre indéterminée et libellé. N'apparaît qu'après un court délai pour éviter tout clignotement sur les chargements rapides. */
export function Loader({ label, className }: LoaderProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-4 animate-loader-in", className)}
    >
      <Logo cursor className="text-sm" />
      <div aria-hidden className="relative h-0.5 w-44 overflow-hidden bg-border">
        <span className="absolute inset-y-0 left-0 w-1/3 bg-primary animate-loader-slide motion-reduce:animate-none" />
      </div>
      <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        {label ?? t("common.loading")}
      </p>
    </div>
  );
}
