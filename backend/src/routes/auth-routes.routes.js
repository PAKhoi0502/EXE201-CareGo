import express from "express";
import {
  changeCurrentUserPassword,
  forgetpasswordController,
  getCurrentUser,
  loginController,
  logoutController,
  refreshTokenController,
  requestCurrentUserPasswordOtp,
  resendEmailOtpController,
  resetPasswordController,
  signupController,
  updateCurrentUser,
  verifyEmailOtpController,
} from "../controller/auth.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";

const router = express.Router();
//express.Router(): được dùng để để tách các route trong ứng dụng thành các module riêng biệt
//giúp quản lý mã nguồn tốt hơn

router.post("/signup", signupController);
router.post("/verify-email", verifyEmailOtpController);
router.post("/resend-otp", resendEmailOtpController);
router.post("/login", loginController);
router.post("/logout", verifyToken, logoutController);
router.post("/refresh-token", refreshTokenController);
router.get("/current-user", verifyToken, getCurrentUser);
router.patch("/current-user", verifyToken, updateCurrentUser);
router.post("/current-user/password/request-otp", verifyToken, requestCurrentUserPasswordOtp);
router.patch("/current-user/password", verifyToken, changeCurrentUserPassword);
router.post("/forget-password", forgetpasswordController);
router.post("/reset-password/:token", resetPasswordController);
export default router;
