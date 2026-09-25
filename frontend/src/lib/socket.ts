import { io, type Socket } from "socket.io-client";

/** Ouvre un namespace socket.io, que l'API soit à la racine ou derrière un préfixe (ex. /api). */
export function createSocket(namespace: string, accessToken: string): Socket {
  const api = new URL(import.meta.env.VITE_API_URL);
  return io(`${api.origin}${namespace}`, {
    path: `${api.pathname.replace(/\/$/, "")}/socket.io`,
    auth: { access_token: accessToken },
  });
}
