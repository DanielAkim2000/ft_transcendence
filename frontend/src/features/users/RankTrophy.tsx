import { TrophyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Couleurs du podium : or, argent, bronze. */
const PODIUM: Record<number, string> = {
  1: "text-[#e6b422]",
  2: "text-[#a8b0b8]",
  3: "text-[#cd7f32]",
};

/** [Minor · Stats et historique] Coupe du podium : or (1er), argent (2e), bronze (3e). */
export function RankTrophy({
  rank,
  className,
}: {
  rank: 1 | 2 | 3;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <TrophyIcon
      className={cn("shrink-0 fill-current", PODIUM[rank], className)}
      role="img"
      aria-label={t(`ranking.podium${rank}`)}
    />
  );
}
