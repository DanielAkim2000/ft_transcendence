import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeInput } from "@/components/ui/code-input";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useGetRecoveryCodesStatusQuery,
  useRegenerateRecoveryCodesMutation,
} from "@/features/auth/authApi";
import { getErrorMessage } from "@/lib/get-error-message";

const LOW_CODES_THRESHOLD = 2;

type Props = {
  /** Codes tout juste générés (activation ou régénération) : seule fois où ils sont visibles. */
  codes: string[] | null;
  onCodesChange: (codes: string[] | null) => void;
};

/** [Minor · 2FA] Affiche les codes de secours 2FA une seule fois (avec consigne de les noter), puis permet de les régénérer après re-confirmation. */
export function RecoveryCodesCard({ codes, onCodesChange }: Props) {
  const { t } = useTranslation();
  const { data: status } = useGetRecoveryCodesStatusQuery();
  const [regenerate, { isLoading }] = useRegenerateRecoveryCodesMutation();
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<"code" | "password">("code");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** [Minor · 2FA] Réinitialise le formulaire de régénération (mode, code, mot de passe, erreur). */
  const resetForm = () => {
    setConfirming(false);
    setMode("code");
    setCode("");
    setPassword("");
    setError(null);
  };

  /** [Minor · 2FA] Régénère les codes de secours après confirmation par un code TOTP ou le mot de passe, puis remonte les nouveaux codes. */
  const handleRegenerate = async () => {
    setError(null);
    try {
      const result = await regenerate(
        mode === "code" ? { code } : { password },
      ).unwrap();
      onCodesChange(result.recoveryCodes);
      resetForm();
    } catch (err) {
      setError(getErrorMessage(err, t("settings.twoFactor.recovery.failed")));
    }
  };

  /** [Minor · 2FA] Copie les codes de secours dans le presse-papiers. */
  const handleCopy = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  /** [Minor · 2FA] Télécharge les codes de secours dans un fichier texte. */
  const handleDownload = () => {
    if (!codes) return;
    const url = URL.createObjectURL(
      new Blob([codes.join("\n") + "\n"], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = t("settings.twoFactor.recovery.filename");
    link.click();
    URL.revokeObjectURL(url);
  };

  if (codes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.twoFactor.recovery.newTitle")}</CardTitle>
          <CardDescription className="font-semibold text-destructive">
            {t("settings.twoFactor.recovery.newWarning")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="grid grid-cols-2 gap-2 border border-border p-4 font-mono text-sm">
            {codes.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied
                ? t("settings.twoFactor.recovery.copied")
                : t("settings.twoFactor.recovery.copy")}
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload}>
              {t("settings.twoFactor.recovery.download")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onCodesChange(null);
                setCopied(false);
              }}
            >
              {t("settings.twoFactor.recovery.saved")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const remaining = status?.remaining;
  const canSubmit =
    !isLoading && (mode === "code" ? /^\d{6}$/.test(code) : password.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.twoFactor.recovery.title")}</CardTitle>
        <CardDescription>
          {t("settings.twoFactor.recovery.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {remaining !== undefined && (
          <p className="text-sm">
            {t("settings.twoFactor.recovery.remaining", { count: remaining })}{" "}
            {remaining <= LOW_CODES_THRESHOLD && (
              <span className="text-destructive">
                {t("settings.twoFactor.recovery.lowWarning")}
              </span>
            )}
          </p>
        )}

        {confirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t("settings.twoFactor.recovery.regenerateHint")}
            </p>
            {mode === "code" ? (
              <CodeInput value={code} onChange={setCode} autoFocus />
            ) : (
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-label={t("settings.twoFactor.recovery.confirmWithPassword")}
                autoComplete="current-password"
                className="h-10 max-w-xs"
              />
            )}
            <button
              type="button"
              className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => {
                setError(null);
                setMode(mode === "code" ? "password" : "code");
              }}
            >
              {mode === "code"
                ? t("settings.twoFactor.recovery.usePassword")
                : t("settings.twoFactor.recovery.useAuthenticator")}
            </button>
            {error ? <FieldError>{error}</FieldError> : null}
            <div className="flex gap-2">
              <Button type="button" disabled={!canSubmit} onClick={handleRegenerate}>
                {isLoading
                  ? t("settings.twoFactor.recovery.submitting")
                  : t("settings.twoFactor.recovery.submit")}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                {t("settings.twoFactor.recovery.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => setConfirming(true)}
          >
            {t("settings.twoFactor.recovery.regenerate")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
