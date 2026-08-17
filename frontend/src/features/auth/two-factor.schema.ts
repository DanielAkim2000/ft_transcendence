import type { TFunction } from "i18next";
import * as z from "zod";

export function createTwoFactorSchema(t: TFunction) {
  return z.object({
    code: z
      .string()
      .regex(/^\d{6}$/, t("auth.validation.codeInvalid")),
  });
}
