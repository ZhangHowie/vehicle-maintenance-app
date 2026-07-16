# 车辆保养管理系统 — 项目说明 / 会话记录

本文件是给 Claude Code（或任何后续接手这个项目的人/AI）看的项目上下文，记录了架构、约定和这个项目从零到现在经历过的所有改动。项目此前一直是在 Cowork（网页端 Claude）里迭代开发、直接 push 到 GitHub 的，现在代码同步到本机 `/Users/howie/Code/vehicle-maintenance-app`，后续改动请用 Claude Code 在本地继续。

GitHub 仓库：<https://github.com/ZhangHowie/vehicle-maintenance-app>（远程 `origin` 已配置好，`git log`/`git push` 可以直接用，需要你本机的 GitHub 认证）
Docker Hub 镜像：`howiez818/vehicle-maintenance-{backend,frontend,nginx,backup}`

## 技术栈

- 后端：Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
- 前端：React + Vite + TypeScript + Ant Design 5，PWA（可添加到手机主屏幕）
- 部署：Docker Compose，四个自定义镜像（backend/frontend/nginx/backup）+ 官方 postgres 镜像
- CI/CD：GitHub Actions，push 到 `main` 自动构建全部镜像并推送 Docker Hub（`.github/workflows/docker-publish.yml`）

## 目录结构

```
backend/    Express API + Prisma
frontend/   React + Vite 前端
nginx/      反向代理配置（打进 nginx 自定义镜像）
scripts/    数据库备份/恢复脚本（打进 backup 自定义镜像）
certs/      SSL 证书存放目录（本地开发不需要）
docs/       API.md 等文档
```

## 部署模型（重要，别搞混两条路径）

- **默认路径**（给普通部署使用的人）：`docker-compose.yml`，全部四个自定义服务用 `image:` 直接拉 Docker Hub 镜像，不 build，不需要克隆完整仓库，只需要 `docker-compose.yml` + `.env` 两个文件 + 手动建一个空的 `certs/` 目录（`docker compose` 不会自动创建不存在的 bind mount 目录）。
- **开发/改代码路径**：`docker-compose.build.yml`，用 `build:` 从本地源码构建镜像，`docker compose -f docker-compose.build.yml up -d --build`。**日常在这台机器上用 Claude Code 改代码、验证效果，应该用这条路径**，而不是默认的 `docker-compose.yml`。
- 端口默认 `8082`(HTTP)/`8083`(HTTPS)，不是 80/443（避免跟 NAS 自带服务冲突），在 `.env` 的 `HTTP_PORT`/`HTTPS_PORT` 改。

## 设计系统约定

- `frontend/src/theme.ts`：`BRAND`（主色 `#154c8c` 及深/浅变体）、`RECORD_THEME`（保养=暖橙 `#c2620d`，油耗=青蓝 `#0d8a86`），全站配色都从这里取，不要在组件里写死颜色。
- `frontend/src/components/SectionLabel.tsx`：表单分组标题 + 合计金额展示的共享组件。
- `frontend/src/components/StatCard.tsx`：首页/车辆详情页统计卡片的共享组件，标题强制单行省略号 + 配合 `Row align="stretch"` 使用，避免卡片高度不齐。
- `frontend/src/components/AuthLayout.tsx`：登录/注册等认证页面的左右分栏布局。
- 图标气泡（`width:26 height:26 borderRadius:7 background:BRAND.primarySoft`）是贯穿全站的小标题装饰模式，用在设置页卡片标题、记录详情弹窗标题等地方。

## 数据模型要点（`backend/prisma/schema.prisma`）

- `Vehicle`：`coverImageUrl`（`/uploads/xxx.jpg`）+ `coverCrop`（Json，裁剪范围）。
- `MaintenanceRecord`：`items`（明细：项目/品牌/数量/单价）+ `discountAmount`（整单优惠）+ `totalPrice`（= 各项目合计 − 优惠，后端算好，不需要前端传）。
- `FuelRecord`：`mileage`(Int) / `volume`/`unitPrice`(Decimal) / `isFullTank` / `lastRecorded`。百公里油耗是按"两次加满之间"分段算的，逻辑在 `backend/src/controllers/fuel.controller.ts` 的 `/stats` 接口。
- Decimal 字段在 JSON 序列化时会变成字符串，`backend/src/utils/serialize.ts` 的 `toPlain()` 统一转成 number，这是个已经踩过坑、修好了的点，新加接口如果直接 `res.json(prismaResult)` 记得过一遍 `toPlain()`。

