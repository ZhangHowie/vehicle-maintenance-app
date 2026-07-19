# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
# 构建阶段也需要 openssl，否则 `prisma generate` 检测不到真实 OpenSSL 版本，
# 会默认按 openssl-1.1.x 生成查询引擎，与运行阶段实际的 openssl-3.0.x 不匹配，
# 导致运行时报 PrismaClientInitializationError。
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
# 在这里（而不是在 runtime stage）把 devDependencies 剪掉，runtime 直接 COPY 这份
# node_modules。原因：GitHub Actions 用 QEMU 模拟构建 linux/arm64 时，runtime stage 里
# 第二次跑完整 `npm install --omit=dev`（要跑几百个包的下载/链接/脚本）高概率触发
# "qemu: uncaught target signal 4 (Illegal instruction)" 导致 arm64 构建失败；
# prune 只做本地文件删除，轻量得多，QEMU 下不容易崩。
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# CI 构建时通过 --build-arg GIT_COMMIT=<sha> 注入，暴露在 /api/health 里，
# 方便确认 NAS 上跑的镜像是不是已经拉到了最新的一次推送（见 src/version.ts）。
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
RUN apk add --no-cache openssl
COPY package.json ./
COPY --from=build /app/dist ./dist
# node_modules 在 build stage 已经 prune 过（含 .prisma/@prisma 的引擎产物），直接整体拷贝
COPY --from=build /app/node_modules ./node_modules
COPY prisma ./prisma
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
