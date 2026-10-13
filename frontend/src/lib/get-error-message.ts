import i18n from "@/i18n";

/** [Major · Frameworks React + NestJS] Traduit un code d'erreur du backend (`errors.<CODE>`) dans la langue active ; null si le code est absent ou sans traduction. */
export function translateErrorCode(
  code: unknown,
  params?: unknown,
): string | null {
  if (typeof code !== "string") return null;
  const key = `errors.${code}`;
  if (!i18n.exists(key)) return null;
  return i18n.t(key, (typeof params === "object" && params !== null ? params : {}) as Record<string, unknown>);
}

/**
 * [Major · Frameworks React + NestJS]
 * Message d'erreur à afficher pour une réponse du backend : traduit dans la langue
 * de l'interface grâce au `code` stable de l'erreur. Le texte brut du backend
 * (anglais, destiné aux logs) n'est jamais affiché : sans code connu, on
 * retombe sur `fallback`, qui doit être traduit par l'appelant.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null) {
      const { code, params } = data as { code?: unknown; params?: unknown };
      return translateErrorCode(code, params) ?? fallback;
    }
  }
  return fallback;
}
