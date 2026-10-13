import type { TFunction } from "i18next";
import * as z from "zod";

/** [Major · Gestion des utilisateurs] Schéma zod du formulaire d'inscription (pseudo 3–32, email, mot de passe fort : minuscule, majuscule, chiffre, symbole). */
export function createRegisterSchema(t: TFunction) {
  return z.object({
    username: z
      .string()
      .min(3, t("auth.validation.usernameMin"))
      .max(32, t("auth.validation.usernameMax")),
    email: z.email(t("auth.validation.emailInvalid")),
    password: z
      .string()
      .min(8, t("auth.validation.passwordMin"))
      .max(32, t("auth.validation.passwordMax"))
      .regex(/[a-z]/, t("auth.validation.passwordLower"))
      .regex(/[A-Z]/, t("auth.validation.passwordUpper"))
      .regex(/[0-9]/, t("auth.validation.passwordNumber"))
      .regex(/[^A-Za-z0-9]/, t("auth.validation.passwordSymbol")),
  });
}
