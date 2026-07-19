import { z } from "zod";

// 登录用户名的格式校验，注册（auth.controller）、改自己的用户名、admin 改别人的用户名共用
export const usernameSchema = z
  .string()
  .min(3, "用户名至少 3 位")
  .max(32, "用户名最多 32 位")
  .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字、下划线");
