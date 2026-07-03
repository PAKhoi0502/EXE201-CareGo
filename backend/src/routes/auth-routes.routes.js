import express from "express";
import {
  changeCurrentUserPassword,
  changeInitialPassword,
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
import { authRateLimitKeys, createRateLimit } from "../middlleware/rate-limit.middleware.js";

const router = express.Router();

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: authRateLimitKeys.ipAndEmail,
  message: "Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
});

const verifyEmailOtpRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: authRateLimitKeys.ipAndEmail,
  message: "Bạn nhập OTP quá nhiều lần. Vui lòng thử lại sau.",
});

const resendEmailOtpRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: authRateLimitKeys.ipAndEmail,
  message: "Bạn yêu cầu gửi lại OTP quá nhiều lần. Vui lòng thử lại sau.",
});

const forgotPasswordRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: authRateLimitKeys.ipAndEmail,
  message: "Bạn yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau.",
});

const resetPasswordRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: authRateLimitKeys.ipAndResetToken,
  message: "Bạn thử đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau.",
});

const currentUserPasswordOtpRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: authRateLimitKeys.ipAndUser,
  message: "Bạn yêu cầu OTP đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau.",
});

const changeCurrentUserPasswordRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: authRateLimitKeys.ipAndUser,
  message: "Bạn thử đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau.",
});
//express.Router(): được dùng để để tách các route trong ứng dụng thành các module riêng biệt
//giúp quản lý mã nguồn tốt hơn

router.post("/signup", signupController);
router.post("/verify-email", verifyEmailOtpRateLimit, verifyEmailOtpController);
router.post("/resend-otp", resendEmailOtpRateLimit, resendEmailOtpController);
router.post("/login", loginRateLimit, loginController);
router.post("/logout", logoutController);
router.post("/refresh-token", refreshTokenController);
router.get("/current-user", verifyToken, getCurrentUser);
router.patch("/current-user", verifyToken, updateCurrentUser);
router.patch("/current-user/initial-password", verifyToken, changeCurrentUserPasswordRateLimit, changeInitialPassword);
router.post("/current-user/password/request-otp", verifyToken, currentUserPasswordOtpRateLimit, requestCurrentUserPasswordOtp);
router.patch("/current-user/password", verifyToken, changeCurrentUserPasswordRateLimit, changeCurrentUserPassword);
router.post("/forget-password", forgotPasswordRateLimit, forgetpasswordController);
router.post("/reset-password/:token", resetPasswordRateLimit, resetPasswordController);
export default router;
