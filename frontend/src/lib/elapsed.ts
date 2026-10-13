import { useEffect, useState } from "react";

/** [Socle produit babyfoot (hors module)] Formate le temps écoulé depuis une date (mm:ss, ou h:mm:ss au-delà d'une heure) pour les chronos de table. */
export function formatElapsed(since: string | null, now: number): string {
  if (!since) return "00:00";
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** [Socle produit babyfoot (hors module)] Formate le temps restant avant une échéance (mm:ss, jamais négatif) pour les décomptes d'appel ou de validation. */
export function formatRemaining(until: string | null, now: number): string {
  if (!until) return "00:00";
  const seconds = Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** [Socle produit babyfoot (hors module)] Horloge d'une seconde, active uniquement quand un chrono est affiché. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
