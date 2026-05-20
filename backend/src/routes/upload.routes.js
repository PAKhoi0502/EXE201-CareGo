import express from "express";
import multer from "multer";
import { uploadImageController } from "../controller/upload.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post("/image", verifyToken, upload.single("image"), uploadImageController);

export default router;
