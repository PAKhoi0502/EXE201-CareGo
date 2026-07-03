import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api").replace("/api", "");

const provideSocketAuth = (callback) => {
  callback({ token: localStorage.getItem("carego_token") });
};

export const locationSocket = io(socketUrl, {
  autoConnect: false,
  auth: provideSocketAuth,
});

export const connectLocationSocket = () => {
  locationSocket.auth = provideSocketAuth;
  locationSocket.connect();
  return locationSocket;
};
