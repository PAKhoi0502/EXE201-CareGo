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
import { blogRateLimitKeys, createRateLimit, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();
const blogViewRateLimit = createRateLimit({
  windowMs: getPositiveEnvNumber(["CAREGO_BLOG_VIEW_RATE_LIMIT_WINDOW_MS", "BLOG_VIEW_RATE_LIMIT_WINDOW_MS"], 60000),
  max: getPositiveEnvNumber(["CAREGO_BLOG_VIEW_RATE_LIMIT_MAX", "BLOG_VIEW_RATE_LIMIT_MAX"], 30),
  message: "Too many blog view requests, please try again later.",
  keyGenerator: blogRateLimitKeys.ipAndSlug,
});
const blogRatingRateLimit = createRateLimit({
  windowMs: getPositiveEnvNumber(["CAREGO_BLOG_RATING_RATE_LIMIT_WINDOW_MS", "BLOG_RATING_RATE_LIMIT_WINDOW_MS"], 15 * 60 * 1000),
  max: getPositiveEnvNumber(["CAREGO_BLOG_RATING_RATE_LIMIT_MAX", "BLOG_RATING_RATE_LIMIT_MAX"], 5),
  message: "Too many blog rating requests, please try again later.",
  keyGenerator: blogRateLimitKeys.ipAndSlug,
});
const blogCommentRateLimit = createRateLimit({
  windowMs: getPositiveEnvNumber(["CAREGO_BLOG_COMMENT_RATE_LIMIT_WINDOW_MS", "BLOG_COMMENT_RATE_LIMIT_WINDOW_MS"], 10 * 60 * 1000),
  max: getPositiveEnvNumber(["CAREGO_BLOG_COMMENT_RATE_LIMIT_MAX", "BLOG_COMMENT_RATE_LIMIT_MAX"], 3),
  message: "Too many blog comment requests, please try again later.",
  keyGenerator: blogRateLimitKeys.ipAndSlug,
});

router.get("/", getBlogPosts);
router.get("/admin/stats", verifyToken, allowRoles("admin"), getBlogStats);
router.get("/:slug", getBlogPostBySlug);
router.post("/:slug/view", blogViewRateLimit, increaseBlogView);
router.post("/:slug/rating", blogRatingRateLimit, rateBlogPost);
router.post("/:slug/comments", blogCommentRateLimit, commentBlogPost);

export default router;
