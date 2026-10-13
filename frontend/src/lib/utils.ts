import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** [Minor · Design system] Fusionne des classes CSS conditionnelles (clsx) en résolvant les conflits Tailwind (tailwind-merge) : utilitaire de base de tous les composants. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
