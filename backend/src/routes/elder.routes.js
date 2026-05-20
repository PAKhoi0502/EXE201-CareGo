import express from "express";
import {
  createElderProfile,
  deleteElderProfile,
  getElderProfileById,
  getMyElderProfiles,
  updateElderProfile,
} from "../controller/elder.controller.js";
import { verifyToken } from "../middlleware/auth.middleware.js";
import { allowRoles } from "../middlleware/role.middleware.js";

const router = express.Router();

router.use(verifyToken, allowRoles("customer"));

router.post("/", createElderProfile);
router.get("/my", getMyElderProfiles);
router.get("/:id", getElderProfileById);
router.put("/:id", updateElderProfile);
router.delete("/:id", deleteElderProfile);

export default router;
