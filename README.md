# 车辆保养管理系统

[![Build and Publish Docker Images](https://github.com/ZhangHowie/vehicle-maintenance-app/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/ZhangHowie/vehicle-maintenance-app/actions/workflows/docker-publish.yml)

记录车辆保养维修与油耗的自托管应用。后端 Node.js + Express + Prisma + PostgreSQL，前端 React + Vite + Ant Design（响应式，支持桌面/移动浏览器，并可作为 PWA 添加到手机主屏幕；后续可基于同一套 REST API 开发 iOS / Android 原生 App）。

- GitHub 仓库：<https://github.com/ZhangHowie/vehicle-maintenance-app>
- Docker Hub 镜像：<https://hub.docker.com/r/howiez818/vehicle-maintenance-backend>、<https://hub.docker.com/r/howiez818/vehicle-maintenance-frontend>

## 功能

- Docker 一键部署（docker compose）
- 桌面 Web 端 + 移动端浏览器自适应；PWA 支持"添加到主屏幕"
- 数据导出（JSON / CSV 压缩包）、导入（JSON）、数据库自动定时备份与手动恢复
- 账号注册、登录、忘记密码（邮件重置链接）、修改密码、TOTP 两步验证（验证器 App，如 Google Authenticator）
- HTTPS + SSL 证书导入（Nginx 反向代理）
- 登录失败次数限制（账号锁定）+ IP 黑名单 + 接口限流，防暴力破解
- 车辆（设备）封面图片上传、封面裁剪范围选择，多端一致展示
- 按车辆维度添加保养记录（项目、品牌、个数、价格、备注，支持多项目）
- 按车辆维度添加油耗记录（公里数、加油量、单价、油品类型[92/95/98/柴油/电动，默认取车辆设置，可手动修改]、是否跳枪、上次是否记录、备注），并自动计算百公里油耗

## 目录结构

```
backend/    Node.js + Express + Prisma 后端 API
frontend/   React + Vite + Ant Design 前端
nginx/      反向代理配置（HTTP 默认 / HTTPS 模板）
scripts/    数据库备份与恢复脚本
certs/      存放 SSL 证书（自行放入）
```

## 快速开始

1. 复制环境变量文件并修改（数据库密码、JWT 密钥、SMTP 邮箱等务必修改为自己的值）：

   ```bash
   cp .env.example .env
   ```

2. 构建并启动全部服务：

   ```bash
   docker compose up -d --build
   ```

3. 浏览器访问 `http://<服务器IP>`（默认 HTTP，见下方启用 HTTPS 说明）。

服务包含：`postgres`（数据库）、`backend`（API）、`frontend`（静态站点）、`nginx`（反向代理，对外唯一入口，80/443 端口）、`backup`（每日自动备份）。

### 使用 Docker Hub 上的预构建镜像（可选）

默认 `docker-compose.yml` 里 `backend` / `frontend` 是本地构建（`build:`），首次启动会现场编译。如果不想本地构建，也可以直接拉取 CI 自动发布到 Docker Hub 的镜像，把 `docker-compose.yml` 里对应服务的 `build:` 换成：

```yaml
backend:
  image: howiez818/vehicle-maintenance-backend:latest
frontend:
  image: howiez818/vehicle-maintenance-frontend:latest
```

镜像同时提供 `linux/amd64` 和 `linux/arm64`，Intel/Apple Silicon Mac、普通 x86 服务器都能直接拉取对应架构，无需本地编译。

## 持续集成 / 自动发布

`.github/workflows/docker-publish.yml` 会在每次 push 到 `main` 分支时，自动构建 `backend` / `frontend` 镜像并推送到 Docker Hub（打 `v1.0.0` 这样的 tag 时会额外打上对应版本号）。

使用前需要在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 里添加两个 repository secret：

| Secret 名 | 说明 |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token（在 Docker Hub 账号设置 -> Security -> New Access Token 生成，不要用登录密码） |

添加好这两个 secret 后，后续每次推送代码到 `main` 都会自动完成"构建 → 推送 Docker Hub"，无需手动操作。

## 默认账号

首次启动时，若数据库中还没有任何账号，后端会**自动创建一个默认管理员账号**：

- 邮箱：`admin@example.com`
- 密码：`Admin123456`

可以在 `.env` 中通过 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 自定义这个初始账号（建议部署前就改掉，而不是登录后再改）。

**用默认账号登录后，系统会强制跳转到"修改密码"页面，必须改密后才能使用其他功能**，改密时需要输入当前密码（即上面的默认密码）。改密只需做一次，之后正常登录不会再提示。

如果数据库里已经有账号了（比如你之前已经注册过），则不会再创建默认账号，也可以随时在登录页点击"注册新账号"添加更多账号（每个账号只能看到自己名下的车辆和记录，账号之间数据互不可见，均无特殊管理员权限）。

如果配置了 `.env` 中的 `SMTP_*`，"忘记密码"功能会真实发送重置邮件；若不配置 SMTP，忘记密码时后端只会把重置链接打印到 `backend` 容器日志（`docker compose logs backend`），可从日志里手动取出链接使用，不影响功能，只是不会真的发邮件。

## 启用 HTTPS / 导入 SSL 证书

1. 将证书文件放入 `certs/` 目录：`fullchain.pem`、`privkey.pem`（详见 `certs/README.md`）。
2. 用 `nginx/reverse-proxy.https.conf.example` 覆盖 `nginx/reverse-proxy.conf`。
3. 重启 Nginx 容器：

   ```bash
   docker compose restart nginx
   ```

之后 80 端口会自动跳转到 443（HTTPS）。

## 数据导入 / 导出 / 备份

- 在"账户设置"页面可导出 JSON 或 CSV（压缩包），也可导入之前导出的 JSON 文件。
- `backup` 容器每天（可通过 `.env` 中 `BACKUP_INTERVAL_SECONDS` 调整）自动执行 `pg_dump`，备份文件保存在 Docker 卷 `backup-data` 中，默认保留 14 天（`BACKUP_KEEP_DAYS`）。
- 手动恢复：

  ```bash
  docker compose run --rm backup /scripts/restore.sh /backups/backup_xxx.sql.gz
  ```

## .env 参数说明

| 变量 | 说明 | 默认/示例 |
|---|---|---|
| `DOMAIN` | 你的域名或访问地址，仅作标识用途，不参与 Nginx 证书匹配（Nginx 用 `server_name _;` 接受任意域名） | `localhost` |
| `NODE_ENV` | 后端运行环境 | `production` |
| `POSTGRES_USER` | 数据库用户名 | `vma_user` |
| `POSTGRES_PASSWORD` | 数据库密码，**务必修改** | - |
| `POSTGRES_DB` | 数据库名 | `vehicle_maintenance` |
| `DATABASE_URL` | Prisma 连接串，需与上面三项保持一致（`postgresql://用户:密码@postgres:5432/库名?schema=public`） | - |
| `JWT_ACCESS_SECRET` | 签发短期访问令牌的密钥，**务必改成随机长字符串** | - |
| `JWT_REFRESH_SECRET` | 签发长期刷新令牌的密钥，**务必改成随机长字符串，且与上面不同** | - |
| `JWT_ACCESS_EXPIRES` | 访问令牌有效期（[ms 格式](https://github.com/vercel/ms)：`15m`/`1h`/`7d` 等） | `15m` |
| `JWT_REFRESH_EXPIRES` | 刷新令牌有效期 | `7d` |
| `LOGIN_MAX_ATTEMPTS` | 单个账号连续登录失败多少次后锁定 | `5` |
| `LOGIN_LOCK_MINUTES` | 账号锁定时长（分钟） | `15` |
| `RATE_LIMIT_WINDOW_MINUTES` | 全局接口限流的统计窗口（分钟） | `15` |
| `RATE_LIMIT_MAX` | 上述窗口内单 IP 允许的最大请求数 | `100` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | 发送"忘记密码"邮件用的 SMTP 服务器配置。不填则不会真实发邮件，重置链接会打印在后端日志中 | - |
| `MAIL_FROM` | 邮件发件人显示名 | `车辆保养管理 <no-reply@example.com>` |
| `FRONTEND_ORIGIN` | 后端 CORS 允许的前端来源，同时也是"忘记密码"邮件里重置链接的域名前缀 | `https://localhost` |
| `VITE_API_BASE_URL` | 前端请求 API 的基础路径，构建时注入前端，一般无需改动 | `/api` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 首次启动、数据库还没有任何账号时自动创建的默认管理员账号，登录后会强制要求改密。数据库已有账号时这两个变量不再生效 | `admin@example.com` / `Admin123456` |

HTTPS 证书路径不通过环境变量配置，固定为 `certs/fullchain.pem` 与 `certs/privkey.pem`，详见下方「启用 HTTPS」。

## 安全特性说明

- 密码使用 bcrypt（12 轮）加密存储，且强制至少 8 位并包含大小写字母和数字。
- 登录失败达到 `LOGIN_MAX_ATTEMPTS`（默认 5 次）后，账号锁定 `LOGIN_LOCK_MINUTES`（默认 15 分钟）。
- 同一 IP 在 15 分钟内登录失败超过 20 次，会被自动加入 IP 黑名单（1 小时），后续请求直接拒绝。
- 登录 / 注册 / 忘记密码等接口有独立的限流保护，全局接口也有限流。
- 两步验证（TOTP）：账户设置中可开启，登录时需额外输入验证器 App 生成的 6 位验证码。

## 本地开发（不使用 Docker）

后端：

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## API 接口文档

完整接口列表、请求/响应格式见 [`docs/API.md`](./docs/API.md)，涵盖认证、车辆、保养记录、油耗记录、数据导入导出等全部接口。

## 关于 iOS / Android 原生 App

后端已提供完整的 REST API（详见 [`docs/API.md`](./docs/API.md)），未来可直接基于这套接口开发 iOS / Android 原生客户端或 React Native / Flutter 跨端 App，无需修改后端。

## 验证说明

本项目在交付前已完成：后端 TypeScript 严格模式编译通过（`tsc --noEmit` 零错误）；前端 TypeScript 编译通过并成功执行生产环境 `vite build`（含 PWA 资源生成）；`docker-compose.yml` 通过 YAML 语法校验。由于沙箱网络限制，未能在当前环境内实际执行 `docker compose up`，建议部署后按上方步骤验证各容器正常启动。
