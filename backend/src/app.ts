import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { apiLimiter } from "./middleware/rateLimit";
import { blacklistGuard } from "./middleware/blacklist";
import { errorHandler, notFoundHandler, asyncHandler } from "./middleware/errorHandler";
import { APP_VERSION, GIT_COMMIT } from "./version";

import authRoutes from "./routes/auth.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import dataRoutes from "./routes/data.routes";
import statsRoutes from "./routes/stats.routes";

const app = express();

// Express 在 nginx 反向代理之后运行，需要信任第一层代理以正确获取客户端 IP
app.set("trust proxy", 1);

// 健康检查放在最前面，且不依赖数据库，避免数据库瞬时不可用时容器被误判为 unhealthy
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", version: APP_VERSION, commit: GIT_COMMIT })
);

app.use(helmet());
app.use(
  cors({
    origin: env.frontendOrigin === "*" ? true : env.frontendOrigin,
    credentials: true,
  })
);
// 数据导入接口 (/api/data/import) 需要内嵌车辆封面图片的 base64，请求体会比其它接口大得多，
// 单独跳过这里的全局体积限制，改由 data.routes.ts 里针对该路由单独设置更大的 limit。
app.use((req, res, next) => {
  if (req.path === "/api/data/import") return next();
  return express.json({ limit: "2mb" })(req, res, next);
});
// 用 asyncHandler 包裹，避免黑名单查询（数据库调用）出现异常时导致进程崩溃
app.use(asyncHandler(blacklistGuard));
app.use("/api", apiLimiter);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/stats", statsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
