import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as e from "../controllers/expense.controller";

const router = Router({ mergeParams: true });

router.get("/", asyncHandler(e.listExpenseRecords));
router.post("/", asyncHandler(e.createExpenseRecord));
router.put("/:id", asyncHandler(e.updateExpenseRecord));
router.delete("/:id", asyncHandler(e.deleteExpenseRecord));

export default router;
