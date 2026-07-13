import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as m from "../controllers/maintenance.controller";

const router = Router({ mergeParams: true });

router.get("/", asyncHandler(m.listMaintenanceRecords));
router.post("/", asyncHandler(m.createMaintenanceRecord));
router.put("/:id", asyncHandler(m.updateMaintenanceRecord));
router.delete("/:id", asyncHandler(m.deleteMaintenanceRecord));

export default router;
