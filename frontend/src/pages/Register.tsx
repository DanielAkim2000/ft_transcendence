import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useForm } from "@tanstack/react-form";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRegisterMutation } from "@/features/auth/authApi";
import { createRegisterSchema } from "@/features/auth/register.schema";
import { AuthShell } from "@/layouts/AuthShell";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/constants/routes";

export const Register = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const [register, { isLoading }] = useRegisterMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  // i18n.language force la recomputation quand la langue change (messages traduits).
  const registerSchema = useMemo(
    () => createRegisterSchema(t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
    validators: {
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await register(value).unwrap();
        navigate(ROUTES.HOME, { replace: true });
      } catch (error) {
        setServerError(getErrorMessage(error, t("auth.register.failed")));
      }
    },
  });

  if (accessToken) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return (
    <AuthShell>
      <Card className="w-full border-border bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("auth.register.title")}
          </CardTitle>
          <CardDescription className="font-sans">
            {t("auth.register.description")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            id="register-form"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field
                name="username"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("auth.register.username")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder={t("auth.register.usernamePlaceholder")}
                        autoComplete="username"
                        className="h-10"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              />

              <form.Field
                name="email"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("auth.register.email")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder={t("auth.register.emailPlaceholder")}
                        autoComplete="email"
                        className="h-10"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              />

              <form.Field
                name="password"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("auth.register.password")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder={t("auth.register.passwordPlaceholder")}
                        autoComplete="new-password"
                        className="h-10"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              />

              {serverError ? <FieldError>{serverError}</FieldError> : null}
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            form="register-form"
            size="lg"
            className="h-10 w-full"
            disabled={isLoading || form.state.isSubmitting}
          >
            {isLoading || form.state.isSubmitting
              ? t("auth.register.submitting")
              : t("auth.register.submit")}
          </Button>
          <p className="w-full text-center font-sans text-sm text-muted-foreground">
            {t("auth.register.hasAccount")}{" "}
            <Link
              to={ROUTES.LOGIN}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("auth.register.loginLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  );
};
