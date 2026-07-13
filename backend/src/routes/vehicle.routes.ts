import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { uploadCoverImage } from "../middleware/upload";
import * as vehicle from "../controllers/vehicle.controller";
import maintenanceRouter from "./maintenance.routes";
import fuelRouter from "./fuel.routes";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(vehicle.listVehicles));
router.post("/", asyncHandler(vehicle.createVehicle));
router.get("/:id", asyncHandler(vehicle.getVehicle));
router.put("/:id", asyncHandler(vehicle.updateVehicle));
router.delete("/:id", asyncHandler(vehicle.deleteVehicle));
router.post("/:id/cover", uploadCoverImage.single("file"), asyncHandler(vehicle.uploadCover));

router.use("/:vehicleId/maintenance-records", maintenanceRouter);
router.use("/:vehicleId/fuel-records", fuelRouter);

export default router;
