import { useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Role } from "@/features/auth/authApi";
import {
  useAdminCreateUserMutation,
  useAdminUpdateUserMutation,
  type AdminUser,
} from "@/features/admin/adminApi";
import { getErrorMessage } from "@/lib/get-error-message";

type Props = {
  /** Utilisateur à modifier ; absent = création. */
  user?: AdminUser;
  /** Vrai pour le compte de l'administrateur connecté : il ne peut pas changer son propre rôle. */
  isSelf?: boolean;
  onClose: () => void;
};

/** Formulaire (en fenêtre) de création ou de modification d'un compte par un administrateur. */
export function UserFormDialog({ user, isSelf = false, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const editing = user !== undefined;
  const [createUser] = useAdminCreateUserMutation();
  const [updateUser] = useAdminUpdateUserMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(() => {
    const strongPassword = z
      .string()
      .min(8, t("auth.validation.passwordMin"))
      .max(32, t("auth.validation.passwordMax"))
      .regex(/[a-z]/, t("auth.validation.passwordLower"))
      .regex(/[A-Z]/, t("auth.validation.passwordUpper"))
      .regex(/[0-9]/, t("auth.validation.passwordNumber"))
      .regex(/[^A-Za-z0-9]/, t("auth.validation.passwordSymbol"));
    return z.object({
      displayname: z
        .string()
        .trim()
        .min(1, t("admin.users.form.displaynameRequired"))
        .max(32, t("auth.validation.usernameMax")),
      email: z.email(t("auth.validation.emailInvalid")),
      role: z.enum(["USER", "ADMIN"]),
      // En modification, un mot de passe vide = on ne le change pas.
      password: editing
        ? z.union([z.literal(""), strongPassword])
        : strongPassword,
    });
    // i18n.language force la recomputation quand la langue change (messages traduits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language, editing]);

  const form = useForm({
    defaultValues: {
      displayname: user?.displayname ?? "",
      email: user?.email ?? "",
      role: (user?.role ?? "USER") as Role,
      password: "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        if (user) {
          await updateUser({
            id: user.id,
            displayname: value.displayname.trim(),
            email: value.email,
            role: value.role,
            password: value.password || undefined,
          }).unwrap();
          toast.add({ title: t("admin.users.updatedToast"), type: "success" });
        } else {
          await createUser({
            displayname: value.displayname.trim(),
            email: value.email,
            role: value.role,
            password: value.password,
          }).unwrap();
          toast.add({ title: t("admin.users.createdToast"), type: "success" });
        }
        onClose();
      } catch (error) {
        setServerError(getErrorMessage(error, t("admin.users.saveFailed")));
      }
    },
  });

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="font-heading text-lg font-semibold">
            {editing
              ? t("admin.users.form.editTitle")
              : t("admin.users.form.createTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-1 font-sans text-sm text-muted-foreground">
            {editing
              ? t("admin.users.form.editDescription")
              : t("admin.users.form.createDescription")}
          </Dialog.Description>

          <form
            id="admin-user-form"
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field
                name="displayname"
                children={(field) => {
                  const invalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("admin.users.form.displayname")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={invalid}
                        className="h-10"
                      />
                      {invalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              <form.Field
                name="email"
                children={(field) => {
                  const invalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("admin.users.form.email")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={invalid}
                        autoComplete="off"
                        className="h-10"
                      />
                      {invalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              <form.Field
                name="role"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t("admin.users.form.role")}
                    </FieldLabel>
                    <select
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value as Role)}
                      disabled={isSelf}
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                    >
                      <option value="USER">{t("admin.users.role.USER")}</option>
                      <option value="ADMIN">{t("admin.users.role.ADMIN")}</option>
                    </select>
                    {isSelf ? (
                      <p className="text-xs text-muted-foreground">
                        {t("admin.users.form.selfRoleHint")}
                      </p>
                    ) : null}
                  </Field>
                )}
              />

              <form.Field
                name="password"
                children={(field) => {
                  const invalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name}>
                        {editing
                          ? t("admin.users.form.newPassword")
                          : t("admin.users.form.password")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={invalid}
                        autoComplete="new-password"
                        className="h-10"
                      />
                      {editing ? (
                        <p className="text-xs text-muted-foreground">
                          {t("admin.users.form.newPasswordHint")}
                        </p>
                      ) : null}
                      {invalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              {serverError ? <FieldError>{serverError}</FieldError> : null}
            </FieldGroup>
          </form>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form="admin-user-form"
              loading={form.state.isSubmitting}
            >
              {form.state.isSubmitting
                ? t("admin.users.form.saving")
                : t("admin.users.form.save")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
