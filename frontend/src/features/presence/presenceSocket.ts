import type { Socket } from "socket.io-client";
import { closeSocket, createSocket } from "@/lib/socket";

let socket: Socket | null = null;

/** [Major · Temps réel WebSockets] Ouvre le socket /presence (réutilisé si le token est inchangé). */
const connect = (accessToken: string): Socket | null => {
  const previous = (socket?.auth as { access_token: string })?.access_token;
  if (socket && previous !== accessToken) {
    disconnect();
  } else if (socket) {
    return socket;
  }
  socket = createSocket("/presence", accessToken);
  return socket;
};

/** [Major · Temps réel WebSockets] Ferme le socket /presence. */
const disconnect = () => {
  if (!socket) return;
  closeSocket(socket);
  socket = null;
};

/** [Major · Temps réel WebSockets] Renvoie le socket /presence courant (null si déconnecté). */
const getSocket = (): Socket | null => {
  return socket;
};

export { connect, disconnect, getSocket };
