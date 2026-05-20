import express from "express";
import {
  createService,
  deleteService,
  getServices,
  updateService,
} from "../controller/service.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.get("/", getServices);
router.post("/", verifyToken, allowRoles("admin"), createService);
router.put("/:id", verifyToken, allowRoles("admin"), updateService);
router.delete("/:id", verifyToken, allowRoles("admin"), deleteService);

export default router;
