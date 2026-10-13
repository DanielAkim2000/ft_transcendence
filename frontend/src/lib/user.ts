/** [Major · Gestion des utilisateurs] Initiales (2 lettres max) du nom pour l'avatar de repli, « FT » si le nom est vide. */
export function getInitials(name?: string | null) {
  if (!name?.trim()) return "FT";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** [Major · Gestion des utilisateurs] Transforme l'URL d'avatar renvoyée par l'API (relative ou absolue) en URL complète utilisable dans une image. */
export function resolveAvatarUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const base = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}
