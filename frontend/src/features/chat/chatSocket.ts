import type { Socket } from "socket.io-client";
import { closeSocket, createSocket } from "@/lib/socket";

let socket: Socket | null = null;

/** [Major · Temps réel WebSockets] Ouvre le socket du namespace /chat (réutilisé si le token est inchangé). */
const connect = (accessToken: string): Socket => {
  const previous = (socket?.auth as { access_token: string })?.access_token;
  if (socket && previous === accessToken) return socket;
  disconnect();
  socket = createSocket("/chat", accessToken);
  return socket;
};

/** [Major · Temps réel WebSockets] Ferme proprement le socket /chat. */
const disconnect = () => {
  if (!socket) return;
  closeSocket(socket);
  socket = null;
};

/** [Minor · Chat avancé] Émet l'événement `typing` (l'utilisateur écrit / a arrêté) vers l'interlocuteur. */
const emitTyping = (conversationId: string, isTyping: boolean) => {
  socket?.emit("typing", { conversationId, isTyping });
};

export { connect, disconnect, emitTyping };
