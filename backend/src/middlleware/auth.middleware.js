import jwt from "jsonwebtoken";
import User from "../models/user.models.js";

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7);
};

export const verifyToken = async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({ message: "no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res.status(403).json({ message: "invalid token" });
    }

    const user = await User.findById(userId).select("_id role isActive isEmailVerified email");
    if (!user) {
      return res.status(401).json({ message: "user not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "account is inactive" });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "email is not verified",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    req.user = {
      ...decoded,
      userId: user._id.toString(),
      role: user.role,
    };

    return next();
  } catch {
    return res.status(403).json({ message: "invalid token" });
  }
};
