import { cn } from "@/lib/utils";

type LogoProps = {
  /** Affiche le petit curseur clignotant à la fin (repris de Loader, pour l'écran de chargement). */
  cursor?: boolean;
  className?: string;
};

/**
 * [Minor · Design system]
 * Marque « 42baby » : invite de terminal (">_") + "42" en vert (primary),
 * "baby" dans la couleur de texte ambiante du contexte où le logo apparaît
 * (sidebar, écran de connexion...). Hérite la taille de police du parent :
 * un simple `text-xs` ou `text-2xl` sur un ancêtre suffit à la redimensionner.
 */
export function Logo({ cursor = false, className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-heading font-extrabold tracking-tight normal-case",
        className,
      )}
    >
      <span className="text-primary">{">_ 42"}</span>
      <span>baby</span>
      {cursor ? (
        <span
          aria-hidden
          className="ml-1 inline-block h-[0.85em] w-[0.16em] translate-y-[0.08em] self-center bg-primary animate-loader-blink motion-reduce:animate-none"
        />
      ) : null}
    </span>
  );
}
