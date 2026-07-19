import { prisma } from "../config/prisma";
import { Role } from "@prisma/client";

// 全局设置存在单例表的固定一行（id=1），懒创建：不存在就按默认值（关闭多用户）建一行。
async function getSystemSetting() {
  return prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function isMultiUserEnabled(): Promise<boolean> {
  const setting = await getSystemSetting();
  return setting.multiUserEnabled;
}

export async function setMultiUserEnabled(enabled: boolean): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: { multiUserEnabled: enabled },
    create: { id: 1, multiUserEnabled: enabled },
  });
}

// 单用户模式（未开启多用户）下，ADMIN 账号能读取系统里所有账号的数据；
// 其它任何情况（普通账号、或已开启多用户）都严格按 userId 隔离。
export async function canAccessAllUsers(userRole: Role | undefined): Promise<boolean> {
  if (userRole !== "ADMIN") return false;
  return !(await isMultiUserEnabled());
}

// 车辆列表 / 统计 / 导出等查询车辆集合时使用：能看全部时不加 userId 过滤，否则只看自己的。
export async function buildVehicleWhere(userId: string, userRole: Role | undefined): Promise<{ userId?: string }> {
  return (await canAccessAllUsers(userRole)) ? {} : { userId };
}

// 校验"某辆车（或其子记录归属的那辆车）能否被当前用户访问"：本人的数据始终可以，
// 否则只有单用户模式下的 ADMIN 才被允许。
export async function canAccessVehicleOwnedBy(
  currentUserId: string,
  currentUserRole: Role | undefined,
  vehicleOwnerId: string
): Promise<boolean> {
  if (vehicleOwnerId === currentUserId) return true;
  return canAccessAllUsers(currentUserRole);
}
