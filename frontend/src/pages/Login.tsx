import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
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
import { CodeInput } from "@/components/ui/code-input";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  useLoginMutation,
  useVerify2faMutation,
} from "@/features/auth/authApi";
import { createLoginSchema } from "@/features/auth/login.schema";
import { createTwoFactorSchema } from "@/features/auth/two-factor.schema";
import { clearCredentials } from "@/features/auth/authSlice";
import { AuthShell } from "@/layouts/AuthShell";
import { ROUTES } from "@/constants/routes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

function LoginCredentialsForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  // i18n.language force la recomputation quand la langue change (messages traduits).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loginSchema = useMemo(() => createLoginSchema(t), [t, i18n.language]);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await login(value).unwrap();
        if (!result.twoFactorEnabled) {
          navigate(ROUTES.HOME, { replace: true });
        }
      } catch (error) {
        const data = (error as {status?: number; data?: { code?: string; reason?: string; endTime?: Date}})
        if (data.status === 403 && data.data?.code === "BAN") {
          setSearchParams({
            banned: "1",
            reason: data.data?.reason,
            ...(data.data?.endTime && { until: data.data?.endTime }),
          });
        }
        setServerError(getErrorMessage(error, t("auth.login.failed")));
      }
    },
  });

  const handleLoginWith42 = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}${API_ROUTES.AUTH_42_LOGIN}`;
  };

  return (
    <Card className="w-full border-border bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">
          {t("auth.login.title")}
        </CardTitle>
        <CardDescription className="font-sans">
          {t("auth.login.description")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          id="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="email"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("auth.login.email")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("auth.login.emailPlaceholder")}
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
                      {t("auth.login.password")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("auth.login.passwordPlaceholder")}
                      autoComplete="current-password"
                      className="h-10"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <div className="-mt-2 text-right">
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="font-sans text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("auth.login.forgotPassword")}
              </Link>
            </div>

            {serverError ? <FieldError>{serverError}</FieldError> : null}
          </FieldGroup>
        </form>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="font-sans text-xs tracking-wide text-muted-foreground uppercase">
            {t("common.or")}
          </span>
          <Separator className="flex-1" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10 w-full"
          onClick={handleLoginWith42}
        >
          {t("auth.login.with42")}
        </Button>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <Button
          type="submit"
          form="login-form"
          size="lg"
          className="h-10 w-full"
          disabled={isLoading || form.state.isSubmitting}
        >
          {isLoading || form.state.isSubmitting
            ? t("auth.login.submitting")
            : t("auth.login.submit")}
        </Button>
        <p className="w-full text-center font-sans text-sm text-muted-foreground">
          {t("auth.login.noAccount")}{" "}
          <Link
            to={ROUTES.REGISTER}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("auth.login.registerLink")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

function TwoFactorForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [verify2fa, { isLoading }] = useVerify2faMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  // i18n.language force la recomputation quand la langue change (messages traduits).
  const twoFactorSchema = useMemo(
    () => createTwoFactorSchema(t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const form = useForm({
    defaultValues: {
      code: "",
    },
    validators: {
      onSubmit: twoFactorSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await verify2fa({ code: value.code }).unwrap();
        navigate(ROUTES.HOME, { replace: true });
      } catch (error) {
        setServerError(getErrorMessage(error, t("auth.twoFactor.failed")));
      }
    },
  });

  return (
    <Card className="w-full border-border bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">
          {t("auth.twoFactor.title")}
        </CardTitle>
        <CardDescription className="font-sans">
          {t("auth.twoFactor.description")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          id="two-factor-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="code"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("auth.twoFactor.code")}
                    </FieldLabel>
                    <CodeInput
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      invalid={isInvalid}
                      autoFocus
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

      <CardFooter className="flex flex-col items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10 w-full"
          onClick={() => {
            dispatch(clearCredentials());
            navigate(ROUTES.LOGIN, { replace: true });
          }}
        >
          {t("common.back")}
        </Button>
        <Button
          type="submit"
          form="two-factor-form"
          size="lg"
          className="h-10 w-full"
          disabled={isLoading || form.state.isSubmitting}
        >
          {isLoading || form.state.isSubmitting
            ? t("auth.twoFactor.submitting")
            : t("auth.twoFactor.submit")}
        </Button>
      </CardFooter>
    </Card>
  );
}

export const Login = () => {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const twoFactorRequired = useAppSelector((s) => s.auth.twoFactorRequired);

  if (accessToken) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return (
    <AuthShell>
      {twoFactorRequired ? <TwoFactorForm /> : <LoginCredentialsForm />}
    </AuthShell>
  );
};
