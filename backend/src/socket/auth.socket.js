import jwt from "jsonwebtoken";
import CompanionProfile from "../models/companion-profile.models.js";
import User from "../models/user.models.js";

const getActiveSocketUser = async (userId) => {
  if (!userId) {
    throw new Error("unauthorized");
  }

  const user = await User.findById(userId).select("_id role isActive isEmailVerified");
  if (!user || !user.isActive || !user.isEmailVerified) {
    throw new Error("unauthorized");
  }

  let companionProfile = null;
  if (user.role === "companion") {
    companionProfile = await CompanionProfile.findOne({ userId: user._id }).select("vettingStatus");
    if (!companionProfile || companionProfile.vettingStatus !== "approved") {
      throw new Error("companion account is waiting for admin approval");
    }
  }

  return {
    userId: user._id.toString(),
    role: user.role,
    vettingStatus: companionProfile?.vettingStatus,
  };
};

export const revalidateSocketUser = async (socket) => {
  try {
    const activeUser = await getActiveSocketUser(socket?.user?.userId);
    socket.user = {
      ...socket.user,
      ...activeUser,
    };
    return socket.user;
  } catch {
    socket?.emit?.("auth:revoked", { message: "socket session revoked" });
    socket?.disconnect?.(true);
    return null;
  }
};

export const setupSocketAuthentication = (io) => {
  io.use(async (socket, next) => {
    const authorization = socket.handshake.headers.authorization;
    const headerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const token = socket.handshake.auth?.token || headerToken;

    if (!token) {
      return next(new Error("unauthorized"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const userId = decoded.userId || decoded.id || decoded._id;

      if (!userId) {
        return next(new Error("unauthorized"));
      }

      const activeUser = await getActiveSocketUser(userId);

      socket.user = {
        ...decoded,
        ...activeUser,
      };

      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });
};
