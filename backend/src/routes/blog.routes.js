import express from "express";
import {
  commentBlogPost,
  getBlogPostBySlug,
  getBlogPosts,
  getBlogStats,
  increaseBlogView,
  rateBlogPost,
} from "../controller/blog.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.get("/", getBlogPosts);
router.get("/admin/stats", verifyToken, allowRoles("admin"), getBlogStats);
router.get("/:slug", getBlogPostBySlug);
router.post("/:slug/view", increaseBlogView);
router.post("/:slug/rating", rateBlogPost);
router.post("/:slug/comments", commentBlogPost);

export default router;
