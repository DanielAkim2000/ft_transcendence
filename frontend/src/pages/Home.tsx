import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/features/auth/authApi";
import { useListConversationsQuery, type Conversation } from "@/features/chat/chatApi";
import { useListTablesQuery } from "@/features/tables/tablesApi";
import { formatElapsed, useNow } from "@/lib/elapsed";
import {
  useGetUserQuery,
  useListFriendsQuery,
  useListPendingFriendsQuery,
} from "@/features/users/usersApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

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

export const Home = () => {
  const { t, i18n } = useTranslation();
  const { data: me } = useMeQuery();
  const { data: friends = [] } = useListFriendsQuery();
  const { data: pending = [] } = useListPendingFriendsQuery();
  const { data: conversations = [] } = useListConversationsQuery();
  const { data: tables = [] } = useListTablesQuery();
  const now = useNow(tables.some((table) => table.status === "BUSY"));

  const onlineFriends = friends.filter((friend) => friend.isOnline);
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
          {today} · {t("home.onlineCount", { count: onlineFriends.length })}
        </p>
      </header>

      {pending.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border border-primary/60 bg-primary/10 px-4 py-3">
          <p className="text-sm">
            <span className="mr-2 text-primary">▲</span>
            {t("home.pendingRequests", { count: pending.length })}
          </p>
          <Button size="sm" render={<Link to={ROUTES.FRIENDS} />}>
            {t("home.review")}
          </Button>
        </div>
      ) : null}

      <Panel title={t("tables.title")} to={ROUTES.TABLES}>
        <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {tables.map((table) => {
            const busy = table.status === "BUSY";
            return (
              <li key={table.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-bold uppercase tracking-wider">{table.name}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.2em]",
                    busy ? "text-chart-3" : "text-primary",
                  )}
                >
                  {busy
                    ? `${t("tables.busy")} ${formatElapsed(table.occupiedAt, now)}`
                    : t("tables.free")}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("friends.onlineTitle")} count={onlineFriends.length} to={ROUTES.FRIENDS} className="min-h-48">
          {onlineFriends.length === 0 ? (
            <Empty>{t("home.noOnline")}</Empty>
          ) : (
            <ul>
              {onlineFriends.slice(0, 5).map((friend) => (
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
