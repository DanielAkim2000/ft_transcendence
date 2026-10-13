import type { Socket } from "socket.io-client";
import { closeSocket, createSocket } from "@/lib/socket";

let socket: Socket | null = null;

export function connectChess(accessToken: string): Socket {
    const previous = (socket?.auth as { access_token?: string })?.access_token;
    if (socket && previous === accessToken) return socket;
    disconnectChess();
    socket = createSocket("/chess", accessToken);
    return socket;
}

export function disconnectChess(): void {
    if (!socket) return;
    closeSocket(socket);
    socket = null;
}