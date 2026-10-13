import { ROUTES } from "@/constants/routes";

/** Durées proposées à l'admin (heures ; 0 = permanent). */
export const BAN_DURATIONS = [
  { id: "1h", hours: 1 },
  { id: "24h", hours: 24 },
  { id: "7d", hours: 24 * 7 },
  { id: "30d", hours: 24 * 30 },
  { id: "permanent", hours: 0 },
] as const;

/** Durée maximale d'un ban temporaire (identique au backend : 10 ans). */
export const MAX_BAN_HOURS = 24 * 365 * 10;

export const MAX_REASON_LENGTH = 500;

/** [Major · Permissions avancées] Date et heure lisibles dans la langue de l'interface. */
export function formatBanDate(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** [Major · Permissions avancées] Vrai tant que le ban n'est pas terminé (permanent ou date de fin dans le futur). */
export function isBanActive(ban: { endTime: string | null }): boolean {
  return ban.endTime === null || new Date(ban.endTime).getTime() > Date.now();
}

/** [Major · Permissions avancées] Page de connexion qui affiche le bandeau de ban (motif et date de fin en paramètres d'URL). */
export function banLoginPath(reason: string, endTime: string | null): string {
  const params = new URLSearchParams({ banned: "1", reason });
  if (endTime) params.set("until", endTime);
  return `${ROUTES.LOGIN}?${params.toString()}`;
}
