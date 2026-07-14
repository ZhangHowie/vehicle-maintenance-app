// 应用版本号——升级功能时手动改这个数字（跟 backend/src/version.ts 保持同步）。
// VITE_GIT_COMMIT 是构建镜像时 CI 通过 --build-arg 注入的 commit sha（见
// frontend/Dockerfile 的 ARG/ENV、.github/workflows/docker-publish.yml），
// 本地 `npm run dev` 没有这个变量时显示 "dev"。
export const APP_VERSION = "1.1.0";
export const GIT_COMMIT = (import.meta.env.VITE_GIT_COMMIT as string | undefined) || "dev";
