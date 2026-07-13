import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as f from "../controllers/fuel.controller";

const router = Router({ mergeParams: true });

router.get("/", asyncHandler(f.listFuelRecords));
router.get("/stats", asyncHandler(f.fuelStats));
router.post("/", asyncHandler(f.createFuelRecord));
router.put("/:id", asyncHandler(f.updateFuelRecord));
router.delete("/:id", asyncHandler(f.deleteFuelRecord));

export default router;
