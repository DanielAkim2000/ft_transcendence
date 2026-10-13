import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
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
import { useForgotPasswordMutation } from "@/features/auth/authApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppSelector } from "@/store/hooks";

export const ForgetPass = () => {
    const { t, i18n } = useTranslation();
    const accessToken = useAppSelector((state) => state.auth.accessToken);
    const [submitted, setSubmitted] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

    const emailSchema = useMemo(
        () => z.object({ email: z.email(t("auth.validation.emailInvalid")) }),
        // i18n.language force la recomputation quand la langue change (messages traduits).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, i18n.language],
    );

    const form = useForm({
        defaultValues: { email: "" },
        validators: { onSubmit: emailSchema },
        onSubmit: async ({ value }) => {
            setServerError(null);
            try {
                await forgotPassword(value).unwrap();
                setSubmitted(true);
            } catch (error) {
                setServerError(
                    getErrorMessage(error, t("auth.forgetPass.failed")),
                );
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
                        {t("auth.forgetPass.title")}
                    </CardTitle>
                    <CardDescription className="font-sans">
                        {t("auth.forgetPass.description")}
                    </CardDescription>
                </CardHeader>

                {submitted ? (
                    <CardContent>
                        <p className="font-sans text-sm text-muted-foreground">
                            {t("auth.forgetPass.success")}
                        </p>
                    </CardContent>
                ) : (
                    <CardContent>
                        <form
                            id="forget-pass-form"
                            onSubmit={(event) => {
                                event.preventDefault();
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
                                                    {t("auth.forgetPass.email")}
                                                </FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    type="email"
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(event) =>
                                                        field.handleChange(event.target.value)
                                                    }
                                                    aria-invalid={isInvalid}
                                                    placeholder={t("auth.forgetPass.emailPlaceholder")}
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
                                {serverError ? <FieldError>{serverError}</FieldError> : null}
                            </FieldGroup>
                        </form>
                    </CardContent>
                )}

                <CardFooter className="flex flex-col gap-3">
                    {!submitted && (
                        <Button
                            type="submit"
                            form="forget-pass-form"
                            size="lg"
                            className="h-10 w-full"
                            loading={isLoading || form.state.isSubmitting}
                        >
                            {isLoading || form.state.isSubmitting
                                ? t("auth.forgetPass.submitting")
                                : t("auth.forgetPass.submit")}
                        </Button>
                    )}
                    <p className="w-full text-center font-sans text-sm text-muted-foreground">
                        {t("auth.forgetPass.remembered")} {" "}
                        <Link
                            to={ROUTES.LOGIN}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            {t("auth.forgetPass.loginLink")}
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </AuthShell>
    );
};