import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import * as stats from "../controllers/stats.controller";

const router = Router();
router.use(requireAuth);

router.get("/overview", asyncHandler(stats.overview));

export default router;
