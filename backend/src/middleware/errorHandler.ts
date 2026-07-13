import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("；");
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    console.warn("[验证失败]", formatZodError(err));
    return res.status(400).json({ message: `请求参数不正确：${formatZodError(err)}` });
  }
  if (err instanceof MulterError) {
    return res.status(400).json({ message: `文件上传失败: ${err.message}` });
  }
  if (err instanceof Error && err.message.includes("仅支持")) {
    return res.status(400).json({ message: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[Prisma]", err.code, err.message);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "记录不存在或已被删除" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ message: "数据已存在，违反唯一性约束" });
    }
  }
  console.error(err);
  return res.status(500).json({ message: "服务器内部错误" });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "接口不存在" });
}

// 包装异步路由处理函数，统一捕获异常交给 errorHandler
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
