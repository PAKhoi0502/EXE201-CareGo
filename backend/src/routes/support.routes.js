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
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.post("/conversations", allowRoles("customer", "companion"), createSupportConversation);
router.get("/my-conversations", allowRoles("customer", "companion"), getMySupportConversations);
router.get("/admin/conversations", allowRoles("admin"), getAdminSupportConversations);
router.get("/conversations/:id/messages", allowRoles("customer", "companion", "admin"), getSupportMessages);
router.post("/conversations/:id/messages", allowRoles("customer", "companion", "admin"), sendSupportMessage);
router.patch("/admin/conversations/:id", allowRoles("admin"), updateSupportConversation);

export default router;
