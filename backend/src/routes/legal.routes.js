import express from "express";
import { getLegalDocument, getLegalRequirementsByFlow } from "../controller/legal.controller.js";

const router = express.Router();

router.get("/requirements/:flow", getLegalRequirementsByFlow);
router.get("/documents/:slug", getLegalDocument);

export default router;
