import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useForm, useStore } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useMeQuery } from "@/features/auth/authApi";
import { PlayerBadgesCard } from "@/features/badges/PlayerBadgesCard";
import { ROUTES } from "@/constants/routes";
import {
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "@/features/users/usersApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { PageFallback } from "@/components/page-fallback";

export const ProfileMe = () => {
  const { data: user, isLoading } = useMeQuery();

  if (isLoading || !user) {
    return <PageFallback />;
  }

  return <ProfileMeForm user={user} />;
};

function ProfileMeForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof useMeQuery>["data"]>;
}) {
  const { t, i18n } = useTranslation();
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [uploadAvatar, { isLoading: isUploading }] = useUploadAvatarMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  // i18n.language force la recomputation quand la langue change (messages traduits).
  const schema = useMemo(
    () =>
      z.object({
        displayname: z
          .string()
          .min(3, t("auth.validation.usernameMin"))
          .max(32, t("auth.validation.usernameMax")),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const form = useForm({
    defaultValues: {
      displayname: user.displayname,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        value.displayname = value.displayname.trim();
        await updateProfile(value).unwrap();
        toast.add({
          title: t("profile.saveSuccess"),
          type: "success",
        });
      } catch (error) {
        setServerError(getErrorMessage(error, t("profile.saveFailed")));
      }
    },
  });

  const previewName =
    useStore(form.store, (state) => state.values.displayname).trim() || user.displayname;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("profile.meTitle")}
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {t("profile.meDescription")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.avatarTitle")}</CardTitle>
          <CardDescription>{t("profile.avatarDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
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
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isUploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setServerError(null);
              try {
                await uploadAvatar(file).unwrap();
                toast.add({
                  title: t("profile.avatarSuccess"),
                  type: "success",
                });
              } catch (error) {
                setServerError(
                  getErrorMessage(error, t("profile.avatarFailed")),
                );
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.infoTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            id="profile-form"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <FieldGroup>
              <form.Field
                name="displayname"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("profile.displayname")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              />
            </FieldGroup>
          </form>
          {serverError ? (
            <p className="mt-3 text-sm text-destructive">{serverError}</p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between">
          <Button
            variant="outline"
            render={<Link to={ROUTES.profile(user.id)} />}
          >
            {t("profile.viewPublic")}
          </Button>
          <ConfirmDialog
            title={t("confirm.saveProfileTitle")}
            description={t("confirm.saveProfileDescription")}
            confirmLabel={t("profile.save")}
            variant="default"
            loading={isSaving}
            onConfirm={() => form.handleSubmit()}
          >
            <Button
              type="button"
              disabled={isSaving || form.state.isSubmitting}
            >
              {isSaving ? t("profile.saving") : t("profile.save")}
            </Button>
          </ConfirmDialog>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-3 border border-border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("profile.previewTitle")}
        </p>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage
              src={resolveAvatarUrl(user.avatarUrl)}
              alt={previewName}
            />
            <AvatarFallback>{getInitials(previewName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{previewName}</p>
            <p className="text-xs uppercase tracking-wider text-primary">
              {t("profile.online")}
            </p>
          </div>
        </div>
      </div>

      <PlayerBadgesCard userId={user.id} />
    </div>
  );
}
