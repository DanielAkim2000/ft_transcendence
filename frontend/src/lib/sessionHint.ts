const KEY = "session-hint";

/**
 * Témoin « une session a existé sur ce navigateur ». Le cookie de refresh est httpOnly, donc illisible ici :
 * sans ce témoin, un visiteur sans session déclenche un POST /auth/refresh qui répond 401, et le navigateur
 * affiche cette erreur réseau dans la console (ce que le code ne peut pas masquer). On évite donc l'appel.
 */
export const hasSessionHint = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Stockage indisponible : on retombe sur le comportement d'origine (tenter le refresh).
    return true;
  }
};

export const setSessionHint = (): void => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Ignoré : le témoin n'est qu'une optimisation.
  }
};

export const clearSessionHint = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignoré : le témoin n'est qu'une optimisation.
  }
};
