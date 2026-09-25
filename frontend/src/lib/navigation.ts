import type { NavigateFunction } from "react-router";

let navigateFn: NavigateFunction | null = null;

/** Rempli par <NavigationBridge/>, monté une fois sous <BrowserRouter>. */
export function setNavigate(fn: NavigateFunction): void {
  navigateFn = fn;
}

/** Navigation programmatique utilisable en dehors de l'arbre React (sockets, etc.). */
export function navigate(to: string): void {
  navigateFn?.(to);
}