## 数据导入导出（`backend/src/controllers/data.controller.ts`）

- 导出 JSON 带 `schemaVersion` 字段（当前 v2），车辆封面图片以 base64 内嵌导出（不是只存 URL），换环境导入也能恢复图片。
- 导入整批包在一个 Prisma 事务里，任何一条数据有问题就整体回滚 + 返回具体错误，不会出现"部分导入"。
- 详细格式见 `docs/API.md`「数据导入导出」章节。

## CI/CD

`.github/workflows/docker-publish.yml`：push 到 `main` 自动用 matrix 策略构建 backend/frontend/nginx/backup 四个镜像并推送 Docker Hub（多架构 `linux/amd64,linux/arm64`）。需要仓库 Secrets 里配置 `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN`（已经在之前的会话里配置过，具体是否还有效、有没有过期没有在这里再次确认，如果 Actions 跑失败先查这个）。构建时还会把 commit sha 通过 `--build-arg GIT_COMMIT`/`VITE_GIT_COMMIT` 注入镜像，对应 `frontend/src/version.ts` / `backend/src/version.ts`，在「账户设置」页面显示版本号，方便确认部署的是不是最新代码。

## 本机继续开发建议

```bash
cd /Users/howie/Code/vehicle-maintenance-app

# 后端本地跑（需要本机有 Postgres，或用 docker-compose.build.yml 里的 postgres 服务）
cd backend && npm install && npm run dev

# 前端本地跑
cd frontend && npm install && npm run dev

# 或者整体用 Docker 从源码构建验证
docker compose -f docker-compose.build.yml up -d --build
```

改完代码后照旧 `git add -A && git commit && git push`，push 到 `main` 会自动触发 CI 构建新镜像；正式部署的 NAS 那边执行 `docker compose pull && docker compose up -d` 更新到最新镜像。

## 会话变更记录（按时间顺序，早到晚）

以下是这个项目从最初到现在，历次会话做过的所有改动，供后续（尤其是新开一个 Claude Code 会话、没有这些历史上下文时）快速了解"现在这个状态是怎么来的"。

### 第一批：基础功能与 Bug 修复
- 添加默认管理员账号 + 首次登录强制改密码机制。
- 修复 Mac 相册无法选择封面图片的问题（`accept` 属性/HEIC 兼容）。
- 后端统计聚合接口（`/api/stats/overview`）。
- 统一的悬浮记录表单弹窗（`RecordFormModal`）+ 全局悬浮添加按钮（`QuickAddFloatButton`）。
- 首页与车辆详情页统计图表（饼图/柱状图/折线图，recharts）。
- 修复编辑油耗/保养记录时 "Expected number, received string" 报错——根因是 Prisma `Decimal` 序列化成字符串，`toPlain()` 工具函数 + zod `z.coerce.number()` 修复。
- 保养记录增加"优惠金额"字段（`discountAmount`），`totalPrice` 改为后端计算。
- 修复保养项目表单横竖对齐问题（改用 CSS Grid）。
- 油耗表单默认值（沿用上次里程/单价）+ 金额与单价/加油量双向自动计算。

### 第二批：视觉重新设计
- 抽取共享设计系统：`theme.ts`（`BRAND`/`RECORD_THEME`）、`SectionLabel`/`TotalSummary` 共享组件。
- 重新设计登录/注册/忘记密码/重置密码/强制改密/两步验证设置等认证类页面（`AuthLayout` 左右分栏 + SVG 品牌图形）。
- 重新设计账户设置页、车辆表单/列表/详情页外观，统一 Layout 侧边栏/Dashboard 配色。
- 车辆封面图片裁剪从"只记录坐标"改为"用 canvas 把裁剪结果真正烘焙进图片文件"，解决上传比例和展示比例不一致的问题（`ImageCropUpload.tsx` 的 `bakeCroppedFile()`）。

### 第三批：GitHub/Docker Hub 基础设施
- 初始化 git 仓库，推送到 GitHub（`ZhangHowie/vehicle-maintenance-app`）。
- 配置 GitHub Actions 自动构建 Docker 镜像并推送 Docker Hub（当时只有 backend/frontend 两个镜像）。

