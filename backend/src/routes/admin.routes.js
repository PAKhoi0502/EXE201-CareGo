import express from "express";
import {
  getAdminBookings,
  getAdminDashboard,
  getAdminGpsStatuses,
  getAdminOnlineStatuses,
  getAdminReports,
  getAdminUsers,
  updateUserStatus,
} from "../controller/admin.controller.js";
import {
  createAdminBlog,
  deleteAdminBlogComment,
  deleteAdminBlog,
  getAdminBlogComments,
  getAdminBlogs,
  publishAdminBlog,
  unpublishAdminBlog,
  updateAdminBlogCommentStatus,
  updateAdminBlog,
} from "../controller/blog.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";
import { getAdminAuditLogs } from "../controller/audit-log.controller.js";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/dashboard", getAdminDashboard);
router.get("/users", getAdminUsers);
router.patch("/users/:id/status", updateUserStatus);
router.get("/bookings", getAdminBookings);
router.get("/reports", getAdminReports);
router.get("/gps-statuses", getAdminGpsStatuses);
router.get("/online-statuses", getAdminOnlineStatuses);
router.get("/audit-logs", getAdminAuditLogs);
router.get("/blogs", getAdminBlogs);
router.post("/blogs", createAdminBlog);
router.get("/blogs/:id/comments", getAdminBlogComments);
router.patch("/blogs/:id/comments/:commentId", updateAdminBlogCommentStatus);
router.delete("/blogs/:id/comments/:commentId", deleteAdminBlogComment);
router.patch("/blogs/:id", updateAdminBlog);
router.delete("/blogs/:id", deleteAdminBlog);
router.patch("/blogs/:id/publish", publishAdminBlog);
router.patch("/blogs/:id/unpublish", unpublishAdminBlog);

export default router;
