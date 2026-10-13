import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { ChessMoveEntry } from "./chessApi";

type Props = {
  moves: ChessMoveEntry[];
  className?: string;
};

/** [Major · Jeu web (Échecs)] Historique des coups en notation algébrique, rangé par numéro de coup (« 1. e4 e5 »). Le dernier coup est mis en avant et la liste suit la partie. */
export function ChessMoveList({ moves, className }: Props) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [moves.length]);

  const rows: { number: number; white?: ChessMoveEntry; black?: ChessMoveEntry }[] = [];
  for (const move of moves) {
    const number = Math.ceil(move.ply / 2);
    let row = rows[rows.length - 1];
    if (!row || row.number !== number) {
      row = { number };
      rows.push(row);
    }
    if (move.color === "WHITE") row.white = move;
    else row.black = move;
  }
  const lastPly = moves[moves.length - 1]?.ply;

  /** [Major · Jeu web (Échecs)] Cellule d'un coup (notation SAN), le dernier coup joué étant mis en évidence. */
  const cell = (move?: ChessMoveEntry) => (
    <span
      className={cn(
        "px-1.5 py-0.5 font-mono",
        move && move.ply === lastPly && "bg-primary/15 font-bold text-primary",
      )}
    >
      {move?.san ?? ""}
    </span>
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("chess.page.moves.title")}
      </h2>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("chess.page.moves.empty")}</p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto px-1 py-1 text-sm">
          {rows.map((row, index) => (
            <li
              key={row.number}
              ref={index === rows.length - 1 ? endRef : undefined}
              className="grid grid-cols-[2rem_1fr_1fr] items-center"
            >
              <span className="px-1.5 text-xs text-muted-foreground">{row.number}.</span>
              {cell(row.white)}
              {cell(row.black)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
