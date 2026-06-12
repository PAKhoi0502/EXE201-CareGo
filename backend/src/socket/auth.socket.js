import jwt from "jsonwebtoken";

export const setupSocketAuthentication = (io) => {
  io.use((socket, next) => {
    const authorization = socket.handshake.headers.authorization;
    const headerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const token = socket.handshake.auth?.token || headerToken;

    if (!token) {
      return next(new Error("unauthorized"));
    }

    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET_KEY);
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });
};
