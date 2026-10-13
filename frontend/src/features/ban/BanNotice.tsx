import { useTranslation } from "react-i18next";
import { formatBanDate } from "./banHelpers";

type Props = {
  reason: string | null;
  /** Date de fin ISO ; absente = ban permanent. */
  until: string | null;
};

/** [Major · Permissions avancées] Bandeau (page de connexion) qui explique à un utilisateur banni pourquoi il ne peut pas se connecter et jusqu'à quand. */
export function BanNotice({ reason, until }: Props) {
  const { t, i18n } = useTranslation();
  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-1 border border-destructive/50 bg-destructive/10 p-3 font-sans text-sm"
    >
      <p className="font-semibold text-destructive">{t("ban.notice.title")}</p>
      {reason ? (
        <p>
          <span className="text-muted-foreground">{t("ban.notice.reason")} </span>
          {reason}
        </p>
      ) : null}
      <p>
        {until
          ? t("ban.notice.until", { date: formatBanDate(until, i18n.language) })
          : t("ban.notice.permanent")}
      </p>
    </div>
  );
}
