import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Gamepad2Icon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/features/auth/authApi";
import { useListChessGamesQuery } from "@/features/chess/chessApi";
import { ROUTES } from "@/constants/routes";

const PERKS = ["live", "board3d", "resume"] as const;

/** Bouton flottant (bas droite des pages connectées) qui ouvre une invitation à jouer aux échecs ; masqué sur la page des échecs et sur le chat, où il recouvre le bouton d'envoi. */
export function ChessLauncher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { data: me } = useMeQuery();
  // Rafraîchi aussi toutes les minutes : un coup joué ou une partie terminée ne génère pas de notification.
  const { data: games = [] } = useListChessGamesQuery(undefined, {
    pollingInterval: 60_000,
  });

  // Le bouton signale d'un point une invitation reçue à traiter ou une partie en cours.
  const pendingInvites = games.filter(
    (game) => game.status === "PENDING" && game.challengerId !== me?.id,
  ).length;
  const activeGames = games.filter((game) => game.status === "ACTIVE").length;
  const needsAttention = pendingInvites + activeGames > 0;

  if (pathname.startsWith(ROUTES.CHESS) || pathname.startsWith(ROUTES.CHAT)) return null;

  const play = () => {
    setOpen(false);
    navigate(ROUTES.CHESS);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("chess.launcher.open")}
        title={t("chess.launcher.open")}
        className="group/launcher fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-lg border border-primary/60 bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all outline-none hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0 md:right-6 md:bottom-6"
      >
        <Gamepad2Icon className="size-5 transition-transform group-hover/launcher:rotate-6 group-hover/launcher:scale-110" />
        {needsAttention ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex size-3.5"
          >
            {/* L'anneau pulse seulement quand une invitation attend une réponse. */}
            {pendingInvites > 0 ? (
              <span className="absolute inline-flex size-full animate-ping bg-destructive/70" />
            ) : null}
            <span className="relative inline-flex size-full border border-background bg-destructive" />
          </span>
        ) : null}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl outline-none transition-all duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {/* Bandeau : damier en fondu et cavalier, aux couleurs de l'accent choisi. */}
          <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-border">
            <div
              aria-hidden
              className="absolute inset-0 bg-[repeating-conic-gradient(color-mix(in_oklab,var(--primary)_16%,transparent)_0_25%,transparent_0_50%)] bg-size-[40px_40px] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_22%,transparent)_0%,transparent_65%)]"
            />
            <span
              aria-hidden
              className="relative font-heading text-6xl leading-none text-primary drop-shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
            >
              ♞
            </span>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
                {t("chess.launcher.eyebrow")}
              </p>
              <Dialog.Title className="mt-1 font-heading text-xl font-bold tracking-tight">
                {t("chess.launcher.title")}
              </Dialog.Title>
              <Dialog.Description className="mt-2 font-sans text-sm text-muted-foreground">
                {t("chess.launcher.description")}
              </Dialog.Description>
            </div>

            <ul className="flex flex-col gap-2 font-sans text-sm">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 bg-primary"
                  />
                  {t(`chess.launcher.perks.${perk}`)}
                </li>
              ))}
            </ul>

            {needsAttention ? (
              <div
                role="status"
                className="flex flex-col gap-1 border border-primary/40 bg-primary/10 p-2.5 font-sans text-sm text-primary"
              >
                {pendingInvites > 0 ? (
                  <p>{t("chess.launcher.pending", { count: pendingInvites })}</p>
                ) : null}
                {activeGames > 0 ? (
                  <p>{t("chess.launcher.active", { count: activeGames })}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close render={<Button type="button" variant="outline" />}>
                {t("chess.launcher.later")}
              </Dialog.Close>
              <Button type="button" onClick={play}>
                {t("chess.launcher.play")}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
