import express from "express";
import {
  adminCreateCompanion,
  adminUpdateCompanion,
  adminUpdateCompanionStatus,
  getCompanionById,
  getCompanions,
} from "../controller/companion.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.get("/", getCompanions);
router.get("/:id", getCompanionById);
router.post("/", verifyToken, allowRoles("admin"), adminCreateCompanion);
router.put("/:id", verifyToken, allowRoles("admin"), adminUpdateCompanion);
router.patch("/:id/status", verifyToken, allowRoles("admin"), adminUpdateCompanionStatus);

export default router;
