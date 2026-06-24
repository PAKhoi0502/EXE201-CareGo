import express from "express";
import {
  createSupportConversation,
  getAdminSupportConversations,
  getMySupportConversations,
  getSupportMessages,
  sendSupportMessage,
  updateSupportConversation,
} from "../controller/support.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { chatRateLimitKeys, createRateLimit, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();
const supportConversationRateLimit = createRateLimit({
  windowMs: getPositiveEnvNumber(
    ["CAREGO_SUPPORT_CONVERSATION_RATE_LIMIT_WINDOW_MS", "SUPPORT_CONVERSATION_RATE_LIMIT_WINDOW_MS"],
    10 * 60 * 1000,
  ),
  max: getPositiveEnvNumber(["CAREGO_SUPPORT_CONVERSATION_RATE_LIMIT_MAX", "SUPPORT_CONVERSATION_RATE_LIMIT_MAX"], 5),
  message: "Bạn đang tạo yêu cầu hỗ trợ quá nhanh. Vui lòng thử lại sau.",
  keyGenerator: chatRateLimitKeys.user,
});
const supportMessageRateLimit = createRateLimit({
  windowMs: getPositiveEnvNumber(["CAREGO_CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS", "CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS"], 60000),
  max: getPositiveEnvNumber(["CAREGO_CHAT_MESSAGE_RATE_LIMIT_MAX", "CHAT_MESSAGE_RATE_LIMIT_MAX"], 20),
  message: "Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau.",
  keyGenerator: chatRateLimitKeys.userAndConversation,
});

router.use(verifyToken);
router.post("/conversations", allowRoles("customer", "companion"), supportConversationRateLimit, createSupportConversation);
router.get("/my-conversations", allowRoles("customer", "companion"), getMySupportConversations);
router.get("/admin/conversations", allowRoles("admin"), getAdminSupportConversations);
router.get("/conversations/:id/messages", allowRoles("customer", "companion", "admin"), getSupportMessages);
router.post("/conversations/:id/messages", allowRoles("customer", "companion", "admin"), supportMessageRateLimit, sendSupportMessage);
router.patch("/admin/conversations/:id", allowRoles("admin"), updateSupportConversation);

export default router;
