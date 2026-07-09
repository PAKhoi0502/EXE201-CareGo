import express from "express";
import {
  createWithdrawalRequest,
  getAdminWithdrawalRequestDetail,
  getAdminWithdrawalRequests,
  getMyEarnings,
  getMyWithdrawalSummary,
  updateWithdrawalStatus,
} from "../controller/withdrawal.controller.js";
import { requireApprovedCompanion } from "../middlleware/companion-approval.middleware.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.get("/my", verifyToken, allowRoles("companion"), requireApprovedCompanion, getMyWithdrawalSummary);
router.get("/earnings", verifyToken, allowRoles("companion"), requireApprovedCompanion, getMyEarnings);
router.post("/", verifyToken, allowRoles("companion"), requireApprovedCompanion, createWithdrawalRequest);
router.get("/admin", verifyToken, allowRoles("admin"), getAdminWithdrawalRequests);
router.get("/admin/:id", verifyToken, allowRoles("admin"), getAdminWithdrawalRequestDetail);
router.patch("/admin/:id/status", verifyToken, allowRoles("admin"), updateWithdrawalStatus);
router.get("/", verifyToken, allowRoles("admin"), getAdminWithdrawalRequests);

export default router;
