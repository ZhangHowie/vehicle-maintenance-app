import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import * as data from "../controllers/data.controller";

const router = Router();
router.use(requireAuth);

router.get("/export", asyncHandler(data.exportData));
router.post("/import", asyncHandler(data.importData));

export default router;
