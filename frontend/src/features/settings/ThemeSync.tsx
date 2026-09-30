import { useEffect, useLayoutEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import type { ThemePreference } from "./settingsSlice";
import { syncFavicon } from "./favicon";

function resolveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(theme: ThemePreference) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeSync({ children }: { children: React.ReactNode }) {
  const theme = useAppSelector((s) => s.settings.theme);
  const accent = useAppSelector((s) => s.settings.accent);
  const radius = useAppSelector((s) => s.settings.radius);

  // Couleur principale et arrondi : attributs lus par index.css (data-accent / data-radius).
  useLayoutEffect(() => {
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.radius = radius;
  }, [accent, radius]);

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // L'icône de l'onglet suit la couleur d'accent et le thème : on la régénère à chaque
  // changement de la classe « dark » ou de data-accent sur <html> (y compris le thème « système »).
  useEffect(() => {
    syncFavicon();
    const observer = new MutationObserver(syncFavicon);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return children;
}
