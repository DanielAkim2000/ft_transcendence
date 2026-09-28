import { lazy, type ComponentType } from "react";

/** Charge une page à la demande (chunk séparé) à partir de son export nommé. */
export function lazyPage<K extends string, P extends object>(
  load: () => Promise<Record<K, ComponentType<P>>>,
  name: K,
) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}
