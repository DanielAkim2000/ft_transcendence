import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useAcceptFriendRequestMutation,
  useListFriendsQuery,
  useListPendingFriendsQuery,
  useRemoveFriendMutation,
  useSearchUsersQuery,
  useSendFriendRequestMutation,
} from "@/features/users/usersApi";
import type { User } from "@/features/auth/authApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { getErrorMessage } from "@/lib/get-error-message";

function UserRow({
  user,
  actions,
}: {
  user: User;
  actions: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <Link to={`/profile/${user.id}`} className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9 rounded-lg">
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
          <p className="truncate font-heading text-sm font-medium">
            {user.displayname}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user.isOnline ? "●" : "○"} {user.email}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </li>
  );
}

export const Friends = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: friends = [], isLoading: friendsLoading } = useListFriendsQuery();
  const { data: pending = [], isLoading: pendingLoading } =
    useListPendingFriendsQuery();
  const { data: results = [], isFetching: searchLoading } = useSearchUsersQuery(
    query.trim() || undefined,
  );
  const [sendRequest] = useSendFriendRequestMutation();
  const [acceptRequest] = useAcceptFriendRequestMutation();
  const [removeFriend] = useRemoveFriendMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (error) {
      setActionError(getErrorMessage(error, t("friends.actionFailed")));
    }
  };

  const friendIds = new Set(friends.map((u) => u.id));
  const pendingIds = new Set(pending.map((u) => u.id));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">
          {t("friends.title")}
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {t("friends.description")}
        </p>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {t("friends.pendingTitle")}
        </h2>
        {pendingLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("friends.noPending")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={() => run(() => acceptRequest(user.id).unwrap())}
                    >
                      {t("friends.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => removeFriend(user.id).unwrap())}
                    >
                      {t("friends.decline")}
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {t("friends.listTitle")}
        </h2>
        {friendsLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("friends.noFriends")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => removeFriend(user.id).unwrap())}
                  >
                    {t("friends.remove")}
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {t("friends.searchTitle")}
        </h2>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("friends.searchPlaceholder")}
        />
        {searchLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                actions={
                  friendIds.has(user.id) ? (
                    <span className="text-xs text-muted-foreground">
                      {t("friends.already")}
                    </span>
                  ) : pendingIds.has(user.id) ? (
                    <Button
                      size="sm"
                      onClick={() => run(() => acceptRequest(user.id).unwrap())}
                    >
                      {t("friends.accept")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => run(() => sendRequest(user.id).unwrap())}
                    >
                      {t("friends.add")}
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
