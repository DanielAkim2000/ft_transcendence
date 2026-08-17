import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useForm } from "@tanstack/react-form";
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
import { useMeQuery } from "@/features/auth/authApi";
import {
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "@/features/users/usersApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";

export const ProfileMe = () => {
  const { t } = useTranslation();
  const { data: user, isLoading } = useMeQuery();

  if (isLoading || !user) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
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
  const [success, setSuccess] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        displayname: z
          .string()
          .min(3, t("auth.validation.usernameMin"))
          .max(32, t("auth.validation.usernameMax")),
      }),
    [t, i18n.language],
  );

  const form = useForm({
    defaultValues: {
      displayname: user.displayname,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      setSuccess(null);
      try {
        await updateProfile(value).unwrap();
        setSuccess(t("profile.saveSuccess"));
      } catch (error) {
        setServerError(getErrorMessage(error, t("profile.saveFailed")));
      }
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">
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
                setSuccess(t("profile.avatarSuccess"));
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
              form.handleSubmit();
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
          {success ? (
            <p className="mt-3 text-sm text-muted-foreground">{success}</p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="outline" render={<Link to={`/profile/${user.id}`} />}>
            {t("profile.viewPublic")}
          </Button>
          <Button
            type="submit"
            form="profile-form"
            disabled={isSaving || form.state.isSubmitting}
          >
            {isSaving ? t("profile.saving") : t("profile.save")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
