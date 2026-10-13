import type { Socket } from "socket.io-client";
import { closeSocket, createSocket } from "@/lib/socket";

let socket: Socket | null = null;

/** [Major · Temps réel WebSockets] Ouvre le socket du namespace /matches (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé). */
const connect = (accessToken: string): Socket => {
  const previous = (socket?.auth as { access_token: string })?.access_token;
  if (socket && previous === accessToken) return socket;
  disconnect();
  socket = createSocket("/matches", accessToken);
  return socket;
};

/** [Major · Temps réel WebSockets] Ferme proprement le socket du namespace /matches et oublie la référence. */
const disconnect = () => {
  if (!socket) return;
  closeSocket(socket);
  socket = null;
};

export { connect, disconnect };
