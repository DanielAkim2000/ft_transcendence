import {
  HomeIcon,
  LayoutGridIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShieldCheckIcon,
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
import { useGetMyQueueEntryQuery } from "@/features/queue/queueApi";
import { useListMatchesQuery } from "@/features/matches/matchesApi";
import { needsMyAction } from "@/features/matches/matchHelpers";
import { useListTournamentsQuery } from "@/features/tournaments/tournamentsApi";
import { hasActiveTournamentAction } from "@/features/tournaments/tournamentHelpers";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ROUTES } from "@/constants/routes";

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useMeQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { data: conversations = [] } = useListConversationsQuery();
  const hasUnread = conversations.some((c) => c.unreadCount > 0);
  const { data: pendingFriends = [] } = useListPendingFriendsQuery();
  const hasPendingFriends = pendingFriends.length > 0;
  const { data: myQueueEntry } = useGetMyQueueEntryQuery();
  const isMyTurn = myQueueEntry?.status === "CALLED";
  const { data: matches = [] } = useListMatchesQuery();
  const hasMatchAction = user
    ? matches.some((match) => needsMyAction(match, user.id))
    : false;
  const { data: tournaments = [] } = useListTournamentsQuery();
  const hasTournamentAction = user
    ? hasActiveTournamentAction(tournaments, user.id)
    : false;

  const items = [
    {
      title: t("nav.home"),
      url: ROUTES.HOME,
      icon: HomeIcon,
    },
    {
      title: t("nav.tables"),
      url: ROUTES.TABLES,
      icon: LayoutGridIcon,
    },
    {
      title: t("nav.ranking"),
      url: ROUTES.RANKING,
      icon: TrophyIcon,
    },
    {
      title: t("nav.tournaments"),
      url: ROUTES.TOURNAMENTS,
      icon: SwordsIcon,
    },
    {
      title: t("nav.profile"),
      url: ROUTES.PROFILE_ME,
      icon: UserIcon,
    },
    {
      title: t("nav.friends"),
      url: ROUTES.FRIENDS,
      icon: UsersIcon,
    },
    {
      title: t("nav.chat"),
      url: ROUTES.CHAT,
      icon: MessageSquareIcon,
    },
    {
      title: t("nav.settings"),
      url: ROUTES.SETTINGS,
      icon: SettingsIcon,
    },
    // {
    //   title: t("nav.twoFactor"),
    //   url: ROUTES.SETTINGS_2FA,
    //   icon: ShieldCheckIcon,
    // },
  ] as const;

  const dotLabel = (url: string): string | null => {
    if (url === ROUTES.CHAT && hasUnread) return t("chat.newMessages");
    if (url === ROUTES.FRIENDS && hasPendingFriends)
      return t("friends.newRequests");
    if (url === ROUTES.TABLES && isMyTurn) return t("queue.yourTurnBadge");
    if (url === ROUTES.RANKING && hasMatchAction)
      return t("matches.actionNeededBadge");
    if (url === ROUTES.TOURNAMENTS && hasTournamentAction)
      return t("tournaments.actionNeededBadge");
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
                <span className="truncate font-heading font-bold uppercase tracking-wider text-sidebar-primary">
                  {">_ "}
                  {t("common.brand")}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.displayname ?? "…"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-[0.2em]">
            {t("nav.menu")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
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
