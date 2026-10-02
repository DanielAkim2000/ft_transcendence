import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeQuery } from "@/features/auth/authApi";
import { useListConversationsQuery, type Conversation } from "@/features/chat/chatApi";
import { useListTablesQuery } from "@/features/tables/tablesApi";
import { formatElapsed, useNow } from "@/lib/elapsed";
import {
  useGetUserQuery,
  useListFriendsQuery,
  useListPendingFriendsQuery,
  useSearchUsersQuery,
} from "@/features/users/usersApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const SEARCH_RESULTS_LIMIT = 6;
/** Laisse le temps à un clic sur un résultat d'être enregistré avant que le flou ne referme la liste. */
const SEARCH_BLUR_DELAY_MS = 150;

function Panel({
  title,
  count,
  to,
  className,
  children,
}: {
  title: string;
  count?: number;
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn("flex flex-col border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
          {count !== undefined ? ` · ${count}` : ""}
        </h2>
        <Link to={to} className="text-xs text-primary hover:underline">
          {t("home.seeAll")} →
        </Link>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-auto px-4 py-6 text-sm text-muted-foreground">{children}</p>;
}

function RecentConversation({
  conversation,
  meId,
}: {
  conversation: Conversation;
  meId?: string;
}) {
  const peerId =
    conversation.userAId === meId ? conversation.userBId : conversation.userAId;
  const { data } = useGetUserQuery(peerId);
  const user = data?.user;
  const unread = conversation.unreadCount > 0;

  return (
    <li>
      <Link
        to={ROUTES.chatWith(peerId)}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent"
      >
        <Avatar>
          <AvatarImage src={resolveAvatarUrl(user?.avatarUrl)} alt={user?.displayname} />
          <AvatarFallback>{getInitials(user?.displayname)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>
            {user?.displayname ?? "…"}
          </p>
          <p
            className={cn(
              "truncate text-xs",
              unread ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {conversation.lastMessage?.content ?? ""}
          </p>
        </div>
        {unread ? (
          <span className="flex size-5 shrink-0 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground">
            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Barre de recherche de joueurs, à l'accueil : résultats en direct sous le champ, comme une invite de commande ("/"). */
function PlayerSearch() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const trimmed = query.trim();
  const { data, isFetching } = useSearchUsersQuery(
    { q: trimmed, limit: SEARCH_RESULTS_LIMIT },
    { skip: trimmed.length === 0 },
  );
  const open = focused && trimmed.length > 0;
  const results = data?.items ?? [];

  return (
    <div className="relative w-full max-w-md">
      <div className="flex h-9 items-center gap-2 border border-border bg-card px-3 transition-colors focus-within:border-primary/60">
        <span aria-hidden className="font-mono text-xs text-primary">
          /
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), SEARCH_BLUR_DELAY_MS)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
          placeholder={t("home.searchPlaceholder")}
          aria-label={t("home.searchLabel")}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open ? (
        <div className="absolute z-20 mt-1 w-full border border-border bg-card shadow-lg">
          {isFetching ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-3 p-3">
              <span className="sr-only">{t("common.loading")}</span>
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {t("home.searchNoResults")}
            </p>
          ) : (
            <ul className="flex flex-col p-1">
              {results.map((user) => (
                <li key={user.id}>
                  <Link
                    to={ROUTES.profile(user.id)}
                    className="flex items-center gap-3 px-2 py-2 hover:bg-accent"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={resolveAvatarUrl(user.avatarUrl)} alt={user.displayname} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.displayname)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {user.displayname}
                    </span>
                    {user.friendshipStatus === "friends" ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-primary">
                        {t("friends.already")}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const Home = () => {
  const { t, i18n } = useTranslation();
  const { data: me } = useMeQuery();
  // Seuls 5 amis en ligne sont affichés ; le total sert aux compteurs.
  const { data: onlineData } = useListFriendsQuery({ online: true, limit: 5 });
  const { data: pendingData } = useListPendingFriendsQuery({ limit: 1 });
  const { data: conversations = [] } = useListConversationsQuery();
  const { data: tables = [] } = useListTablesQuery();
  const now = useNow(tables.some((table) => table.status === "BUSY"));

  const onlineFriends = onlineData?.items ?? [];
  const onlineCount = onlineData?.total ?? 0;
  const pendingCount = pendingData?.total ?? 0;
  const recent = conversations.filter((c) => c.lastMessage).slice(0, 5);
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const today = new Date().toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("home.greeting", { name: me?.displayname ?? "…" })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {today} · {t("home.onlineCount", { count: onlineCount })}
        </p>
      </header>

      <PlayerSearch />

      {pendingCount > 0 ? (
        <div className="flex items-center justify-between gap-3 border border-primary/60 bg-primary/10 px-4 py-3">
          <p className="text-sm">
            <span className="mr-2 text-primary">▲</span>
            {t("home.pendingRequests", { count: pendingCount })}
          </p>
          <Button size="sm" render={<Link to={ROUTES.FRIENDS} />}>
            {t("home.review")}
          </Button>
        </div>
      ) : null}

      <Panel title={t("tables.title")} to={ROUTES.TABLES}>
        <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {tables.map((table) => {
            const tie = table.currentTournamentTie;
            const busy = table.status === "BUSY" || tie !== null;
            return (
              <li key={table.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-bold uppercase tracking-wider">{table.name}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.2em]",
                    busy ? "text-chart-3" : "text-primary",
                  )}
                >
                  {tie
                    ? t("tables.tournamentBusy", { name: tie.tournamentName })
                    : busy
                      ? `${t("tables.busy")} ${formatElapsed(table.occupiedAt, now)}`
                      : t("tables.free")}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("friends.onlineTitle")} count={onlineCount} to={ROUTES.FRIENDS} className="min-h-48">
          {onlineFriends.length === 0 ? (
            <Empty>{t("home.noOnline")}</Empty>
          ) : (
            <ul>
              {onlineFriends.map((friend) => (
                <li key={friend.id}>
                  <Link
                    to={ROUTES.chatWith(friend.id)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent"
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarImage
                          src={resolveAvatarUrl(friend.avatarUrl)}
                          alt={friend.displayname}
                        />
                        <AvatarFallback>{getInitials(friend.displayname)}</AvatarFallback>
                      </Avatar>
                      <span
                        className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                        aria-hidden
                      />
                    </div>
                    <span className="flex-1 truncate text-sm font-medium">
                      {friend.displayname}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t("friends.message")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("home.recentMessages")} count={unreadTotal} to={ROUTES.CHAT} className="min-h-48">
          {recent.length === 0 ? (
            <Empty>{t("chat.noConversations")}</Empty>
          ) : (
            <ul>
              {recent.map((conversation) => (
                <RecentConversation
                  key={conversation.id}
                  conversation={conversation}
                  meId={me?.id}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};
