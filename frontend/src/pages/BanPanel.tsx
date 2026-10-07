import { useState, type ReactNode, useMemo } from "react";
import { Link, Route, Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    useGetUserQuery,
  useSearchUsersQuery,
} from "@/features/users/usersApi";
import { useMeQuery, type User } from "@/features/auth/authApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { ROUTES } from "@/constants/routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Ban } from "../features/ban/banApi.tsx";
import {
  useBanUserMutation,
  useGetBanHistoryQuery,
  useGetBanStatusQuery,
  useUnbanUserMutation,
} from "@/features/ban/banApi";
import { Profile } from "./Profile.tsx";

function UserRow({
  user,
  actions,
}: {
  user: User;
  actions: ReactNode;
}) {
  const { t } = useTranslation();
  const { data: banStatus, isFetching: searchLoading } = useGetBanStatusQuery(user.id);

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
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-medium">
            {user.displayname}
          </p>
          <p className="truncate text-xs font-medium text-red-600">
            {banStatus && "Banned"}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </li>
  );
}

function UserProfile({ userId, banStatus } : { userId: string, banStatus?: boolean }) {
  const { data: user, isFetching: fetching } = useGetUserQuery(userId);

  return (
    <>
      <CardContent>
        <Avatar className="size-16 rounded-lg">
          <AvatarImage
            src={resolveAvatarUrl(user?.user.avatarUrl)}
            alt={user?.user.displayname}
            className="rounded-lg"
          />
          <AvatarFallback className="rounded-lg text-xs">
            {getInitials(user?.user.displayname)}
          </AvatarFallback>
        </Avatar>
        <br />
        <p className={`truncate text-m font-large ${banStatus ? "text-red-600" : "text-muted-foreground"}`}>
        {banStatus && "Banned"}
        </p>
        Username: {user?.user.displayname}
        <br />
        Email: {user?.user.email}
        <br />
        {user?.user.login42 && "42 login:" + user?.user.login42}
      </CardContent>
    </>
  );
}

function BanHistory({ className, history } : { className?: string, history?: Ban[] }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center">
        <CardTitle>
          Ban History
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto">
        {history && history.length > 0 && <p>Ban Count: {history.length}</p>}
        {history && history.length ?
          history.map((ban) =>
            <div key={ban.id} className="text-gray-500">
              <p>- Ban Id: {ban.id}</p>
              <p>- User Id: {ban.userId}</p>
              <p>- Ban Start Time: {ban.startTime}</p>
              <p>- Ban End Time: {ban.endTime ? ban.endTime : "Permanent"}</p>
              <p>- Ban Reason: {ban.reason}</p>
              <br />
            </div>
          )
          : "User has never been banned before"
        }
      </CardContent>
    </Card>
  );
}

function BanCard({userId} : {userId: string}) {
  const [ banUser, { isLoading: sending }] = useBanUserMutation();
  const [ banDuration, setBanDuration ] = useState("");
  const [ banReason, setBanReason ] = useState("");

  return (
    <>
      <CardHeader className="flex flex-row items-center">
        <CardTitle>
          Select Ban duration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          value={banDuration}
          onChange={(e) => setBanDuration(e.target.value)}
          placeholder={"Enter ban duration in hours"}
        />
        <Input
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder={"Enter ban reason"}
        />
      </CardContent>
      <CardContent>
        <Button onClick={() => banUser({ userId: userId, durationHours: Number(banDuration), reason: banReason })}>
          Ban
        </Button>
      </CardContent>
    </>
  );
}

function UnbanCard({userId} : {userId: string}) {
  const [ unbanUser, { isLoading: sending }] = useUnbanUserMutation();

  return (
    <>
      <CardContent>
        <Button onClick={() => unbanUser(userId)}>
          Unban
        </Button>
      </CardContent>
    </>
  );
}

function BanPopUp({userId, setHide} : {userId: string, setHide: () => void}) {
  const { data: history, isFetching: historyLoading } = useGetBanHistoryQuery(userId);
  const { data: banStatus, isFetching: searchLoading } = useGetBanStatusQuery(userId);

  return (
    <>
      <div className="fixed z-50 top-0 left-0 backdrop-blur-xs size-full" onClick={setHide}>
      </div>
      <div className="fixed top-1/2 left-1/2 z-60 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto">
        <Card>
          <UserProfile userId={userId} banStatus={banStatus} />
          {banStatus ? <UnbanCard userId={userId} /> : <BanCard userId={userId} />}
        </Card>
        <BanHistory className="" history={history} />
      </div>
    </>
  );
}

const SEARCH_PAGE_SIZE = 10;

export const BanPanel = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const { data: results, isFetching: searchLoading } = useSearchUsersQuery({
    q: query.trim() || undefined,
    page: searchPage,
    limit: SEARCH_PAGE_SIZE,
  });
  const { data: meInfo } = useMeQuery();
  const [ userSelected, setUserSelected ] = useState<string | null>(null);

  if (meInfo?.role !== "ADMIN") {
    return <Navigate to="/" replace />
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
                            onClick={() => setUserSelected(user.id)}
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
      {userSelected && <BanPopUp userId={userSelected} setHide={() => setUserSelected(null)} />}
    </>
  );
};
