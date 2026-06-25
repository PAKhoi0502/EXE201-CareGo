import express from "express";
import {
  addLocation,
  cancelBooking,
  createBooking,
  createReview,
  getBookingById,
  getMyBookings,
  payBooking,
  updateBookingStatus,
  updateShiftLog,
} from "../controller/booking.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { requireApprovedCompanion } from "../middlleware/companion-approval.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", allowRoles("customer"), createBooking);
router.get("/my", allowRoles("customer", "companion"), getMyBookings);
router.get("/:id", allowRoles("customer", "companion", "admin"), getBookingById);
router.patch(
  "/:id/status",
  allowRoles("companion", "admin"),
  requireApprovedCompanion,
  updateBookingStatus,
);
router.patch("/:id/cancel", allowRoles("customer", "admin"), cancelBooking);
router.post(
  "/:id/location",
  allowRoles("companion", "admin"),
  requireApprovedCompanion,
  addLocation,
);
router.patch(
  "/:id/shift-log",
  allowRoles("companion", "admin"),
  requireApprovedCompanion,
  updateShiftLog,
);
router.post("/:id/pay", allowRoles("customer"), payBooking);
router.post("/:id/review", allowRoles("customer"), createReview);

export default router;