### 第四批：功能补齐
- 修复优惠金额编辑报错（`remark`/`brand` 字段 Prisma 返回 `null` 但 zod schema 只接受 `undefined` 的问题，`.nullable().optional()` 修复）。
- 车辆详情图表：饼图改为"保养/油费"两项固定构成。
- 首页与车辆详情页增加按年份筛选（`2026年`/`2025年`/`全部`）。
- 车辆详情折线图改为"月支出趋势"，可按全部/保养/加油筛选。
- 每条保养/油耗记录支持点击查看详情（只读 Modal + 编辑入口）。
- 车辆详情卡片增加：总消费/总加油/总保养金额、平均油耗、平均行驶里程、平均油费等统计。
- 油耗记录列表简化为只显示日期/油耗/公里数，完整信息挪进详情弹窗。

### 第五批：Docker 部署架构重构（这是个比较大的返工，教训值得记一下）
- 最初的默认 `docker-compose.yml` 用 `build:` 本地构建 backend/frontend，nginx/backup 用官方镜像 + bind mount 配置文件/脚本——这意味着"只是想部署用"的人也得下载整个源码仓库、在部署的机器上装 Node.js 编译，这是不对的。
- 重构成：默认 `docker-compose.yml` 全部四个自定义服务改成 `image:` 直接拉 Docker Hub 镜像；新增 `nginx/Dockerfile`（把 `reverse-proxy.conf` 打进镜像）、`scripts/Dockerfile`（把 `backup.sh`/`restore.sh` 打进镜像）；从源码构建的路径挪到单独的 `docker-compose.build.yml`。
- 顺带修复一个真实 bug：原来 backup 服务用 `entrypoint: ["/bin/sh", "/scripts/backup.sh"]` 覆盖了默认命令，导致 `docker compose run --rm backup /scripts/restore.sh <file>` 实际上没有真正执行 `restore.sh`（`docker compose run` 后面的参数覆盖的是 `CMD` 不是固定的 `ENTRYPOINT`）。改成 `ENTRYPOINT []` + `CMD ["/scripts/backup.sh"]` 后 `restore.sh` 才能被正确调用到。
- 端口从 80/443 改成 8082/8083 默认，避免跟 NAS（群晖 DSM）自带服务冲突。
- CI workflow 从两个近乎重复的 job 重构成 matrix 策略，一次构建全部四个镜像。

### 第六批：数据导入导出重构（修复真实的数据丢失 bug）
用户反馈"导出 2 辆车、导入后只剩 1 辆，而且车辆图片也没了"。根因：
1. 导出的 JSON 只存了图片的 URL（`/uploads/xxx.jpg`），没存图片内容，换环境导入必然失效；导入代码也压根没读取这个字段。
2. 导入是逐辆车 `create()`，没有包在数据库事务里，如果某一辆车（或它的记录）创建失败，之前已经创建的车辆不会回滚，导致"部分导入"。

修复：
- 导出 JSON 新增 `schemaVersion`（当前 v2），封面图片以 base64 内嵌导出。
- 导入整批包在一个 Prisma `$transaction` 里，全部成功或全部回滚，失败时清理本次写入的孤儿图片文件。
- 导入按 `schemaVersion` 做版本兼容：旧版本文件依然能导入；文件版本比系统支持的更新则直接拒绝（避免静默丢字段）。
- 后续又修复了一次导入 500 报错：根因是里程数被当小数写进数据库的 `Int` 字段触发 Prisma 校验异常，之前这类错误被笼统归为"服务器内部错误"看不出原因——现在导入时对里程/数量统一取整，`errorHandler.ts` 也新增了对 `PrismaClientValidationError` 的具体处理。
- 导入增加真实的上传进度条（`axios onUploadProgress`）。
- 「账户设置」页面新增"版本信息"卡片，显示前端/后端各自的版本号 + git commit 短哈希（镜像构建时通过 `--build-arg GIT_COMMIT`/`VITE_GIT_COMMIT` 注入），方便确认部署的是不是最新代码。

