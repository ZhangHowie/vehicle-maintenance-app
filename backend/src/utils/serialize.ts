import { Prisma } from "@prisma/client";

// Prisma 的 Decimal 字段（如金额、加油量）默认序列化为字符串，会导致前端表单回填后
// 再次提交时把数字变成字符串，被 zod 的 z.number() 校验拒绝。
// 这里递归地把响应对象里所有 Decimal 实例转换成普通的 JS number，再返回给前端。
export function toPlain<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return Number(value) as unknown as T;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toPlain(val);
    }
    return out as T;
  }
  return value;
}
