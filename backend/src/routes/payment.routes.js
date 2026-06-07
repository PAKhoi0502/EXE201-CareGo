import express from "express";
import { handlePayOSWebhook, syncPayOSPayment } from "../controller/payment.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.post("/payos/sync", verifyToken, allowRoles("customer", "admin"), syncPayOSPayment);
router.post("/payos/webhook", handlePayOSWebhook);

export default router;
