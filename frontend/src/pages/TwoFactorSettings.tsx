import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";

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
import {
  useMeQuery,
  useSetup2faMutation,
  useToggle2faMutation,
} from "@/features/auth/authApi";
import { createTwoFactorSchema } from "@/features/auth/two-factor.schema";
import { getErrorMessage } from "@/lib/get-error-message";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const TwoFactorSettings = () => {
  const { t } = useTranslation();
  const { data: user, isLoading: isLoadingUser } = useMeQuery();
  const [setup2fa, { isLoading: isSettingUp }] = useSetup2faMutation();
  const [toggle2fa, { isLoading: isToggling }] = useToggle2faMutation();

  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const twoFactorSchema = useMemo(() => createTwoFactorSchema(t), [t]);

  const clearSetupPreview = () => {
    setQrDataUrl(null);
    setSecret(null);
  };

  const form = useForm({
    defaultValues: {
      code: "",
    },
    validators: {
      onSubmit: twoFactorSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      setSuccessMessage(null);
      try {
        const enabled = await toggle2fa({ code: value.code }).unwrap();
        setSuccessMessage(
          enabled
            ? t("settings.twoFactor.enabledSuccess")
            : t("settings.twoFactor.disabledSuccess"),
        );
        form.reset();
        clearSetupPreview();
      } catch (error) {
        setServerError(
          getErrorMessage(error, t("settings.twoFactor.toggleFailed")),
        );
      }
    },
  });

  const handleSetup = async () => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const result = await setup2fa().unwrap();
      const dataUrl = await QRCode.toDataURL(result.otpauthUrl, {
        width: 220,
        margin: 1,
      });
      setSecret(result.secret);
      setQrDataUrl(dataUrl);
    } catch (error) {
      clearSetupPreview();
      setServerError(
        getErrorMessage(error, t("settings.twoFactor.setupFailed")),
      );
    }
  };

  if (isLoadingUser) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  const isEnabled = user?.twoFactorEnabled === true;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settings.twoFactor.title")}
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {t("settings.twoFactor.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.twoFactor.statusTitle")}</CardTitle>
          <CardDescription>
            {isEnabled
              ? t("settings.twoFactor.statusEnabled")
              : t("settings.twoFactor.statusDisabled")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!isEnabled && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t("settings.twoFactor.setupHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={handleSetup}
                disabled={isSettingUp}
              >
                {isSettingUp
                  ? t("settings.twoFactor.setupLoading")
                  : t("settings.twoFactor.setup")}
              </Button>

              {qrDataUrl && (
                <div className="flex flex-col items-start gap-3 border border-border p-4">
                  <img
                    src={qrDataUrl}
                    alt={t("settings.twoFactor.qrAlt")}
                    className="size-55 bg-white"
                  />
                  {secret && (
                    <p className="font-sans text-xs break-all text-muted-foreground">
                      {t("settings.twoFactor.secretLabel")}:{" "}
                      <span className="font-mono text-foreground">{secret}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <form
            id="toggle-2fa-form"
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
                        {t("settings.twoFactor.code")}
                      </FieldLabel>
                      <CodeInput
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                        invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              />

              {serverError ? <FieldError>{serverError}</FieldError> : null}
              {successMessage ? (
                <p className="text-sm text-foreground">{successMessage}</p>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          {isEnabled ? (
            <ConfirmDialog
              title={t("confirm.disable2faTitle")}
              description={t("confirm.disable2faDescription")}
              confirmLabel={t("settings.twoFactor.disable")}
              loading={isToggling || form.state.isSubmitting}
              onConfirm={() => form.handleSubmit()}
            >
              <Button
                type="button"
                disabled={isToggling || form.state.isSubmitting}
              >
                {isToggling || form.state.isSubmitting
                  ? t("settings.twoFactor.toggling")
                  : t("settings.twoFactor.disable")}
              </Button>
            </ConfirmDialog>
          ) : (
            <Button
              type="submit"
              form="toggle-2fa-form"
              disabled={
                isToggling || form.state.isSubmitting || !qrDataUrl
              }
            >
              {isToggling || form.state.isSubmitting
                ? t("settings.twoFactor.toggling")
                : t("settings.twoFactor.enable")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
