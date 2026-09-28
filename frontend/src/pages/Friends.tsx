import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
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
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import type { User } from "@/features/auth/authApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { getErrorMessage } from "@/lib/get-error-message";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ROUTES } from "@/constants/routes";
import { ListSkeleton } from "@/components/skeletons";

function UserRow({
  user,
  actions,
  showPresence = false,
}: {
  user: User;
  actions: ReactNode;
  showPresence?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <Link
        to={ROUTES.profile(user.id)}
        className="flex min-w-0 items-center gap-3"
      >
        <div className="relative shrink-0">
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
          {showPresence ? (
            <span
              className={`absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background ${
                user.isOnline ? "bg-primary" : "bg-muted-foreground"
              }`}
              aria-hidden
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-medium">
            {user.displayname}
          </p>
          {showPresence ? (
            <p
              className={`truncate text-xs font-medium ${
                user.isOnline ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {user.isOnline ? t("profile.online") : t("profile.offline")}
            </p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </li>
  );
}

const FRIENDS_PAGE_SIZE = 10;
const PENDING_PAGE_SIZE = 5;
const SEARCH_PAGE_SIZE = 10;

export const Friends = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [friendsPage, setFriendsPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const {
    data: friends,
    isLoading: friendsLoading,
    isFetching: friendsFetching,
  } = useListFriendsQuery({ page: friendsPage, limit: FRIENDS_PAGE_SIZE });
  const {
    data: pending,
    isLoading: pendingLoading,
    isFetching: pendingFetching,
  } = useListPendingFriendsQuery({ page: pendingPage, limit: PENDING_PAGE_SIZE });
  const { data: results, isFetching: searchLoading } = useSearchUsersQuery({
    q: query.trim() || undefined,
    page: searchPage,
    limit: SEARCH_PAGE_SIZE,
  });
  useClampedPage(friendsPage, friends?.totalPages, setFriendsPage);
  useClampedPage(pendingPage, pending?.totalPages, setPendingPage);
  useClampedPage(searchPage, results?.totalPages, setSearchPage);
  const [sendRequest] = useSendFriendRequestMutation();
  const [acceptRequest] = useAcceptFriendRequestMutation();
  const [removeFriend] = useRemoveFriendMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [justSentIds, setJustSentIds] = useState<Set<string>>(new Set());

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (error) {
      setActionError(getErrorMessage(error, t("friends.actionFailed")));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
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
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("friends.pendingTitle")} · {pending?.total ?? 0}
        </h2>
        {pendingLoading ? (
          <ListSkeleton count={2} action />
        ) : (pending?.total ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("friends.noPending")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending?.items.map((user) => (
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
                    <ConfirmDialog
                      title={t("confirm.declineTitle")}
                      description={t("confirm.declineDescription", {
                        name: user.displayname,
                      })}
                      confirmLabel={t("friends.decline")}
                      onConfirm={() =>
                        run(() => removeFriend(user.id).unwrap())
                      }
                    >
                      <Button size="sm" variant="outline">
                        {t("friends.decline")}
                      </Button>
                    </ConfirmDialog>
                  </>
                }
              />
            ))}
          </ul>
        )}
        <Pagination
          page={pending?.page ?? pendingPage}
          totalPages={pending?.totalPages ?? 1}
          onPageChange={setPendingPage}
          disabled={pendingFetching}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("friends.listTitle")} · {friends?.total ?? 0}
        </h2>
        {friendsLoading ? (
          <ListSkeleton count={FRIENDS_PAGE_SIZE / 2} action />
        ) : (friends?.total ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("friends.noFriends")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends?.items.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                showPresence
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={() => navigate(ROUTES.chatWith(user.id))}
                    >
                      {t("friends.message")}
                    </Button>
                    <ConfirmDialog
                      title={t("confirm.removeFriendTitle")}
                      description={t("confirm.removeFriendDescription", {
                        name: user.displayname,
                      })}
                      confirmLabel={t("friends.remove")}
                      onConfirm={() =>
                        run(() => removeFriend(user.id).unwrap())
                      }
                    >
                      <Button size="sm" variant="outline">
                        {t("friends.remove")}
                      </Button>
                    </ConfirmDialog>
                  </>
                }
              />
            ))}
          </ul>
        )}
        <Pagination
          page={friends?.page ?? friendsPage}
          totalPages={friends?.totalPages ?? 1}
          onPageChange={setFriendsPage}
          disabled={friendsFetching}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("friends.searchTitle")}
        </h2>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchPage(1);
          }}
          placeholder={t("friends.searchPlaceholder")}
        />
        {searchLoading && !results ? (
          <ListSkeleton count={SEARCH_PAGE_SIZE / 2} action />
        ) : (
          <ul className="flex flex-col gap-2">
            {results?.items.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                showPresence={user.friendshipStatus === "friends"}
                actions={
                  user.friendshipStatus === "friends" ? (
                    <span className="text-xs text-muted-foreground">
                      {t("friends.already")}
                    </span>
                  ) : user.friendshipStatus === "pending_in" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          run(() => acceptRequest(user.id).unwrap())
                        }
                      >
                        {t("friends.accept")}
                      </Button>
                      <ConfirmDialog
                        title={t("confirm.declineTitle")}
                        description={t("confirm.declineDescription", {
                          name: user.displayname,
                        })}
                        confirmLabel={t("friends.decline")}
                        onConfirm={() =>
                          run(() => removeFriend(user.id).unwrap())
                        }
                      >
                        <Button size="sm" variant="outline">
                          {t("friends.decline")}
                        </Button>
                      </ConfirmDialog>
                    </>
                  ) : user.friendshipStatus === "pending_out" ||
                    justSentIds.has(user.id) ? (
                    <Button size="sm" variant="outline" disabled>
                      {justSentIds.has(user.id)
                        ? t("friends.inviteSent")
                        : t("friends.inviteAlreadySent")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        run(async () => {
                          await sendRequest(user.id).unwrap();
                          setJustSentIds((prev) => new Set(prev).add(user.id));
                          toast.add({
                            title: t("friends.inviteSentToast"),
                            type: "success",
                          });
                        })
                      }
                    >
                      {t("friends.add")}
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        )}
        <Pagination
          page={results?.page ?? searchPage}
          totalPages={results?.totalPages ?? 1}
          onPageChange={setSearchPage}
          disabled={searchLoading}
        />
      </section>
    </div>
  );
};
