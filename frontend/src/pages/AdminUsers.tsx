import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { toast } from "@/components/ui/toast";
import {
  useAdminDeleteUserMutation,
  useAdminListUsersQuery,
  type AdminUser,
} from "@/features/admin/adminApi";
import { UserFormDialog } from "@/features/admin/UserFormDialog";
import { useMeQuery } from "@/features/auth/authApi";
import { ROUTES } from "@/constants/routes";
import { getErrorMessage } from "@/lib/get-error-message";
import { useClampedPage } from "@/lib/use-clamped-page";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getInitials, resolveAvatarUrl } from "@/lib/user";

const PAGE_SIZE = 10;

/** Gestion des comptes par un administrateur : recherche, création, modification et suppression. */
export const AdminUsers = () => {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // "new" = formulaire de création ; un utilisateur = formulaire de modification.
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim());
  const { data, isFetching } = useAdminListUsersQuery({
    q: debouncedQuery || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const [deleteUser] = useAdminDeleteUserMutation();
  useClampedPage(page, data?.totalPages, setPage);

  const handleDelete = async (user: AdminUser) => {
    try {
      await deleteUser(user.id).unwrap();
      toast.add({ title: t("admin.users.deletedToast"), type: "success" });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("admin.users.deleteFailed")),
        type: "error",
      });
    }
  };

  const users = data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("admin.users.title")}
          </h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {t("admin.users.description")}
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("admin.users.create")}
        </Button>
      </header>

      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(1);
        }}
        placeholder={t("admin.users.searchPlaceholder")}
        aria-label={t("admin.users.searchPlaceholder")}
      />

      {users.length === 0 && !isFetching ? (
        <p className="font-sans text-sm text-muted-foreground">
          {t("admin.users.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <Link
                to={ROUTES.profile(user.id)}
                className="flex min-w-0 items-center gap-3"
              >
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
                    {user.twoFactorEnabled ? (
                      <span className="rounded border border-border px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        2FA
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                    {user.login42 ? ` · 42: ${user.login42}` : ""}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(user)}
                >
                  {t("admin.users.edit")}
                </Button>
                {user.id === me?.id ? null : (
                  <ConfirmDialog
                    title={t("admin.users.deleteTitle", {
                      name: user.displayname,
                    })}
                    description={t("admin.users.deleteDescription")}
                    confirmLabel={t("admin.users.delete")}
                    onConfirm={() => handleDelete(user)}
                  >
                    <Button type="button" size="sm" variant="destructive">
                      {t("admin.users.delete")}
                    </Button>
                  </ConfirmDialog>
                )}
              </div>
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

      {editing !== null ? (
        <UserFormDialog
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? undefined : editing}
          isSelf={editing !== "new" && editing.id === me?.id}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
};
