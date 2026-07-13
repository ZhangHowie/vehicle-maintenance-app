import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// 全局 API 限流
export const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "请求过于频繁，请稍后再试" },
});

// 登录/注册等敏感接口的更严格限流，防止暴力破解
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "尝试次数过多，请稍后再试" },
});
