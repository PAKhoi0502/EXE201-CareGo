import express from "express";
import {
  adminCreateCompanion,
  adminGetCompanions,
  adminUpdateCompanion,
  adminUpdateCompanionStatus,
  getCompanionReviews,
  getCompanionOnlineStatuses,
  getCompanionById,
  getCompanions,
  registerCompanion,
} from "../controller/companion.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.get("/", getCompanions);
router.post("/register", registerCompanion);
router.get("/online-statuses", verifyToken, getCompanionOnlineStatuses);
router.get("/admin/all", verifyToken, allowRoles("admin"), adminGetCompanions);
router.get(
  "/:id/reviews",
  verifyToken,
  allowRoles("customer", "admin"),
  getCompanionReviews,
);
router.get("/:id", getCompanionById);
router.post("/", verifyToken, allowRoles("admin"), adminCreateCompanion);
router.put("/:id", verifyToken, allowRoles("admin"), adminUpdateCompanion);
router.patch(
  "/:id/status",
  verifyToken,
  allowRoles("admin"),
  adminUpdateCompanionStatus,
);

export default router;
