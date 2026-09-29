import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { ListSkeleton } from "@/components/skeletons";
import { useClampedPage } from "@/lib/use-clamped-page";
import { cn } from "@/lib/utils";
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  type AppNotification,
} from "@/features/notifications/notificationsApi";
import { renderNotification } from "@/features/notifications/notificationRender";

const NOTIFICATIONS_PAGE_SIZE = 10;

function NotificationRow({ notification }: { notification: AppNotification }) {
  const { t, i18n } = useTranslation();
  const { text, to, icon: Icon } = renderNotification(t, notification);
  const date = new Date(notification.createdAt).toLocaleString(i18n.language, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const content = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", !notification.read && "font-semibold")}>{text}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      {!notification.read ? (
        <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
      ) : null}
    </>
  );

  const className = cn(
    "flex items-center gap-3 border border-border px-3 py-2.5",
    !notification.read && "bg-primary/5",
  );

  return (
    <li>
      {to ? (
        <Link to={to} className={cn(className, "hover:border-primary/50")}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

export const Notifications = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListNotificationsQuery({
    page,
    limit: NOTIFICATIONS_PAGE_SIZE,
  });
  const [markAllRead, { isLoading: marking }] = useMarkAllNotificationsReadMutation();
  useClampedPage(page, data?.totalPages, setPage);
  const notifications = data?.items ?? [];
  const hasUnread = notifications.some((notification) => !notification.read);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.notifications")}</h1>
        {hasUnread ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={marking}
            onClick={() => void markAllRead()}
          >
            {t("notifications.markAllRead")}
          </Button>
        ) : null}
      </header>

      {isLoading ? (
        <ListSkeleton count={NOTIFICATIONS_PAGE_SIZE / 2} avatar={false} />
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
      <Pagination
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        disabled={isFetching}
      />
    </div>
  );
};
