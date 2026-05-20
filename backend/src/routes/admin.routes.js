import express from "express";
import {
  getAdminBookings,
  getAdminDashboard,
  getAdminGpsStatuses,
  getAdminOnlineStatuses,
  getAdminUsers,
  updateUserStatus,
} from "../controller/admin.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/dashboard", getAdminDashboard);
router.get("/users", getAdminUsers);
router.patch("/users/:id/status", updateUserStatus);
router.get("/bookings", getAdminBookings);
router.get("/gps-statuses", getAdminGpsStatuses);
router.get("/online-statuses", getAdminOnlineStatuses);

export default router;
