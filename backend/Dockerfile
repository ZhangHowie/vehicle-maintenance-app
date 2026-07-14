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

# ---- runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# CI 构建时通过 --build-arg GIT_COMMIT=<sha> 注入，暴露在 /api/health 里，
# 方便确认 NAS 上跑的镜像是不是已经拉到了最新的一次推送（见 src/version.ts）。
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
