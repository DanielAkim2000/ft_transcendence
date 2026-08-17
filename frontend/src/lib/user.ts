export function getInitials(name?: string | null) {
  if (!name?.trim()) return "FT";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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
