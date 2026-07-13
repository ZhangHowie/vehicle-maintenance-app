import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "./errorHandler";

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// 拦截黑名单 IP。命中未过期的黑名单记录时直接 403。
export async function blacklistGuard(req: Request, _res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  (req as any).clientIp = ip;

  const entry = await prisma.ipBlacklist.findUnique({ where: { ip } });
  if (entry && (!entry.expiresAt || entry.expiresAt > new Date())) {
    return next(new ApiError(403, "您的 IP 已被封禁，请稍后再试或联系管理员"));
  }
  next();
}

export { getClientIp };
