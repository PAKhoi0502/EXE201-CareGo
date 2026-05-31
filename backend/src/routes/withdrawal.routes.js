import express from "express";
import jwt from "jsonwebtoken";
import {
  createWithdrawalRequest,
  getAdminWithdrawalRequests,
  getMyWithdrawalSummary,
  updateWithdrawalStatus,
} from "../controller/withdrawal.controller.js";

const router = express.Router();

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7);
};

const verifyToken = (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({ message: "no access token provided" });
  }

  const secrets = [
    process.env.JWT_ACCESS_KEY,
    process.env.ACCESS_TOKEN_SECRET,
    process.env.ACCESS_TOKEN_KEY,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_TOKEN_SECRET,
    process.env.JWT_SECRET,
    process.env.JWT_SECRET_KEY,
    process.env.SECRET_KEY,
    "carego_secret",
  ].filter(Boolean);

  let decoded = null;
  let verifyError = null;

  for (const secret of secrets) {
    try {
      decoded = jwt.verify(token, secret);
      break;
    } catch (error) {
      verifyError = error;
    }
  }

  if (!decoded) {
    return res.status(401).json({
      message: "invalid access token",
      error: verifyError?.message || "Token verification failed",
    });
  }

  req.user = {
    ...decoded,
    userId: decoded.userId || decoded.id || decoded._id,
    role: decoded.role,
  };

  return next();
};

router.get("/my", verifyToken, getMyWithdrawalSummary);
router.post("/", verifyToken, createWithdrawalRequest);
router.get("/", verifyToken, getAdminWithdrawalRequests);
router.get("/admin", verifyToken, getAdminWithdrawalRequests);
router.patch("/admin/:id/status", verifyToken, updateWithdrawalStatus);

export default router;
