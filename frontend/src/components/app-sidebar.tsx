import { HomeIcon, ShieldCheckIcon, LogOutIcon, SettingsIcon, UserIcon, UsersIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useMeQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const items = [
    {
      title: t("nav.home"),
      url: "/",
      icon: HomeIcon,
    },
    {
      title: t("nav.profile"),
      url: "/profile/me",
      icon: UserIcon,
    },
    {
      title: t("nav.friends"),
      url: "/friends",
      icon: UsersIcon,
    },
    {
      title: t("nav.settings"),
      url: "/settings",
      icon: SettingsIcon,
    },
    {
      title: t("nav.twoFactor"),
      url: "/settings/2fa",
      icon: ShieldCheckIcon,
    },
  ] as const;

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // session déjà invalide
    }
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/profile/me" />}>
              <Avatar className="size-8 rounded-lg">
                <AvatarImage
                  src={resolveAvatarUrl(user?.avatarUrl)}
                  alt={user?.displayname ?? t("common.brand")}
                  className="rounded-lg"
                />
                <AvatarFallback className="rounded-lg bg-sidebar-primary font-heading text-xs font-bold text-sidebar-primary-foreground">
                  {getInitials(user?.displayname)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading font-semibold">
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
          <SidebarGroupLabel>{t("nav.menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    render={<Link to={item.url} />}
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
