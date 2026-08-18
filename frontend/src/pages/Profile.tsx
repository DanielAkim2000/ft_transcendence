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
import { useState } from "react";

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

  if (!id || isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  if (error || !data) {
    return (
      <p className="text-destructive">{t("profile.notFound")}</p>
    );
  }

  const { user, friendshipStatus } = data;
  const isBusy = isSending || isAccepting || isRemoving;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
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
          <div>
            <CardTitle className="font-serif text-2xl">
              {user.displayname}
            </CardTitle>
            <CardDescription>
              {user.isOnline ? t("profile.online") : t("profile.offline")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="font-sans text-sm text-muted-foreground">
          <p>{user.email}</p>
        </CardContent>
        <CardFooter className="gap-2">
          {me?.id === user.id || friendshipStatus === "self" ? (
            <Button render={<Link to="/profile/me" />}>
              {t("profile.edit")}
            </Button>
          ) : friendshipStatus === "friends" ? (
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
        </CardFooter>
      </Card>
      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}
    </div>
  );
};
