import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api").replace("/api", "");

export const locationSocket = io(socketUrl, {
  autoConnect: false,
});