### 第七批：移动端（iPhone）体验优化
用户在 iPhone 上反馈了 8 个具体问题，逐一修复：
1. 首页/详情页年份 `Segmented` 选择器右对齐溢出屏幕，最左边按钮显示不全 → 套一层可横向滚动的容器。
2. 统计卡片竖向不对齐（根因是标题文字换行导致同一行卡片高度不一致）→ 新增共享 `StatCard` 组件（标题强制单行省略号）+ `Row align="stretch"`；顺带收紧内边距/字号，移动端一屏能看到更多信息。
3. 进入车辆详情页后无法方便返回首页（导航菜单在页面最底部）或切换车辆 → 详情页顶部新增吸顶的"返回"按钮 + 车辆切换下拉框；`Layout.tsx` 移动端底部导航从"跟在内容后面"改成 `position: fixed` 固定在视口底部；悬浮添加按钮相应上移避免遮挡。
4. 车名/编辑删除按钮跟标签之间间距过短接近重合 → 拆成两行并显式加 `marginTop`（不依赖 flex 换行的默认 0 间距）。
5. 同问题 2。
6. 保养/油耗记录列表从 `Tabs` 改成 `Segmented` 按钮切换单个表格显示，减少页面整体高度。
7. 8. 保养表去掉优惠/备注/操作列，油耗表去掉操作列，编辑/删除收进点击某一行弹出的详情 Modal 里（Modal footer 新增了删除按钮 + `Popconfirm`）。

这批改动因为是纯前端 UI，Cowork 的沙盒环境没有 root 权限装浏览器依赖（Playwright 装了但 `sudo npx playwright install-deps` 因为 sudo 被禁用而失败），没能截图实测，是靠代码审查 + `tsc`/`vite build` 验证的。**建议接手后先在 iPhone 真机上过一遍这几个点，如果还有细节不对可以在这基础上继续调。**

### 第八批：移动端导航重新设计 + PWA 完善（本机 Claude Code 会话，首次）
代码同步到本机后，第一次在本机用 Claude Code 继续开发，做了一轮更彻底的移动端重新适配 + 把 PWA 真正补完整（之前 `vite-plugin-pwa` 引用的图标文件其实并不存在，manifest 一直是残的）：
- 移动端底部导航从"横向 Menu"改成三段式（首页 / 中间凸起加号按钮 / 设置），中间按钮用保养橙/加油青蓝对角劈开的圆形按钮，点开弹出"保养/加油"选项——把 `QuickAddFloatButton` 的悬浮加号语义并入了导航栏本身，桌面端悬浮按钮保留。抽出共享的 `useQuickAddRecord` hook 给两处复用。
- 新增 `MobileSheet` 组件：移动端下把 `RecordFormModal`、车辆详情页的记录详情 Modal 从居中对话框改成从底部滑出的全宽抽屉（圆角+拖拽把手+安全区适配），桌面端原样透传成普通 Modal。
- `StatCard`/`TotalSummary` 数字展示加 `font-variant-numeric: tabular-nums`；移动端 Header 改 `position: sticky` + 毛玻璃背景。
- 补全 PWA：用 Pillow 手写脚本生成真实的图标资源（192/512/512-maskable/apple-touch-icon）+ `favicon.svg`，`index.html` 补齐 `apple-touch-icon`/`apple-mobile-web-app-*` 系列 meta（`status-bar-style` 用 `default` 而不是 `black-translucent`，因为 Header 是浅色背景），新增 `StatusBanners.tsx`（iOS「添加到主屏幕」引导条 + 离线提示条）。删除了未被引用的死文件 `public/manifest.json`。
- 用 Chrome headless + CDP（Python `websocket-client` 驱动，没有装 Playwright）截图验证，过程中抓到两个真实 bug 并修复：① `CenterAddButton` 同时给 `Popover` 的 `onOpenChange` 和裸 `<button>` 的 `onClick` 两处独立管理同一个开关状态，互相打架导致弹出层永远打不开——收敛成只用 `onOpenChange` 一个来源；② 保养表单"优惠金额+应付总额"那一行用固定 `200px 1fr` 网格，在移动端抽屉的窄宽度下把总额卡片挤到 ~138px，文字逐字换行——移动端下改成单列堆叠。

