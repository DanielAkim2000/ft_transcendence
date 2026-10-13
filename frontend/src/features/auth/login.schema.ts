import type { TFunction } from "i18next";
import * as z from "zod";

/** [Major · Gestion des utilisateurs] Schéma zod du formulaire de connexion (email valide, mot de passe 8–32 caractères), messages traduits. */
export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.email(t("auth.validation.emailInvalid")),
    password: z
      .string()
      .min(8, t("auth.validation.passwordMin"))
      .max(32, t("auth.validation.passwordMax")),
  });
}
