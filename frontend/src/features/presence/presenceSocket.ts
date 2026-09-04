import { Socket, io } from "socket.io-client";

let socket: Socket | null = null;

const connect = (accessToken: string): Socket | null => {
  const previous = (socket?.auth as { access_token: string })?.access_token;
  if (socket && previous !== accessToken) {
    disconnect();
  } else if (socket) {
    return socket;
  }
  socket = io(`${import.meta.env.VITE_API_URL}/presence`, {
    auth: {
      access_token: accessToken,
    },
  });
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
