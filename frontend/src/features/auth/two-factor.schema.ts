import type { TFunction } from "i18next";
import * as z from "zod";

export function createRecoveryCodeSchema(t: TFunction) {
  return z.object({
    recoveryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/, t("auth.validation.recoveryCodeInvalid")),
  });
}

export function createTwoFactorSchema(t: TFunction) {
  return z.object({
    code: z
      .string()
      .regex(/^\d{6}$/, t("auth.validation.codeInvalid")),
  });
}
