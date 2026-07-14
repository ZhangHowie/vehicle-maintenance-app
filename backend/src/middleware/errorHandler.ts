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
    // 其它已知 Prisma 错误码（如外键约束 P2003、字段超长 P2000 等）之前会落到最下面
    // 笼统的“服务器内部错误”，客户端完全看不出问题出在哪。这里把 code 和 meta 一并
    // 返回，方便排查（这是自托管的单用户系统，不是面向陌生公网用户的多租户服务，
    // 暴露具体错误码的收益大于风险）。
    return res.status(400).json({ message: `数据库操作失败（${err.code}）：${err.message.split("\n").pop()?.trim() ?? err.message}` });
  }
  // Decimal 精度溢出、字段类型不匹配（比如把小数写进 Int 字段）等会抛这个，
  // 同样属于“请求数据有问题”而不是服务器本身的错误，归类成 400 更准确，
  // 也把具体原因带回去，而不是一律显示“服务器内部错误”让人无从下手。
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error("[Prisma 校验失败]", err.message);
    const firstLine = err.message.split("\n").find((l: string) => l.trim().length > 0) ?? err.message;
    return res.status(400).json({ message: `数据格式不符合数据库要求：${firstLine.trim()}` });
  }
  console.error(err);
  return res.status(500).json({ message: "服务器内部错误，请查看后端日志（docker compose logs backend）获取详情" });
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
