import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import type { AdminUser } from "@/features/admin/adminApi";
import {
  useBanUserMutation,
  useGetActiveBanQuery,
  useGetBanHistoryQuery,
  useUnbanUserMutation,
  type Ban,
} from "@/features/ban/banApi";
import {
  BAN_DURATIONS,
  MAX_BAN_HOURS,
  MAX_REASON_LENGTH,
  formatBanDate,
  isBanActive,
} from "@/features/ban/banHelpers";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";
type DurationChoice = (typeof BAN_DURATIONS)[number]["id"] | typeof CUSTOM;

/** [Major · Permissions avancées] Texte de durée d'un ban terminé ou en cours (« jusqu'au … » ou « permanent »). */
function BanPeriod({ ban }: { ban: Ban }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {formatBanDate(ban.startTime, i18n.language)}
      {" → "}
      {ban.endTime
        ? formatBanDate(ban.endTime, i18n.language)
        : t("ban.permanent")}
    </>
  );
}

/** [Major · Permissions avancées] Formulaire de bannissement : durée (préréglée ou personnalisée) et motif obligatoire. */
function BanForm({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const [banUser, { isLoading }] = useBanUserMutation();
  const [choice, setChoice] = useState<DurationChoice>("24h");
  const [customHours, setCustomHours] = useState("");
  const [reason, setReason] = useState("");

  const preset = BAN_DURATIONS.find((duration) => duration.id === choice);
  const custom = Number(customHours);
  const customValid =
    Number.isInteger(custom) && custom >= 1 && custom <= MAX_BAN_HOURS;
  const hours = preset ? preset.hours : custom;
  // Une durée vide ne doit jamais devenir un ban permanent par accident : « 0 » n'est possible que via le choix explicite.
  const durationValid = preset ? true : customValid;
  const trimmedReason = reason.trim();
  const canSubmit = durationValid && trimmedReason.length > 0 && !isLoading;

  const durationLabel =
    hours === 0
      ? t("ban.permanent")
      : t("ban.form.hoursSummary", { count: hours });

  /** [Major · Permissions avancées] Envoie le ban (durée en heures + motif) et confirme par un toast. */
  const handleBan = async () => {
    try {
      await banUser({
        userId: user.id,
        durationHours: hours,
        reason: trimmedReason,
      }).unwrap();
      toast.add({
        title: t("ban.bannedToast", { name: user.displayname }),
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("ban.banFailed")),
        type: "error",
      });
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("ban.form.title")}
      </h3>

      <div className="flex flex-col gap-1.5">
        <Label>{t("ban.form.duration")}</Label>
        <div className="flex flex-wrap gap-2">
          {[...BAN_DURATIONS.map((duration) => duration.id), CUSTOM].map(
            (id) => (
              <button
                key={id}
                type="button"
                aria-pressed={choice === id}
                onClick={() => setChoice(id as DurationChoice)}
                className={cn(
                  "border px-2.5 py-1 text-sm transition-colors",
                  choice === id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {t(`ban.duration.${id}`)}
              </button>
            ),
          )}
        </div>
        {choice === CUSTOM ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={MAX_BAN_HOURS}
              value={customHours}
              onChange={(event) => setCustomHours(event.target.value)}
              className="w-28"
              aria-label={t("ban.form.customHours")}
              aria-invalid={customHours !== "" && !customValid}
            />
            <span className="text-sm text-muted-foreground">
              {t("ban.form.hoursUnit")}
            </span>
          </div>
        ) : null}
        {choice === CUSTOM && customHours !== "" && !customValid ? (
          <p className="text-xs text-destructive">
            {t("ban.form.customInvalid", { max: MAX_BAN_HOURS })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ban-reason">{t("ban.form.reason")}</Label>
        <Input
          id="ban-reason"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("ban.form.reasonPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">
          {t("ban.form.reasonHint")}
        </p>
      </div>

      <div>
        <ConfirmDialog
          title={t("ban.form.confirmTitle", { name: user.displayname })}
          description={t("ban.form.confirmDescription", {
            duration: durationLabel,
          })}
          confirmLabel={t("ban.form.submit")}
          onConfirm={handleBan}
        >
          <Button type="button" variant="destructive" disabled={!canSubmit}>
            {t("ban.form.submit")}
          </Button>
        </ConfirmDialog>
      </div>
    </section>
  );
}

type Props = {
  user: AdminUser;
  onClose: () => void;
};

/** [Major · Permissions avancées] Fenêtre de modération d'un utilisateur : état du ban, formulaire de ban (durées prédéfinies + motif), levée du ban et historique. */
export function BanDialog({ user, onClose }: Props) {
  const { t } = useTranslation();
  const { data: active } = useGetActiveBanQuery(user.id);
  const { data: history, isLoading: loadingHistory } = useGetBanHistoryQuery(
    user.id,
  );
  const [unbanUser] = useUnbanUserMutation();
  const activeBan = active?.ban ?? null;
  const isAdmin = user.role === "ADMIN";

  /** [Major · Permissions avancées] Lève le ban d'un utilisateur et confirme par un toast. */
  const handleUnban = async () => {
    try {
      await unbanUser(user.id).unwrap();
      toast.add({
        title: t("ban.unbannedToast", { name: user.displayname }),
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("ban.unbanFailed")),
        type: "error",
      });
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <header className="flex items-center gap-3">
            <Avatar className="size-12 shrink-0 rounded-lg">
              <AvatarImage
                src={resolveAvatarUrl(user.avatarUrl)}
                alt={user.displayname}
                className="rounded-lg"
              />
              <AvatarFallback className="rounded-lg">
                {getInitials(user.displayname)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <Dialog.Title className="truncate font-heading text-lg font-semibold">
                {user.displayname}
              </Dialog.Title>
              <Dialog.Description className="truncate font-sans text-sm text-muted-foreground">
                {user.email}
                {user.login42 ? ` · 42: ${user.login42}` : ""}
              </Dialog.Description>
            </div>
          </header>

          {isAdmin ? (
            <p className="border border-border p-3 font-sans text-sm text-muted-foreground">
              {t("ban.adminProtected")}
            </p>
          ) : activeBan ? (
            <section className="flex flex-col gap-2 border border-destructive/50 bg-destructive/10 p-3 font-sans text-sm">
              <p className="font-semibold text-destructive">
                {t("ban.currentlyBanned")}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("ban.notice.reason")}{" "}
                </span>
                {activeBan.reason}
              </p>
              <p className="text-muted-foreground">
                <BanPeriod ban={activeBan} />
              </p>
              <div>
                <ConfirmDialog
                  title={t("ban.unbanTitle", { name: user.displayname })}
                  description={t("ban.unbanDescription")}
                  confirmLabel={t("ban.unban")}
                  variant="default"
                  onConfirm={handleUnban}
                >
                  <Button type="button" variant="outline">
                    {t("ban.unban")}
                  </Button>
                </ConfirmDialog>
              </div>
            </section>
          ) : (
            <BanForm user={user} />
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("ban.history.title")}
              {history && history.length > 0 ? ` · ${history.length}` : ""}
            </h3>
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !history || history.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                {t("ban.history.none")}
              </p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {history.map((ban) => (
                  <li
                    key={ban.id}
                    className="flex flex-col gap-0.5 border border-border px-3 py-2 font-sans text-sm"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{ban.reason}</span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] uppercase tracking-widest",
                          isBanActive(ban)
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {isBanActive(ban)
                          ? t("ban.history.active")
                          : t("ban.history.ended")}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <BanPeriod ban={ban} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex justify-end">
            <Dialog.Close render={<Button type="button" variant="outline" />}>
              {t("common.close")}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
