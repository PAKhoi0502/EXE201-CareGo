import express from "express";
import {
  getActiveBookingChats,
  getBookingChatMessages,
  sendBookingChatMessage,
} from "../controller/booking-chat.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { requireApprovedCompanion } from "../middlleware/companion-approval.middleware.js";
import { chatRateLimitKeys, createRateLimit, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();
const bookingChatMessageRateLimit = createRateLimit({
  windowMs: getPositiveEnvNumber(["CAREGO_CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS", "CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS"], 60000),
  max: getPositiveEnvNumber(["CAREGO_CHAT_MESSAGE_RATE_LIMIT_MAX", "CHAT_MESSAGE_RATE_LIMIT_MAX"], 20),
  message: "Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau.",
  keyGenerator: chatRateLimitKeys.userAndBooking,
});

router.use(verifyToken);
router.use(allowRoles("customer", "companion"));
router.use(requireApprovedCompanion);
router.get("/active", getActiveBookingChats);
router.get("/:bookingId/messages", getBookingChatMessages);
router.post("/:bookingId/messages", bookingChatMessageRateLimit, sendBookingChatMessage);

export default router;
