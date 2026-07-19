import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import * as users from "../controllers/users.controller";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", asyncHandler(users.listUsers));
router.patch("/:id", asyncHandler(users.updateUser));
router.delete("/:id", asyncHandler(users.deleteUser));

export default router;
