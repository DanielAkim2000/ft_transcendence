import { useTranslation } from "react-i18next";
import { useMeQuery } from "@/features/auth/authApi";
import { MatchHistoryList } from "@/features/matches/MatchHistoryList";
import { PageFallback } from "@/components/page-fallback";

/** [Minor · Stats et historique] Page d'historique : affiche la liste des matchs terminés de l'utilisateur (MatchHistoryList). */
export const History = () => {
  const { t } = useTranslation();
  const { data: me, isLoading } = useMeQuery();

  if (isLoading || !me) {
    return <PageFallback />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.history")}</h1>
      </header>
      <MatchHistoryList meId={me.id} />
    </div>
  );
};
