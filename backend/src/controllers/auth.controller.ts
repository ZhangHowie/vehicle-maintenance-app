import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { getClientIp } from "../middleware/blacklist";
import { hashPassword, verifyPassword, isStrongPassword, generateRandomToken } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { sendPasswordResetEmail } from "../utils/mailer";
import { generateTotpSecret, generateQrCodeDataUrl, verifyTotpToken } from "../utils/totp";
import { isMultiUserEnabled } from "../utils/scope";
import { usernameSchema } from "../utils/validation";

const registerSchema = z.object({
  username: usernameSchema,
  // 邮箱可选，只用于找回密码；不填的话就没有找回密码入口
  email: z.string().email("邮箱格式不正确").optional().or(z.literal("").transform(() => undefined)),
  password: z.string().min(8, "密码至少 8 位"),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// IP 异常检测阈值：15 分钟内失败次数超过该值则拉黑该 IP
const IP_ABUSE_WINDOW_MINUTES = 15;
const IP_ABUSE_MAX_FAILURES = 20;
const IP_BLACKLIST_MINUTES = 60;

async function recordLoginAttempt(params: { userId?: string; identifier: string; ip: string; success: boolean }) {
  await prisma.loginAttempt.create({ data: params });

  if (!params.success) {
    const since = new Date(Date.now() - IP_ABUSE_WINDOW_MINUTES * 60 * 1000);
    const failures = await prisma.loginAttempt.count({
      where: { ip: params.ip, success: false, createdAt: { gte: since } },
    });
    if (failures >= IP_ABUSE_MAX_FAILURES) {
      await prisma.ipBlacklist.upsert({
        where: { ip: params.ip },
        update: { expiresAt: new Date(Date.now() + IP_BLACKLIST_MINUTES * 60 * 1000), reason: "登录失败次数过多，疑似暴力破解" },
        create: {
          ip: params.ip,
          reason: "登录失败次数过多，疑似暴力破解",
          expiresAt: new Date(Date.now() + IP_BLACKLIST_MINUTES * 60 * 1000),
        },
      });
    }
  }
}

function issueTokens(userId: string) {
  return {
    accessToken: signAccessToken({ userId }),
    refreshToken: signRefreshToken({ userId }),
  };
}

function toUserResponse(user: {
  id: string;
  username: string;
  email: string | null;
  role: "ADMIN" | "USER";
  totpEnabled: boolean;
  mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    totpEnabled: user.totpEnabled,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function register(req: Request, res: Response) {
  // 默认单用户模式下不开放注册，只有 ADMIN 在设置里主动开启多用户之后才允许
  if (!(await isMultiUserEnabled())) {
    throw new ApiError(403, "多用户功能未开启，暂不支持注册新账号，请联系管理员在设置中开启");
  }
  const body = registerSchema.parse(req.body);
  if (!isStrongPassword(body.password)) {
    throw new ApiError(400, "密码至少 8 位，且需包含大小写字母和数字");
  }
  const existingUsername = await prisma.user.findUnique({ where: { username: body.username } });
  if (existingUsername) throw new ApiError(409, "该用户名已被注册");
  if (body.email) {
    const existingEmail = await prisma.user.findUnique({ where: { email: body.email } });
    if (existingEmail) throw new ApiError(409, "该邮箱已被注册");
  }

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: { username: body.username, email: body.email ?? null, passwordHash },
  });
  const tokens = issueTokens(user.id);
  res.status(201).json({ user: toUserResponse(user), ...tokens });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  const ip = getClientIp(req);
  const user = await prisma.user.findUnique({ where: { username: body.username } });

  if (!user) {
    await recordLoginAttempt({ identifier: body.username, ip, success: false });
    throw new ApiError(401, "用户名或密码错误");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(423, `账号已被临时锁定，请 ${minutesLeft} 分钟后再试`);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= env.loginMaxAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock ? new Date(Date.now() + env.loginLockMinutes * 60 * 1000) : null,
      },
    });
    await recordLoginAttempt({ userId: user.id, identifier: body.username, ip, success: false });
    if (shouldLock) {
      throw new ApiError(423, `失败次数过多，账号已锁定 ${env.loginLockMinutes} 分钟`);
    }
    throw new ApiError(401, "用户名或密码错误");
  }

  // 密码正确，重置失败计数
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await recordLoginAttempt({ userId: user.id, identifier: body.username, ip, success: true });

  if (user.totpEnabled) {
    const preAuthToken = jwt.sign({ userId: user.id, purpose: "totp" }, env.jwtAccessSecret, { expiresIn: "5m" });
    return res.json({ requiresTotp: true, preAuthToken });
  }

  const tokens = issueTokens(user.id);
  res.json({ user: toUserResponse(user), ...tokens });
}

