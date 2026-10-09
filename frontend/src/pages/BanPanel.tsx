import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import {
  useAdminListUsersQuery,
  type AdminUser,
} from "@/features/admin/adminApi";
import { BanDialog } from "@/features/ban/BanDialog";
import { formatBanDate } from "@/features/ban/banHelpers";
import { useClampedPage } from "@/lib/use-clamped-page";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getInitials, resolveAvatarUrl } from "@/lib/user";

const PAGE_SIZE = 10;

/** Modération (admin) : recherche d'utilisateurs, état de leur ban et ouverture de la fenêtre de gestion (bannir, débannir, historique). */
export const BanPanel = () => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [bannedOnly, setBannedOnly] = useState(false);
  const [page, setPage] = useState(1);
  // La fenêtre charge elle-même le ban en cours : l'utilisateur sélectionné ne sert qu'à l'en-tête.
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim());
  const { data, isFetching } = useAdminListUsersQuery({
    q: debouncedQuery || undefined,
    banned: bannedOnly,
    page,
    limit: PAGE_SIZE,
  });
  useClampedPage(page, data?.totalPages, setPage);

  const users = data?.items ?? [];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("ban.title")}</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {t("ban.description")}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={t("ban.searchPlaceholder")}
          aria-label={t("ban.searchPlaceholder")}
        />
        <label className="flex w-fit cursor-pointer items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            checked={bannedOnly}
            onChange={(event) => {
              setBannedOnly(event.target.checked);
              setPage(1);
            }}
            className="size-4 accent-primary"
          />
          {t("ban.bannedOnly")}
        </label>
      </div>

      {users.length === 0 && !isFetching ? (
        <p className="font-sans text-sm text-muted-foreground">
          {bannedOnly && !debouncedQuery ? t("ban.noneBanned") : t("ban.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9 shrink-0 rounded-lg">
                  <AvatarImage
                    src={resolveAvatarUrl(user.avatarUrl)}
                    alt={user.displayname}
                    className="rounded-lg"
                  />
                  <AvatarFallback className="rounded-lg text-xs">
                    {getInitials(user.displayname)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-heading text-sm font-medium">
                    {user.displayname}
                    {user.role === "ADMIN" ? (
                      <span className="rounded border border-primary/50 px-1 text-[10px] uppercase tracking-widest text-primary">
                        {t("admin.users.role.ADMIN")}
                      </span>
                    ) : null}
                    {user.ban ? (
                      <span className="rounded border border-destructive/50 px-1 text-[10px] uppercase tracking-widest text-destructive">
                        {t("ban.banned")}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.ban
                      ? user.ban.endTime
                        ? t("ban.notice.until", {
                            date: formatBanDate(user.ban.endTime, i18n.language),
                          })
                        : t("ban.notice.permanent")
                      : user.email}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={user.ban ? "outline" : "default"}
                onClick={() => setSelected(user)}
              >
                {t("ban.manage")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        disabled={isFetching}
      />

      {selected ? (
        <BanDialog
          key={selected.id}
          user={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
};
