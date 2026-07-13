import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hashPassword } from "./password";

// 若数据库中还没有任何账号，则自动创建一个默认管理员账号，并要求首次登录后强制修改密码。
// 邮箱/密码可通过 .env 中的 ADMIN_EMAIL / ADMIN_PASSWORD 自定义，不设置则使用内置默认值。
export async function ensureDefaultAdmin(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const passwordHash = await hashPassword(env.adminPassword);
  await prisma.user.create({
    data: {
      email: env.adminEmail,
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log("========================================");
  console.log("已自动创建默认管理员账号，首次登录后会强制要求修改密码：");
  console.log(`  邮箱: ${env.adminEmail}`);
  console.log(`  密码: ${env.adminPassword}`);
  console.log("可通过 .env 中的 ADMIN_EMAIL / ADMIN_PASSWORD 自定义该初始账号。");
  console.log("========================================");
}
