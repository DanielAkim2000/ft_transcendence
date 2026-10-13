import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import type { ChessPlayer } from "./chessApi";

type Props = {
  player?: ChessPlayer;
  color: "WHITE" | "BLACK";
  isMe: boolean;
  /** Vrai quand c'est à ce joueur de jouer. */
  toMove: boolean;
  /** La partie est terminée : on n'affiche plus « à lui de jouer ». */
  finished: boolean;
};

/** [Major · Jeu web (Échecs)] Barre d'un joueur autour de l'échiquier : avatar, nom, couleur des pièces et indication du trait. */
export function ChessPlayerBar({ player, color, isMe, toMove, finished }: Props) {
  const { t } = useTranslation();
  const active = toMove && !finished;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border px-3 py-2",
        active ? "border-primary/60 bg-primary/10" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9 shrink-0 rounded-lg">
          <AvatarImage
            src={resolveAvatarUrl(player?.avatarUrl)}
            alt={player?.displayname ?? ""}
            className="rounded-lg"
          />
          <AvatarFallback className="rounded-lg text-xs">
            {getInitials(player?.displayname)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold">
            {player?.displayname ?? "?"}
            {isMe ? (
              <span className="ml-2 text-[10px] font-normal uppercase tracking-widest text-muted-foreground">
                {t("chess.page.you")}
              </span>
            ) : null}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                "inline-block size-2.5 border border-foreground/50",
                color === "WHITE" ? "bg-white" : "bg-neutral-900",
              )}
            />
            {t(color === "WHITE" ? "chess.page.white" : "chess.page.black")}
          </p>
        </div>
      </div>
      {active ? (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {t("chess.page.toMove")}
        </span>
      ) : null}
    </div>
  );
}
