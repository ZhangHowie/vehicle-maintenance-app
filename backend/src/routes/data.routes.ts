import { Router, json } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import * as data from "../controllers/data.controller";

const router = Router();
router.use(requireAuth);

router.get("/export", asyncHandler(data.exportData));
// 导入的请求体会内嵌车辆封面图片的 base64，比一般接口大得多（app.ts 里已经把全局
// body 体积限制对这个路径放行了），这里单独给一个更大的上限，足够装下多辆车、
// 每辆车一张 8MB 封面图片，base64 编码后体积膨胀约 1.37 倍，留了一些余量。
router.post("/import", json({ limit: "50mb" }), asyncHandler(data.importData));

export default router;
