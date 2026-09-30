import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMeQuery } from "@/features/auth/authApi";
import {
  useAcceptFriendRequestMutation,
  useGetUserQuery,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
} from "@/features/users/usersApi";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { getErrorMessage } from "@/lib/get-error-message";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlayerBadgesCard } from "@/features/badges/PlayerBadgesCard";
import { useState } from "react";
import { CrownIcon, SwordsIcon } from "lucide-react";
import { ChallengeDialog } from "@/features/matches/ChallengeDialog";
import { useChessInvite } from "@/features/chess/useChessInvite";
import { ROUTES } from "@/constants/routes";
import { PageFallback } from "@/components/page-fallback";

export const Profile = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMeQuery();
  const { data, isLoading, error } = useGetUserQuery(id ?? "", { skip: !id });
  const [sendRequest, { isLoading: isSending }] = useSendFriendRequestMutation();
  const [acceptRequest, { isLoading: isAccepting }] =
    useAcceptFriendRequestMutation();
  const [removeFriend, { isLoading: isRemoving }] = useRemoveFriendMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [justSentId, setJustSentId] = useState<string | null>(null);
  const { inviteToChess } = useChessInvite();

  if (!id || isLoading) {
    return <PageFallback />;
  }

  if (error || !data) {
    return (
      <p className="text-destructive">{t("profile.notFound")}</p>
    );
  }

  const { user, friendshipStatus } = data;
  const isBusy = isSending || isAccepting || isRemoving;
  const canSeePresence =
    friendshipStatus === "friends" || friendshipStatus === "self";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="relative shrink-0">
            <Avatar className="size-16 rounded-lg">
              <AvatarImage
                src={resolveAvatarUrl(user.avatarUrl)}
                alt={user.displayname}
                className="rounded-lg"
              />
              <AvatarFallback className="rounded-lg">
                {getInitials(user.displayname)}
              </AvatarFallback>
            </Avatar>
            {canSeePresence ? (
              <span
                className={`absolute right-0.5 bottom-0.5 size-3.5 rounded-full ring-2 ring-background ${
                  user.isOnline ? "bg-primary" : "bg-muted-foreground"
                }`}
                aria-hidden
              />
            ) : null}
          </div>
          <div>
            <CardTitle className="text-xl font-bold">
              {user.displayname}
            </CardTitle>
            {canSeePresence ? (
              <CardDescription
                className={
                  user.isOnline ? "text-primary font-medium" : undefined
                }
              >
                {user.isOnline ? t("profile.online") : t("profile.offline")}
              </CardDescription>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="font-sans text-sm text-muted-foreground">
          <p>{user.email}</p>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          {me?.id === user.id || friendshipStatus === "self" ? (
            <Button render={<Link to={ROUTES.PROFILE_ME} />}>
              {t("profile.edit")}
            </Button>
          ) : friendshipStatus === "friends" ? (
            <>
            <Button render={<Link to={ROUTES.chatWith(user.id)} />}>
              {t("friends.message")}
            </Button>
            <ConfirmDialog
              title={t("confirm.removeFriendTitle")}
              description={t("confirm.removeFriendDescription", {
                name: user.displayname,
              })}
              confirmLabel={t("friends.remove")}
              loading={isBusy}
              onConfirm={async () => {
                setActionError(null);
                try {
                  await removeFriend(user.id).unwrap();
                } catch (err) {
                  setActionError(
                    getErrorMessage(err, t("friends.actionFailed")),
                  );
                }
              }}
            >
              <Button variant="outline" disabled={isBusy}>
                {t("friends.remove")}
              </Button>
            </ConfirmDialog>
            </>
          ) : friendshipStatus === "pending_in" ? (
            <>
              <Button
                disabled={isBusy}
                onClick={async () => {
                  setActionError(null);
                  try {
                    await acceptRequest(user.id).unwrap();
                  } catch (err) {
                    setActionError(
                      getErrorMessage(err, t("friends.actionFailed")),
                    );
                  }
                }}
              >
                {t("friends.accept")}
              </Button>
              <ConfirmDialog
                title={t("confirm.declineTitle")}
                description={t("confirm.declineDescription", {
                  name: user.displayname,
                })}
                confirmLabel={t("friends.decline")}
                loading={isBusy}
                onConfirm={async () => {
                  setActionError(null);
                  try {
                    await removeFriend(user.id).unwrap();
                  } catch (err) {
                    setActionError(
                      getErrorMessage(err, t("friends.actionFailed")),
                    );
                  }
                }}
              >
                <Button variant="outline" disabled={isBusy}>
                  {t("friends.decline")}
                </Button>
              </ConfirmDialog>
            </>
          ) : friendshipStatus === "pending_out" || justSentId === user.id ? (
            <Button variant="outline" disabled>
              {justSentId === user.id
                ? t("friends.inviteSent")
                : t("friends.inviteAlreadySent")}
            </Button>
          ) : (
            <Button
              disabled={isBusy}
              onClick={async () => {
                setActionError(null);
                try {
                  await sendRequest(user.id).unwrap();
                  setJustSentId(user.id);
                  toast.add({
                    title: t("friends.inviteSentToast"),
                    type: "success",
                  });
                } catch (err) {
                  setActionError(
                    getErrorMessage(err, t("friends.actionFailed")),
                  );
                }
              }}
            >
              {t("friends.add")}
            </Button>
          )}
          {me && me.id !== user.id && friendshipStatus !== "self" ? (
            <>
              <ChallengeDialog opponent={user}>
                <Button variant="outline">
                  <SwordsIcon />
                  {t("matches.challenge")}
                </Button>
              </ChallengeDialog>
              <Button variant="outline" onClick={() => inviteToChess(user.id)}>
                <CrownIcon />
                {t("chat.inviteChess")}
              </Button>
            </>
          ) : null}
        </CardFooter>
      </Card>
      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}
      <PlayerBadgesCard userId={user.id} />
    </div>
  );
};