### 第九批：用户名登录 + iOS 输入框防放大 + 弹窗背景锁滚动 + PWA 白屏根因修复 + 新增"其他消费"记录类型
用户反馈了 5 个问题，逐一处理：
1. **登录改用用户名（默认 `admin`），不再用邮箱**：`User` 表新增 `username`（唯一、必填）字段，`email` 改为可选（仅用于找回密码）。手写 Prisma 迁移做数据回填（已有账号按邮箱前缀 + id 片段生成唯一用户名，避免重名冲突），`.env` 的 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 改成 `ADMIN_USERNAME`/`ADMIN_PASSWORD`（`ADMIN_EMAIL` 仍可选配置）。`LoginAttempt.email` 字段顺带改名成 `identifier`，语义更准确。
2. **iPhone 点击输入框整页放大**：iOS Safari 对 `font-size < 16px` 的输入框聚焦会自动放大整个页面。全局 CSS 给移动端断点下所有 antd 表单控件（`Input`/`InputNumber`/`Select`/`DatePicker` 等）统一提到 16px 解决，没有改动桌面端样式。
3. **弹出保养/油耗/消费表单时背景页面仍可滚动**：`MobileSheet` 组件在移动端下改用 antd 的 `wrapClassName` 做成了 `position: fixed` 的贴底抽屉，这绕开了 antd Modal 自带的 body 滚动锁定机制；iOS Safari 上 `overflow: hidden` 对触摸滚动本来就不完全可靠。改成弹窗打开时把 `<body>` 本身钉成 `position: fixed`（记录/还原滚动位置），这是 iOS 上唯一可靠的锁滚动做法。
4. **桌面端首次打开大概率白屏，要手动刷新才正常**：根因是 `vite-plugin-pwa` 默认注入的极简 `registerSW.js`（`injectRegister: 'auto'` 走的是脚本标签版本）只负责 `register()`，完全没有"检测到新版本后怎么办"的逻辑——每次部署新版本后，已安装的 Service Worker 会继续拿旧版本的预缓存内容响应下一次打开，直到手动刷新触发一次条件请求才会恢复。改成在 `main.tsx` 里显式 `import { registerSW } from "virtual:pwa-register"` 并 `registerSW({ immediate: true })`（`vite.config.ts` 相应设置 `injectRegister: false` 避免重复注册），`registerType: "autoUpdate"` 配合这个真正的注册方式才会在新版本接管时自动刷新一次页面。同时给 nginx 里的 `index.html`/`sw.js`/`manifest.webmanifest` 显式加了 `Cache-Control: no-cache` 兜底。
5. **新增"其他消费"记录类型**（停车费、行车记录仪、脚垫等不属于保养/加油的杂项支出）：新增 `ExpenseRecord` 模型（`date`/`item`/`amount`/`remark`）+ 对应 CRUD 路由 `/api/vehicles/:vehicleId/expense-records`；`RECORD_THEME` 新增第三种配色（紫色）；`RecordFormModal` 的 `RecordType` 扩成三态，中间加号按钮从两色对角劈开改成 `conic-gradient` 三等分；车辆详情页统计卡片/支出构成饼图/月支出趋势折线图/记录列表 Segmented 全部从二元扩到三元；首页 `Dashboard` 统计卡片和堆叠柱状图同步补上"其他消费"；数据导入导出 `schemaVersion` 升到 v3（v1/v2 文件没有 `expenseRecords` 字段时按空数组兼容处理，不影响老备份文件导入）。
   - 过程中发现并修复一个真实 bug：`RecordFormModal` 的 `onFinish` 里原本无条件把 `amount` 字段从提交数据里剥离（这个字段对油耗记录只是"加油量/总金额互算"用的辅助字段，后端不认识），但消费记录的 `amount` 恰恰是要提交给后端的真正字段——如果不分类型处理，消费记录会永远提交不上金额。改成只在 `type === "fuel"` 时才剥离该字段。
- 全部改动都用 `docker-compose.build.yml` 完整构建 + 启动验证过（`tsc -b`/`vite build` 无报错），并用 Chrome headless + CDP 模拟 iPhone viewport 截图核对了登录页用户名字段、三选项弹出层、消费记录表单/详情、车辆详情页新增的统计卡片和图表，确认功能符合预期、控制台无报错。

## 已知的坑 / 踩过的教训（避免重复踩）

