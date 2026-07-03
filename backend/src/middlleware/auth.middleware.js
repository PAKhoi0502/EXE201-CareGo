import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import { getEffectiveRoles } from "./role.middleware.js";

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7);
};

const getMountedPath = (req) => `${req.baseUrl || ""}${req.path || ""}`;

const canUseTemporaryPasswordRoute = (req) => {
  const mountedPath = getMountedPath(req);
  return (
    (req.method === "GET" && mountedPath.endsWith("/current-user")) ||
    (req.method === "PATCH" && mountedPath.endsWith("/current-user/initial-password"))
  );
};

export const verifyToken = async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({ message: "Bạn chưa cung cấp mã xác thực." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res.status(403).json({ message: "Phiên đăng nhập không hợp lệ." });
    }

    const user = await User.findById(userId).select("_id name role isActive isEmailVerified email mustChangePassword");
    if (!user) {
      return res.status(401).json({ message: "Không tìm thấy tài khoản." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Tài khoản đã bị vô hiệu hóa." });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Email chưa được xác thực.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    const requestUser = {
      ...decoded,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    requestUser.roles = getEffectiveRoles(requestUser);
    req.user = requestUser;

    if (user.mustChangePassword && !canUseTemporaryPasswordRoute(req)) {
      return res.status(403).json({
        message: "Vui lòng đổi mật khẩu tạm thời trước khi tiếp tục.",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    return next();
  } catch {
    return res.status(403).json({ message: "Phiên đăng nhập không hợp lệ." });
  }
};

export const optionalVerifyToken = async (req, _res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return next();
    }

    const user = await User.findById(userId).select("_id name role isActive isEmailVerified email mustChangePassword");
    if (!user || !user.isActive || !user.isEmailVerified) {
      return next();
    }

    const requestUser = {
      ...decoded,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    requestUser.roles = getEffectiveRoles(requestUser);
    req.user = requestUser;
  } catch {
    req.user = undefined;
  }

  return next();
};
