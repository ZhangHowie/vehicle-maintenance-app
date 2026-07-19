import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hashPassword } from "./password";

// 若数据库中还没有任何账号，则自动创建一个默认管理员账号，并要求首次登录后强制修改密码。
// 用户名/密码可通过 .env 中的 ADMIN_USERNAME / ADMIN_PASSWORD 自定义，不设置则使用内置默认值。
// email 是可选的（只用于找回密码），不设置 ADMIN_EMAIL 就不会给默认账号绑定邮箱。
export async function ensureDefaultAdmin(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const passwordHash = await hashPassword(env.adminPassword);
  await prisma.user.create({
    data: {
      username: env.adminUsername,
      email: env.adminEmail ?? null,
      passwordHash,
      mustChangePassword: true,
      role: "ADMIN",
    },
  });

  console.log("========================================");
  console.log("已自动创建默认管理员账号，首次登录后会强制要求修改密码：");
  console.log(`  用户名: ${env.adminUsername}`);
  console.log(`  密码: ${env.adminPassword}`);
  console.log("可通过 .env 中的 ADMIN_USERNAME / ADMIN_PASSWORD 自定义该初始账号。");
  console.log("========================================");
}
