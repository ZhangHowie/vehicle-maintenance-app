-- 登录改用用户名而不是邮箱：新增 username（唯一、必填），email 改为可选（仅用于找回密码）。
-- 已有账号没有 username，用邮箱 @ 前缀 + id 片段回填，保证唯一（同前缀邮箱不会冲突）。
ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User"
SET "username" = COALESCE(NULLIF(split_part("email", '@', 1), ''), 'user') || '_' || substr(replace("id", '-', ''), 1, 6)
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- LoginAttempt.email 语义上现在存的是"登录时输入的账号名"（username），改名避免误导
ALTER TABLE "LoginAttempt" RENAME COLUMN "email" TO "identifier";
ALTER INDEX "LoginAttempt_email_createdAt_idx" RENAME TO "LoginAttempt_identifier_createdAt_idx";
