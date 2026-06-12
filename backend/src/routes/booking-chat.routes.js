import express from "express";
import {
  getActiveBookingChats,
  getBookingChatMessages,
  sendBookingChatMessage,
} from "../controller/booking-chat.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(allowRoles("customer", "companion"));
router.get("/active", getActiveBookingChats);
router.get("/:bookingId/messages", getBookingChatMessages);
router.post("/:bookingId/messages", sendBookingChatMessage);

export default router;
