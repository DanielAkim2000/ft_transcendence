/** Lit une variable CSS du thème courant (déjà résolue : couleur d'accent + thème clair/sombre). */
function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** Même dessin que public/favicon.svg (carré arrondi + « >_ »), aux couleurs du thème de l'utilisateur. */
function buildFaviconSvg(background: string, foreground: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<rect width="32" height="32" rx="7" fill="${background}"/>` +
    `<text x="16" y="21" text-anchor="middle" font-family="ui-monospace, monospace" ` +
    `font-weight="800" font-size="15" letter-spacing="-0.5" fill="${foreground}">&gt;_</text>` +
    `</svg>`
  );
}

/** Remplace l'icône de l'onglet par un SVG à la couleur principale choisie (et adapté au thème clair/sombre). */
export function syncFavicon(): void {
  const background = cssColor("--primary", "#3ddc84");
  const foreground = cssColor("--primary-foreground", "#07090a");
  const href = `data:image/svg+xml,${encodeURIComponent(buildFaviconSvg(background, foreground))}`;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = href;
}
