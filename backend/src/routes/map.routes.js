import express from "express";
import { searchMapAddress } from "../controller/map.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { authRateLimitKeys, createRateLimit, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";

const router = express.Router();

const mapSearchRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: getPositiveEnvNumber(["CAREGO_MAP_SEARCH_RATE_LIMIT_PER_MINUTE", "MAP_SEARCH_RATE_LIMIT_PER_MINUTE"], 60),
  message: "Bạn tìm kiếm địa chỉ quá nhiều lần. Vui lòng thử lại sau.",
  keyGenerator: authRateLimitKeys.ipAndUser,
});

router.use(verifyToken);

router.get("/search", mapSearchRateLimit, searchMapAddress);

export default router;
