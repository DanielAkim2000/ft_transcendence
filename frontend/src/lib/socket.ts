import { io, type Socket } from "socket.io-client";

/** [Major · Temps réel WebSockets] Ouvre un namespace socket.io, que l'API soit à la racine ou derrière un préfixe (ex. /api). */
export function createSocket(namespace: string, accessToken: string): Socket {
  const api = new URL(import.meta.env.VITE_API_URL);
  return io(`${api.origin}${namespace}`, {
    path: `${api.pathname.replace(/\/$/, "")}/socket.io`,
    auth: { access_token: accessToken },
  });
}

/**
 * [Major · Temps réel WebSockets]
 * Ferme un socket sans couper un WebSocket en cours d'établissement : fermer pendant la montée de
 * polling vers WebSocket fait afficher « connexion interrompue pendant le chargement de la page » par Firefox.
 * On attend donc la fin de l'upgrade (ou un délai maximum, si le serveur reste en polling).
 */
export function closeSocket(socket: Socket): void {
  socket.removeAllListeners();
  const engine = socket.io.engine;
  if (!engine || engine.transport?.name === "websocket" || engine.readyState === "closed") {
    socket.disconnect();
    return;
  }
  let done = false;
  /** [Major · Temps réel WebSockets] Ferme réellement le socket (une seule fois) une fois l'upgrade WebSocket terminé, la connexion fermée ou le délai écoulé. */
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    socket.disconnect();
  };
  const timer = setTimeout(finish, 3000);
  engine.once("upgrade", finish);
  engine.once("close", finish);
}
