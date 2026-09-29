import {
  BellIcon,
  HistoryIcon,
  HomeIcon,
  LayoutGridIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  SwordsIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useLogoutMutation, useMeQuery } from "@/features/auth/authApi";
import { useListConversationsQuery } from "@/features/chat/chatApi";
import { useListPendingFriendsQuery } from "@/features/users/usersApi";
import { useGetMyQueueGroupQuery } from "@/features/queue/queueApi";
import { useCountMatchActionsQuery } from "@/features/matches/matchesApi";
import { useCountTournamentActionsQuery } from "@/features/tournaments/tournamentsApi";
import { useCountUnreadNotificationsQuery } from "@/features/notifications/notificationsApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Logo } from "@/components/logo";
import { ROUTES } from "@/constants/routes";

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useMeQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { data: conversations = [] } = useListConversationsQuery();
  const hasUnread = conversations.some((c) => c.unreadCount > 0);
  // Une seule demande suffit : seul le total compte pour la pastille.
  const { data: pendingFriends } = useListPendingFriendsQuery({ limit: 1 });
  const hasPendingFriends = (pendingFriends?.total ?? 0) > 0;
  const { data: myQueueGroup } = useGetMyQueueGroupQuery();
  const isMyTurn = myQueueGroup?.status === "CALLED";
  const hasPendingInvite =
    myQueueGroup?.status === "INVITING" &&
    myQueueGroup.players.some((player) => player.id === user?.id && !player.isRequester);
  const { data: matchActions } = useCountMatchActionsQuery();
  const hasMatchAction = (matchActions?.count ?? 0) > 0;
  const { data: tournamentActions } = useCountTournamentActionsQuery();
  const hasTournamentAction = (tournamentActions?.count ?? 0) > 0;
  const { data: unreadNotifications } = useCountUnreadNotificationsQuery();
  const hasUnreadNotifications = (unreadNotifications?.count ?? 0) > 0;

  // Trois groupes : jouer (accueil, tables, classement, tournois, historique),
  // social (amis, chat) et compte (profil, paramètres).
  const groups = [
    {
      label: t("nav.menu"),
      items: [
        { title: t("nav.home"), url: ROUTES.HOME, icon: HomeIcon },
        { title: t("nav.tables"), url: ROUTES.TABLES, icon: LayoutGridIcon },
        { title: t("nav.ranking"), url: ROUTES.RANKING, icon: TrophyIcon },
        { title: t("nav.tournaments"), url: ROUTES.TOURNAMENTS, icon: SwordsIcon },
        { title: t("nav.history"), url: ROUTES.HISTORY, icon: HistoryIcon },
      ],
    },
    {
      label: t("nav.groupSocial"),
      items: [
        { title: t("nav.friends"), url: ROUTES.FRIENDS, icon: UsersIcon },
        { title: t("nav.chat"), url: ROUTES.CHAT, icon: MessageSquareIcon },
      ],
    },
    {
      label: t("nav.groupAccount"),
      items: [
        { title: t("nav.profile"), url: ROUTES.PROFILE_ME, icon: UserIcon },
        {
          title: t("nav.notifications"),
          url: ROUTES.NOTIFICATIONS,
          icon: BellIcon,
        },
        { title: t("nav.settings"), url: ROUTES.SETTINGS, icon: SettingsIcon },
        // {
        //   title: t("nav.twoFactor"),
        //   url: ROUTES.SETTINGS_2FA,
        //   icon: ShieldCheckIcon,
        // },
      ],
    },
  ] as const;

  const dotLabel = (url: string): string | null => {
    if (url === ROUTES.CHAT && hasUnread) return t("chat.newMessages");
    if (url === ROUTES.FRIENDS && hasPendingFriends)
      return t("friends.newRequests");
    if (url === ROUTES.TABLES && isMyTurn) return t("queue.yourTurnBadge");
    if (url === ROUTES.TABLES && hasPendingInvite) return t("queue.inviteBadge");
    if (url === ROUTES.RANKING && hasMatchAction)
      return t("matches.actionNeededBadge");
    if (url === ROUTES.TOURNAMENTS && hasTournamentAction)
      return t("tournaments.actionNeededBadge");
    if (url === ROUTES.NOTIFICATIONS && hasUnreadNotifications)
      return t("notifications.unreadBadge");
    return null;
  };

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // session déjà invalide
    }
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to={ROUTES.PROFILE_ME} />}
            >
              <Avatar className="size-8 rounded-none">
                <AvatarImage
                  src={resolveAvatarUrl(user?.avatarUrl)}
                  alt={user?.displayname ?? t("common.brand")}
                  className="rounded-none"
                />
                <AvatarFallback className="rounded-none bg-sidebar-primary font-heading text-xs font-bold text-sidebar-primary-foreground">
                  {getInitials(user?.displayname)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <Logo className="truncate text-sm" />
                <span className="truncate text-xs text-muted-foreground">
                  {user?.displayname ?? "…"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="uppercase tracking-[0.2em]">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const label = dotLabel(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        render={<Link to={item.url} />}
                        isActive={location.pathname === item.url}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                        {label ? (
                          <span
                            className="ml-auto size-2 rounded-full bg-primary group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-1.5 group-data-[collapsible=icon]:right-1.5"
                            aria-label={label}
                          />
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ConfirmDialog
              title={t("confirm.logoutTitle")}
              description={t("confirm.logoutDescription")}
              confirmLabel={t("common.logout")}
              loading={isLoggingOut}
              onConfirm={handleLogout}
            >
              <SidebarMenuButton
                tooltip={t("common.logout")}
                disabled={isLoggingOut}
              >
                <LogOutIcon />
                <span>
                  {isLoggingOut ? t("common.loggingOut") : t("common.logout")}
                </span>
              </SidebarMenuButton>
            </ConfirmDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
