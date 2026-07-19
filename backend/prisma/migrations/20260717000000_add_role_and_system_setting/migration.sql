-- 支持"单用户/多用户"模式切换：
-- - User 新增 role（ADMIN/USER），历史数据里最早注册的那个账号（即当初 ensureDefaultAdmin
--   创建的默认管理员）回填为 ADMIN，其余账号都是 USER。
-- - 新增 SystemSetting 单例表，multiUserEnabled 默认 false（单用户模式，ADMIN 能看到全部数据，
--   /register 接口拒绝新注册），由 ADMIN 在设置页里主动开启后才切换成多用户隔离。

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

UPDATE "User" SET "role" = 'ADMIN'
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "multiUserEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SystemSetting" ("id", "multiUserEnabled") VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
