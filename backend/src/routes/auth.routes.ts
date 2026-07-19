import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import * as auth from "../controllers/auth.controller";

const router = Router();

router.post("/register", authLimiter, asyncHandler(auth.register));
router.post("/login", authLimiter, asyncHandler(auth.login));
router.post("/login/totp", authLimiter, asyncHandler(auth.loginTotp));
router.post("/refresh", asyncHandler(auth.refresh));
router.post("/forgot-password", authLimiter, asyncHandler(auth.forgotPassword));
router.post("/reset-password", authLimiter, asyncHandler(auth.resetPassword));

router.get("/me", requireAuth, asyncHandler(auth.me));
router.patch("/me", requireAuth, asyncHandler(auth.updateMe));
router.post("/change-password", requireAuth, asyncHandler(auth.changePassword));
router.post("/totp/setup", requireAuth, asyncHandler(auth.totpSetup));
router.post("/totp/enable", requireAuth, asyncHandler(auth.totpEnable));
router.post("/totp/disable", requireAuth, asyncHandler(auth.totpDisable));

export default router;
