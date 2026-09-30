import { useState, type ReactNode, useMemo } from "react";
import { Link, Route, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useSearchUsersQuery,
} from "@/features/users/usersApi";
import { useMeQuery, type User } from "@/features/auth/authApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { getErrorMessage } from "@/lib/get-error-message";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ROUTES } from "@/constants/routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Home } from "@/pages/Home"

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
              className={`absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background ${user.isOnline ? "bg-emerald-500" : "bg-zinc-400"
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
              className={`truncate text-xs font-medium ${user.isOnline ? "text-emerald-600" : "text-muted-foreground"
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

function BanPopUp({setHide} : {setHide: () => void}) {
  return (
    <>
      <div className="fixed z-50 top-0 left-0 backdrop-blur-xs size-full" onClick={setHide}>
      </div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-60 flex w-full max-w-xl flex-col gap-6">
        <Card className="[--card-spacing:--spacing(0)]">
          <CardContent>
            <Card>
              <CardHeader className="flex flex-row items-center">
                <CardTitle>
                  Ban History
                </CardTitle>
              </CardHeader>
              <CardContent>
                blabla
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center">
                <CardTitle>
                  Select Ban duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                blabla
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const SEARCH_PAGE_SIZE = 10;

export const AdminPanel = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const { data: results, isFetching: searchLoading } = useSearchUsersQuery({
    q: query.trim() || undefined,
    page: searchPage,
    limit: SEARCH_PAGE_SIZE,
  });
  const { data: meInfo } = useMeQuery();
  const [banPopUp, setBanPopUp] = useState(false);
  const navigate = useNavigate();

  if (meInfo?.role !== "ADMIN") {
    navigate("/", { replace: true });
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <CardTitle className="font-serif text-2xl">
              List Users:
            </CardTitle>
          </CardHeader>
          <CardContent className="font-sans text-sm text-muted-foreground">
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
                  {results?.items.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      actions={
                        <>
                          <Button
                            size="sm"
                            onClick={() => setBanPopUp(true)}
                          >
                            View
                          </Button>
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
      {banPopUp && <BanPopUp setHide={() => setBanPopUp(false)} />}
    </>
  );
};