1. **Prisma `Decimal` 字段序列化成字符串**：`res.json()` 直接返回 Prisma 查询结果时，`Decimal` 字段会变成字符串而不是数字，前端表单回填再提交会被 zod 拒绝。统一用 `toPlain()`。
2. **Prisma 返回 `null` 而不是 `undefined`**：可选字段（如 `remark`/`brand`）没填时 Prisma 查询结果是 `null`，zod schema 如果只写 `.optional()`（只接受 `undefined`）会报错，要写 `.nullable().optional()`。
3. **`docker compose run <service> <args>` 覆盖的是 `CMD` 不是固定的 `ENTRYPOINT`**：如果 compose 里给某个服务写了 `entrypoint:` 覆盖，`docker compose run` 后面手动传的命令会变成这个固定 entrypoint 的参数，而不是真正替换掉要执行的命令。
4. **`docker compose` 不会自动创建不存在的 bind mount 宿主机目录**：新版本 compose 需要目录提前存在，否则报 `Bind mount failed`。
5. **导出/导入这类"备份文件"格式，一定要带版本号**：否则未来改字段结构时，老版本导出的文件要么导入失败、要么静默丢数据，非常隐蔽。
6. **Express 全局 body-parser 的体积限制**：如果某个接口需要比其它接口大得多的请求体（比如内嵌图片的批量导入），不要粗暴地把全局限制调大，应该单独给那个路由设置更大的 `express.json({ limit })`，同时别忘了 nginx 的 `client_max_body_size` 也要同步放宽，否则请求会在 nginx 那一层就被拒绝，比后端限制更早触发、更难排查。
7. **antd `Row` 默认不会让同一行的卡片等高**：`align` 默认是 `top` 不是 `stretch`，内容高度不一致（比如标题换行）会导致卡片底边对不齐，需要显式 `align="stretch"` + 子元素 `height: 100%`。
8. **Cowork 的沙盒环境网络有白名单限制**：`api.github.com`、`hub.docker.com` 等域名不可达（`git`-over-HTTPS 到 `github.com` 本身是通的），沙盒里也没有 `docker` 二进制、没有 root 权限装系统依赖（装不了 Postgres、装不了 Playwright 的浏览器依赖）。这意味着涉及"实际构建 Docker 镜像""起数据库做集成测试""截图验证 UI"这类工作，在 Cowork 沙盒里做不了，只能靠 GitHub Actions（构建镜像）和代码审查+类型检查+单元级验证（没有真实环境的测试）代替。**这也是为什么现在要把代码同步到本机用 Claude Code 继续——本机没有这些限制，能跑真实的 Docker/数据库/浏览器测试。**
9. **`vite-plugin-pwa` 的 `registerType: "autoUpdate"` 光配置本身不够**：默认 `injectRegister: 'auto'` 注入的是一个极简版 `registerSW.js`，只调用了 `navigator.serviceWorker.register()`，完全没有"检测到新 Service Worker 接管后自动刷新页面"的逻辑——这部分逻辑其实是打包在 `virtual:pwa-register` 这个虚拟模块里的，必须在入口文件（`main.tsx`）里显式 `import { registerSW } from "virtual:pwa-register"` 并调用 `registerSW({ immediate: true })` 才会生效，同时要把 `vite.config.ts` 里的 `injectRegister` 设成 `false` 避免重复注册两次。否则的话，每次发布新版本后，用户下次打开都可能命中"整页白屏，得手动刷新一次才恢复正常"的经典 PWA 部署问题。
10. **改会影响登录凭据的字段（比如把登录方式从邮箱换成用户名）时，手写 Prisma 迁移要考虑存量数据的回填唯一性**：不能简单地"从邮箱取前缀当用户名"，不同邮箱的前缀可能重复（`a@x.com` 和 `a@y.com` 都是 `a`），会导致迁移直接因唯一约束失败。稳妥做法是"取值 + 一段来自 `id` 的随机后缀"保证肯定唯一，用户后续登录不了可以自己去数据库改，好过迁移直接跑不过去。

## 安全提醒

之前配置过 GitHub Personal Access Token 和 Docker Hub Access Token 用于从 Cowork 沙盒推送代码/触发构建。这两个 token 没有写进任何提交的文件（按约定不应该出现在仓库里），但如果还没轮换过，建议找时间去 GitHub/Docker Hub 后台生成新的、吊销旧的。

还有一次是在本机 Claude Code 会话里，用户为了让 `git push` 能带上凭据，直接把一个新生成的 GitHub PAT 粘贴进了对话——这个 token 因此已经暴露在会话记录里，按约定视为已泄露，**如果还没有去 GitHub 后台撤销，应尽快撤销**。这次事件之后的经验是：`git push` 需要凭据时，应该让用户自己在真正的终端（Terminal.app/iTerm，不是 Claude Code 会话里的 `!` 前缀，那个仍然没有 TTY 弹不出交互式凭据提示）里手动输入，凭据不应该以任何形式经过对话或被拼进命令行——Claude Code 自身的权限机制也会阻止把明文 token 拼进命令执行，这是设计上的保护而不是故障。
