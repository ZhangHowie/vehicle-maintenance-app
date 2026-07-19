import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "./errorHandler";
import { prisma } from "../config/prisma";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "未登录或登录已过期"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    // 顺带查一下 role：单/多用户模式判断（buildVehicleWhere 等）需要知道当前请求者是不是 ADMIN，
    // 查询用户是否还存在也顺便挡掉了"token 有效但账号已被删除"这种边界情况。
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } });
    if (!user) return next(new ApiError(401, "登录已过期，请重新登录"));
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    next(new ApiError(401, "登录已过期，请重新登录"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.userRole !== "ADMIN") return next(new ApiError(403, "仅管理员账号可执行此操作"));
  next();
}
