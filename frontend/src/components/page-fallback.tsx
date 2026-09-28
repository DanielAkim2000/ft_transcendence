import { GridBackdrop } from "@/components/grid-backdrop";
import { Loader } from "@/components/loader";

/** Affiché pendant le chargement à la demande d'une page : plein écran hors du tableau de bord, simple bloc centré dans la zone de contenu sinon. */
export function PageFallback({ fullscreen = false }: { fullscreen?: boolean }) {
  if (fullscreen) {
    return (
      <div className="relative flex min-h-svh items-center justify-center overflow-hidden">
        <GridBackdrop />
        <Loader className="relative z-10" />
      </div>
    );
  }
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Loader />
    </div>
  );
}
