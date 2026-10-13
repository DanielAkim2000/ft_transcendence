import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
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
import { AuthShell } from "@/layouts/AuthShell";
import { ROUTES } from "@/constants/routes";
import { useResetPasswordMutation } from "@/features/auth/authApi";
import { getErrorMessage } from "@/lib/get-error-message";

export const ResetPassword = () => {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";
    const [resetPassword, { isLoading }] = useResetPasswordMutation();
    const [submitted, setSubmitted] = useState(false);
    const [serverError, setServerError] = useState<string | null>(
        token ? null : t("auth.resetPassword.invalidLink"),
    );

    const passwordSchema = useMemo(
        () =>
            z
                .object({
                    password: z
                        .string()
                        .min(8, t("auth.validation.passwordMin"))
                        .max(32, t("auth.validation.passwordMax"))
                        .regex(/[a-z]/, t("auth.validation.passwordLower"))
                        .regex(/[A-Z]/, t("auth.validation.passwordUpper"))
                        .regex(/[0-9]/, t("auth.validation.passwordNumber"))
                        .regex(/[^A-Za-z0-9]/, t("auth.validation.passwordSymbol")),
                    confirmation: z.string(),
                })
                .refine((value) => value.password === value.confirmation, {
                    path: ["confirmation"],
                    message: t("auth.resetPassword.passwordMismatch"),
                }),
        // i18n.language force la recomputation quand la langue change (messages traduits).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, i18n.language],
    );

    const form = useForm({
        defaultValues: { password: "", confirmation: "" },
        validators: { onSubmit: passwordSchema },
        onSubmit: async ({ value }) => {
            setServerError(null);
            try {
                await resetPassword({ token, password: value.password }).unwrap();
                setSubmitted(true);
            } catch (error) {
                setServerError(
                    getErrorMessage(error, t("auth.resetPassword.failed")),
                );
            }
        },
    });

    return (
        <AuthShell>
            <Card className="w-full border-border bg-card/80 shadow-sm backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        {t("auth.resetPassword.title")}
                    </CardTitle>
                    <CardDescription className="font-sans">
                        {t("auth.resetPassword.description")}
                    </CardDescription>
                </CardHeader>

                {submitted ? (
                    <CardContent>
                        <p className="font-sans text-sm text-muted-foreground">
                            {t("auth.resetPassword.success")}
                        </p>
                    </CardContent>
                ) : (
                    <CardContent>
                        <form
                            id="reset-password-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                form.handleSubmit();
                            }}
                        >
                            <FieldGroup>
                                <form.Field
                                    name="password"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>
                                                    {t("auth.resetPassword.password")}
                                                </FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    type="password"
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(event) => field.handleChange(event.target.value)}
                                                    aria-invalid={isInvalid}
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
                                <form.Field
                                    name="confirmation"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>
                                                    {t("auth.resetPassword.confirmation")}
                                                </FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    type="password"
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(event) => field.handleChange(event.target.value)}
                                                    aria-invalid={isInvalid}
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
                )}

                <CardFooter className="flex flex-col gap-3">
                    {!submitted && token && (
                        <Button
                            type="submit"
                            form="reset-password-form"
                            size="lg"
                            className="h-10 w-full"
                            loading={isLoading || form.state.isSubmitting}
                        >
                            {isLoading || form.state.isSubmitting
                                ? t("auth.resetPassword.submitting")
                                : t("auth.resetPassword.submit")}
                        </Button>
                    )}
                    <p className="w-full text-center font-sans text-sm text-muted-foreground">
                        <Link
                            to={ROUTES.LOGIN}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            {t("auth.resetPassword.loginLink")}
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </AuthShell>
    );
};
