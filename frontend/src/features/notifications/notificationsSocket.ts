import type { Socket } from "socket.io-client";
import { createSocket } from "@/lib/socket";

let socket: Socket | null = null;

const connect = (accessToken: string): Socket => {
  const previous = (socket?.auth as { access_token: string })?.access_token;
  if (socket && previous === accessToken) return socket;
  disconnect();
  socket = createSocket("/notifications", accessToken);
  return socket;
};

const disconnect = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};

export { connect, disconnect };
