import express from "express";
import {
  adminCreateCompanion,
  adminGetCompanions,
  adminUpdateCompanion,
  adminUpdateCompanionStatus,
  applyForCompanion,
  getCompanionReviews,
  getCompanionOnlineStatuses,
  getCompanionById,
  getCompanions,
  requestMyCompanionPhoneOtp,
  updateMyCompanionProfile,
  verifyMyCompanionPhoneOtp,
} from "../controller/companion.controller.js";
import { optionalVerifyToken, verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.get("/", optionalVerifyToken, getCompanions);
router.get("/online-statuses", verifyToken, getCompanionOnlineStatuses);
router.post("/me/apply", verifyToken, allowRoles("customer"), applyForCompanion);
router.patch("/me", verifyToken, allowRoles("companion"), updateMyCompanionProfile);
router.post("/me/phone-otp/request", verifyToken, allowRoles("companion"), requestMyCompanionPhoneOtp);
router.post("/me/phone-otp/verify", verifyToken, allowRoles("companion"), verifyMyCompanionPhoneOtp);
router.get("/admin/all", verifyToken, allowRoles("admin"), adminGetCompanions);
router.get(
  "/:id/reviews",
  verifyToken,
  allowRoles("customer", "admin"),
  getCompanionReviews,
);
router.get("/:id", optionalVerifyToken, getCompanionById);
router.post("/", verifyToken, allowRoles("admin"), adminCreateCompanion);
router.put("/:id", verifyToken, allowRoles("admin"), adminUpdateCompanion);
router.patch(
  "/:id/status",
  verifyToken,
  allowRoles("admin"),
  adminUpdateCompanionStatus,
);

export default router;
