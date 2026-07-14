// 应用版本号——升级功能时手动改这个数字（跟 frontend/src/version.ts 保持同步）。
// GIT_COMMIT 是 Docker 镜像构建时由 CI 通过 --build-arg 注入的 commit sha
// （见 Dockerfile 的 ARG/ENV GIT_COMMIT、.github/workflows/docker-publish.yml），
// 本地开发环境没有这个环境变量时显示 "dev"。
// 这两个值一起显示在前端「账户设置」页面，方便确认部署的镜像是否已经是最新版本——
// 光看 APP_VERSION 容易因为忘记手动改号而分辨不出来，commit sha 每次推送必然不同，
// 更可靠。
export const APP_VERSION = "1.1.0";
export const GIT_COMMIT = process.env.GIT_COMMIT ?? "dev";
