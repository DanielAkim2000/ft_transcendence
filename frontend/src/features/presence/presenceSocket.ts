import type { Socket } from "socket.io-client";
import { createSocket } from "@/lib/socket";

let socket: Socket | null = null;

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

const disconnect = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};

const getSocket = (): Socket | null => {
  return socket;
};

export { connect, disconnect, getSocket };
