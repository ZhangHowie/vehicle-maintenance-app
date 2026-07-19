import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";
import { hashPassword, isStrongPassword } from "../utils/password";
import { usernameSchema } from "../utils/validation";

// 仅 ADMIN 可访问：查看/管理系统里所有账号，用于"设置 > 用户管理"页面。
export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { vehicles: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      vehicleCount: u._count.vehicles,
    }))
  );
}

export async function updateUser(req: Request, res: Response) {
  const schema = z.object({
    username: usernameSchema.optional(),
    newPassword: z.string().min(8).optional(),
  });
  const body = schema.parse(req.body);
  if (!body.username && !body.newPassword) {
    throw new ApiError(400, "请提供要修改的用户名或密码");
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new ApiError(404, "账号不存在");

  const data: { username?: string; passwordHash?: string; mustChangePassword?: boolean } = {};

  if (body.username && body.username !== target.username) {
    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) throw new ApiError(409, "该用户名已被使用");
    data.username = body.username;
  }

  if (body.newPassword) {
    if (!isStrongPassword(body.newPassword)) {
      throw new ApiError(400, "密码至少 8 位，且需包含大小写字母和数字");
    }
    data.passwordHash = await hashPassword(body.newPassword);
    // 管理员代改密码，下次登录强制要求本人再改一次，避免管理员一直知道当前密码
    data.mustChangePassword = true;
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data });
  res.json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    role: updated.role,
    createdAt: updated.createdAt,
  });
}

export async function deleteUser(req: Request, res: Response) {
  if (req.params.id === req.userId) {
    throw new ApiError(400, "不能删除自己当前登录的账号");
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new ApiError(404, "账号不存在");
  // Vehicle.userId 是 onDelete: Cascade，删除账号会连带删掉这个账号名下的车辆和记录
  await prisma.user.delete({ where: { id: target.id } });
  res.status(204).send();
}
