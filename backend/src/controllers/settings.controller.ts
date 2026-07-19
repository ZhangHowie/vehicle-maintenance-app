import { Request, Response } from "express";
import { z } from "zod";
import { isMultiUserEnabled, setMultiUserEnabled } from "../utils/scope";

// 公开接口：登录/注册页需要在未登录状态下知道要不要显示"注册新账号"入口
export async function getPublicSettings(_req: Request, res: Response) {
  res.json({ multiUserEnabled: await isMultiUserEnabled() });
}

// 仅 ADMIN：设置页里读取/切换多用户模式
export async function getSettings(_req: Request, res: Response) {
  res.json({ multiUserEnabled: await isMultiUserEnabled() });
}

export async function updateSettings(req: Request, res: Response) {
  const schema = z.object({ multiUserEnabled: z.boolean() });
  const { multiUserEnabled } = schema.parse(req.body);
  await setMultiUserEnabled(multiUserEnabled);
  res.json({ multiUserEnabled });
}
