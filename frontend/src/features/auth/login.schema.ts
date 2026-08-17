import type { TFunction } from "i18next";
import * as z from "zod";

export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.email(t("auth.validation.emailInvalid")),
    password: z
      .string()
      .min(8, t("auth.validation.passwordMin"))
      .max(32, t("auth.validation.passwordMax")),
  });
}
