import type { NavigateFunction } from "react-router";

let navigateFn: NavigateFunction | null = null;

/** [Major · Frameworks React + NestJS] Rempli par <NavigationBridge/>, monté une fois sous <BrowserRouter>. */
export function setNavigate(fn: NavigateFunction): void {
  navigateFn = fn;
}

/** [Major · Frameworks React + NestJS] Navigation programmatique utilisable en dehors de l'arbre React (sockets, etc.). */
export function navigate(to: string): void {
  navigateFn?.(to);
}
