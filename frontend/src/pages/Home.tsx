import { useMeQuery } from "@/features/auth/authApi";
import { useTranslation } from "react-i18next";

export const Home = () => {
  const { t } = useTranslation();
  const { data: user, isLoading } = useMeQuery();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <h1 className="font-serif text-3xl tracking-tight">{t("home.title")}</h1>
      {isLoading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <p className="font-sans text-muted-foreground">
          {t("home.loggedInAs", { name: user?.displayname })}
        </p>
      )}
    </div>
  );
};
