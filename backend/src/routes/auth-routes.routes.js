import express from "express";
import {
  forgetpasswordController,
  getCurrentUser,
  loginController,
  logoutController,
  refreshTokenController,
  resetPasswordController,
  signupController,
} from "../controller/auth.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";

const router = express.Router();
//express.Router(): được dùng để để tách các route trong ứng dụng thành các module riêng biệt
//giúp quản lý mã nguồn tốt hơn

router.post("/signup", signupController);
router.post("/login", loginController);
router.post("/logout", verifyToken, logoutController);
router.post("/refresh-token", refreshTokenController);
router.get("/current-user", verifyToken, getCurrentUser);
router.post("/forget-password", forgetpasswordController);
router.post("/reset-password/:token", resetPasswordController);
export default router;
