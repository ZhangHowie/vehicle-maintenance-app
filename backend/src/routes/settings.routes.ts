import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import * as settings from "../controllers/settings.controller";

const router = Router();

router.get("/public", asyncHandler(settings.getPublicSettings));
router.get("/", requireAuth, requireAdmin, asyncHandler(settings.getSettings));
router.patch("/", requireAuth, requireAdmin, asyncHandler(settings.updateSettings));

export default router;
