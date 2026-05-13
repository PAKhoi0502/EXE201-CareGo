import express, { Router } from "express";
import {
  createProfileController,
  infoController,
} from "../controller/profile.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";

const router = express.Router();
//express.Router(): được dùng để để tách các route trong ứng dụng thành các module riêng biệt
//giúp quản lý mã nguồn tốt hơn
//CRUD for profile

router.use(verifyToken);
router.get("/info", verifyToken, infoController);
router.post("/create", createProfileController);


export default router;
