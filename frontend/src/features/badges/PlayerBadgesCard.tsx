import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetBadgesQuery } from "./badgesApi";
import { BADGE_CATALOG } from "./badgeCatalog";
import { cn } from "@/lib/utils";
import { RankTrophy } from "@/features/users/RankTrophy";
import { isPodium } from "@/features/users/podium";
import { CardSkeleton } from "@/components/skeletons";

export function PlayerBadgesCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useGetBadgesQuery(userId);

  if (isLoading) {
    return <CardSkeleton lines={4} />;
  }

  if (!profile) {
    return null;
  }

  const earnedCodes = new Set(profile.badges.map((badge) => badge.code));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2">
          <span>{t("badges.title")}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {t("badges.level", { level: profile.level })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {profile.rank !== null ? (
          <div
            className={cn(
              "flex items-center gap-4 border p-3",
              isPodium(profile.rank, profile.matchesPlayed)
                ? "border-primary/60 bg-primary/5"
                : "border-border",
            )}
          >
            {isPodium(profile.rank, profile.matchesPlayed) ? (
              <RankTrophy rank={profile.rank} className="size-10" />
            ) : null}
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none">
                {t("ranking.rank", { rank: profile.rank })}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("ranking.outOf", { total: profile.totalPlayers })}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isPodium(profile.rank, profile.matchesPlayed)
                  ? t(`ranking.podiumTitle${profile.rank}`)
                  : t("ranking.rating", { rating: profile.rating })}
              </p>
            </div>
            {isPodium(profile.rank, profile.matchesPlayed) ? (
              <span className="ml-auto font-mono text-sm font-bold">
                {profile.rating}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(profile.xpIntoLevel / profile.xpPerLevel) * 100}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("badges.xpProgress", {
              xp: profile.xpIntoLevel,
              total: profile.xpPerLevel,
            })}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="flex flex-col gap-0.5 border border-border p-2">
            <span className="text-lg font-bold">{profile.wins}</span>
            <span className="text-muted-foreground uppercase tracking-wider">
              {t("badges.wins")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 border border-border p-2">
            <span className="text-lg font-bold">{profile.matchesPlayed}</span>
            <span className="text-muted-foreground uppercase tracking-wider">
              {t("badges.matchesPlayed")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 border border-border p-2">
            <span className="text-lg font-bold">{profile.bestWinStreak}</span>
            <span className="text-muted-foreground uppercase tracking-wider">
              {t("badges.bestStreak")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {BADGE_CATALOG.map(({ code, icon: Icon }) => {
            const earned = earnedCodes.has(code);
            return (
              <div
                key={code}
                title={t(`badges.catalog.${code}.description`)}
                className={cn(
                  "flex flex-col items-center gap-1 border p-2 text-center",
                  earned
                    ? "border-primary/50 bg-primary/5"
                    : "border-border opacity-40",
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "size-6",
                      earned ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {!earned ? (
                    <LockIcon className="absolute -right-1 -bottom-1 size-3 text-muted-foreground" />
                  ) : null}
                </div>
                <span className="text-[10px] uppercase tracking-wide">
                  {t(`badges.catalog.${code}.name`)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