export async function loginTotp(req: Request, res: Response) {
  const schema = z.object({ preAuthToken: z.string(), code: z.string().length(6) });
  const body = schema.parse(req.body);

  let payload: { userId: string; purpose: string };
  try {
    payload = jwt.verify(body.preAuthToken, env.jwtAccessSecret) as typeof payload;
  } catch {
    throw new ApiError(401, "验证已过期，请重新登录");
  }
  if (payload.purpose !== "totp") throw new ApiError(401, "无效的验证请求");

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.totpSecret) throw new ApiError(401, "无效的验证请求");

  const ok = verifyTotpToken(user.totpSecret, body.code);
  if (!ok) throw new ApiError(401, "验证码不正确");

  const tokens = issueTokens(user.id);
  res.json({ user: toUserResponse(user), ...tokens });
}

export async function refresh(req: Request, res: Response) {
  const schema = z.object({ refreshToken: z.string() });
  const { refreshToken } = schema.parse(req.body);
  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokens = issueTokens(payload.userId);
    res.json(tokens);
  } catch {
    throw new ApiError(401, "刷新令牌无效或已过期，请重新登录");
  }
}

export async function forgotPassword(req: Request, res: Response) {
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });

  // 无论用户是否存在都返回同样的响应，避免邮箱枚举
  if (user) {
    const token = generateRandomToken(24);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const resetUrl = `${env.frontendOrigin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    await sendPasswordResetEmail(email, resetUrl);
  }
  res.json({ message: "如果该邮箱已注册，我们已发送重置密码邮件" });
}

export async function resetPassword(req: Request, res: Response) {
  const schema = z.object({
    email: z.string().email(),
    token: z.string(),
    newPassword: z.string().min(8),
  });
  const body = schema.parse(req.body);
  if (!isStrongPassword(body.newPassword)) {
    throw new ApiError(400, "密码至少 8 位，且需包含大小写字母和数字");
  }

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.resetToken || user.resetToken !== body.token || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw new ApiError(400, "重置链接无效或已过期");
  }

  const passwordHash = await hashPassword(body.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpires: null, failedLoginCount: 0, lockedUntil: null },
  });
  res.json({ message: "密码已重置，请使用新密码登录" });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  res.json(toUserResponse(user));
}

export async function updateMe(req: Request, res: Response) {
  const schema = z.object({ username: usernameSchema });
  const { username } = schema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== req.userId) throw new ApiError(409, "该用户名已被使用");
  const user = await prisma.user.update({ where: { id: req.userId! }, data: { username } });
  res.json(toUserResponse(user));
}

export async function changePassword(req: Request, res: Response) {
  const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) });
  const body = schema.parse(req.body);
  if (!isStrongPassword(body.newPassword)) {
    throw new ApiError(400, "密码至少 8 位，且需包含大小写字母和数字");
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(401, "当前密码不正确");
  const passwordHash = await hashPassword(body.newPassword);
  // 改密成功后清除强制改密标记
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
  res.json({ message: "密码已修改" });
}

// ===== 两步验证 (TOTP) =====

export async function totpSetup(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const secret = generateTotpSecret(user.email ?? user.username);
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret.base32, totpEnabled: false } });
  const qrCode = await generateQrCodeDataUrl(secret.otpauth_url!);
  res.json({ secret: secret.base32, qrCode });
}

export async function totpEnable(req: Request, res: Response) {
  const schema = z.object({ code: z.string().length(6) });
  const { code } = schema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.totpSecret) throw new ApiError(400, "请先获取验证器密钥");
  if (!verifyTotpToken(user.totpSecret, code)) throw new ApiError(400, "验证码不正确");
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  res.json({ message: "两步验证已开启" });
}

export async function totpDisable(req: Request, res: Response) {
  const schema = z.object({ password: z.string() });
  const { password } = schema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "密码不正确");
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
  res.json({ message: "两步验证已关闭" });
}
