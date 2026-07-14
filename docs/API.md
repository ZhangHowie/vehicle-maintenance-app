# API 接口文档

基础路径：`/api`（本地开发默认 `http://localhost:3000/api`，生产环境经 Nginx 反代后为 `https://<你的域名>/api`）。

除标注"无需登录"的接口外，其余接口都需要在请求头携带：

```
Authorization: Bearer <accessToken>
```

`accessToken` 有效期由 `.env` 中 `JWT_ACCESS_EXPIRES`（默认 15 分钟）控制，过期后用 `refreshToken` 调用 `/api/auth/refresh` 换取新的一对令牌。前端已内置自动刷新逻辑，原生 App 开发时需自行实现同样的刷新流程。

## 认证 `/api/auth`

| 方法 | 路径 | 说明 | 请求体 | 需要登录 |
|---|---|---|---|---|
| POST | `/register` | 注册账号，成功后直接返回令牌 | `{ email, password }` | 否 |
| POST | `/login` | 登录。若账号未开启两步验证，直接返回令牌；若已开启，返回 `{ requiresTotp: true, preAuthToken }` | `{ email, password }` | 否 |
| POST | `/login/totp` | 两步验证第二步，用 `preAuthToken` + 验证器 6 位码换取正式令牌 | `{ preAuthToken, code }` | 否 |
| POST | `/refresh` | 用 refreshToken 换取新的 accessToken/refreshToken | `{ refreshToken }` | 否 |
| POST | `/forgot-password` | 发送重置密码邮件（无论邮箱是否存在都返回相同提示，防止邮箱枚举） | `{ email }` | 否 |
| POST | `/reset-password` | 用邮件中的 token 重置密码 | `{ email, token, newPassword }` | 否 |
| GET | `/me` | 获取当前登录用户信息 | - | 是 |
| POST | `/change-password` | 修改密码（需提供当前密码） | `{ currentPassword, newPassword }` | 是 |
| POST | `/totp/setup` | 生成两步验证密钥与二维码（尚未启用） | - | 是 |
| POST | `/totp/enable` | 输入验证器生成的验证码以正式启用两步验证 | `{ code }` | 是 |
| POST | `/totp/disable` | 关闭两步验证（需提供密码） | `{ password }` | 是 |

登录成功响应示例：

```json
{
  "user": { "id": "uuid", "email": "a@b.com", "totpEnabled": false, "mustChangePassword": false },
  "accessToken": "...",
  "refreshToken": "..."
}
```

`mustChangePassword` 为 `true` 时（使用初始默认管理员账号首次登录），客户端应强制引导用户先调用 `/change-password` 修改密码，成功后该字段会变为 `false`，此后不再提示。首次启动如果数据库中还没有任何账号，会自动创建默认管理员账号（邮箱/密码见 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`，默认见 README「默认账号」章节）。

## 车辆（设备）`/api/vehicles`

全部需要登录。

| 方法 | 路径 | 说明 | 请求体 |
|---|---|---|---|
| GET | `/` | 获取当前用户的车辆列表 | - |
| POST | `/` | 新建车辆 | `{ name, brand?, model?, plateNo?, defaultFuelType }` |
| GET | `/:id` | 获取单个车辆详情 | - |
| PUT | `/:id` | 更新车辆信息（字段均可选） | 同上（partial） |
| DELETE | `/:id` | 删除车辆（级联删除其保养/油耗记录） | - |
| POST | `/:id/cover` | 上传/更新封面图，`multipart/form-data`：`file`（图片，前端已按 16:9 裁剪好再上传） | - |

`defaultFuelType` 取值：`P92` `P95` `P98` `DIESEL` `ELECTRIC`。

封面图统一按 16:9 处理：前端裁剪弹窗把选中的区域直接绘制到 canvas 导出成最终图片文件再上传，而不是只记录裁剪坐标；因此上传后的图片本身就是 16:9，车辆列表卡片、车辆详情页横幅都用同样的 16:9 容器 + `object-fit: cover` 展示，画面范围与裁剪时预览的完全一致，不会再出现"上传比例和显示比例对不上"的问题。

## 保养记录 `/api/vehicles/:vehicleId/maintenance-records`

全部需要登录，且只能操作自己名下车辆。

| 方法 | 路径 | 说明 | 请求体 |
|---|---|---|---|
| GET | `/` | 获取该车辆全部保养记录 | - |
| POST | `/` | 新建保养记录 | `{ date, mileage?, remark?, discountAmount?, items: [{ project, brand?, quantity, price }] }` |
| PUT | `/:id` | 更新保养记录（整体覆盖 items） | 同上 |
| DELETE | `/:id` | 删除保养记录 | - |

`totalPrice` 由后端根据 `items` 中每项 `quantity * price` 累加后，再减去整单优惠 `discountAmount`（默认 0，不传则视为无优惠；结果不会低于 0）自动计算，无需前端传入。

## 油耗记录 `/api/vehicles/:vehicleId/fuel-records`

全部需要登录，且只能操作自己名下车辆。

| 方法 | 路径 | 说明 | 请求体 |
|---|---|---|---|
| GET | `/` | 获取该车辆全部油耗记录 | - |
| GET | `/stats` | 获取油耗统计（按"两次加满之间"分段计算的百公里油耗，见下方说明） | - |
| POST | `/` | 新建油耗记录 | `{ date, mileage, volume, unitPrice, fuelType, isFullTank, lastRecorded, remark? }` |
| PUT | `/:id` | 更新油耗记录 | 同上 |
| DELETE | `/:id` | 删除油耗记录 | - |

- `isFullTank`：是否跳枪（加满）。只有加满的记录才能作为可靠的里程基准点（因为只有加满才能确定油箱状态）。
- `lastRecorded`：上次加油是否有记录。为 `false` 时说明这条记录之前有一次没被记录的加油，这一段的加油量不可信，会被跳过。

`/stats` 响应示例：

```json
{
  "segments": [
    { "fromMileage": 51440, "toMileage": 51911, "date": "2025-07-20T00:00:00.000Z", "litersPer100km": 6.14 }
  ],
  "recentLitersPer100km": 6.14,
  "averageLitersPer100km": 6.8
}
```

计算方式：把"两次加满"之间（含中途任何未加满的补油）的加油量全部累加，除以这段的里程差，得到该段的百公里油耗。中途只要有一条记录 `lastRecorded=false`，说明这条之前有未记录的加油，累计的加油量不可信，会丢弃这一段并从下一次加满重新开始累计。车辆详情页展示的"最近百公里油耗"取 `recentLitersPer100km`（即 `segments` 中最后一段）。

## 数据导入导出 `/api/data`

全部需要登录，仅导入导出当前用户自己的数据。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/export?format=json` | 导出全部车辆及记录为 JSON 文件下载（含封面图片，见下方格式说明） |
| GET | `/export?format=csv` | 导出为 CSV + 完整 JSON（`full_export.json`，跟 `export?format=json` 同一份内容）打包的 zip 文件下载 |
| POST | `/import` | 导入 `export?format=json` 产出的 JSON（作为请求体），批量重建车辆/保养/油耗记录/封面图片 |

### 导出文件格式（`schemaVersion`）

导出的 JSON 顶层带一个 `schemaVersion` 字段，标识车辆/记录/图片这部分数据结构的版本号，跟应用本身的版本号是两回事——只要这部分导出结构没变，应用升级多少次 `schemaVersion` 都不需要跟着变；只有导出结构发生不兼容变化时才会递增。`/import` 接口会根据这个字段自动兼容老版本导出的文件：

- **v1**（早期版本导出的文件，字段名是 `version` 而不是 `schemaVersion`）：车辆基本信息 + 保养/油耗记录，不含封面图片。
- **v2**（当前版本）：在 v1 基础上，每辆车新增 `coverImage`（封面图片，图片内容以 `dataBase64` 直接内嵌在 JSON 里，不是只存一个指向本机文件的 URL——这样导入到另一台机器、或者换了一个全新的 `uploads` 数据卷，图片依然能被正确恢复）和 `coverCrop`（封面裁剪范围）。

```json
{
  "schemaVersion": 2,
  "exportedAt": "2026-07-14T00:00:00.000Z",
  "vehicleCount": 2,
  "vehicles": [
    {
      "name": "我的轿车", "brand": "丰田", "model": "凯美瑞", "plateNo": "京A12345",
      "defaultFuelType": "P95",
      "coverImage": { "filename": "xxx.jpg", "mimeType": "image/jpeg", "dataBase64": "..." },
      "coverCrop": { "x": 0, "y": 0, "width": 100, "height": 56, "zoom": 1 },
      "maintenanceRecords": [
        { "date": "2026-01-01T00:00:00.000Z", "mileage": 12000, "remark": "换机油", "discountAmount": 10,
          "items": [{ "project": "机油", "brand": "美孚", "quantity": 1, "price": 300 }] }
      ],
      "fuelRecords": [
        { "date": "2026-01-02T00:00:00.000Z", "mileage": 12100, "volume": 40, "unitPrice": 7.8,
          "fuelType": "P95", "isFullTank": true, "lastRecorded": true, "remark": null }
      ]
    }
  ]
}
```

导入接口的行为：

- **不会覆盖或删除已有数据**，导入内容以新增车辆的形式加入当前账号，可以重复导入。
- **整批导入是一个数据库事务**：任意一辆车、任意一条记录校验或写入失败，整批全部回滚，不会出现"导出时有 2 辆车，导入后却只剩 1 辆"这种因为中途失败导致的部分导入。失败时返回 `400`，`message` 里会写明具体是哪辆车/哪个字段有问题。
- **拒绝"来自未来"的导出文件**：如果导出文件的 `schemaVersion` 比当前系统支持的版本更新（比如用新版本导出、拿到旧版本系统导入），会直接返回 `400` 拒绝，而不是静默丢弃新增字段导致数据不完整。
- 请求体大小上限 `50MB`（其余接口是 `2MB`），足够容纳多辆车、每辆车一张 8MB 封面图片；对应地，`nginx/reverse-proxy.conf` 的 `client_max_body_size` 也放宽到了 `50m`。

成功响应：

```json
{ "importedVehicles": 2, "importedMaintenance": 3, "importedFuel": 12, "importedImages": 1 }
```

## 统计 `/api/stats`

需要登录。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/overview?year=2026` | 跨车辆汇总统计：总车辆数、保养/加油/总支出、每辆车的费用构成、支出趋势，供首页仪表盘图表使用 |

`year` 为可选查询参数：传具体年份（如 `2026`）只统计该年数据，`monthlyTrend` 固定返回该年 1-12 月；传 `all` 或不传则统计全部历史数据，`monthlyTrend` 返回从最早到最新记录跨越的每个月。`latestMileage` 始终按全部历史数据计算，不受年份筛选影响（里程是累计值）。

响应示例：

```json
{
  "year": 2026,
  "availableYears": [2026, 2025, 2024],
  "totalVehicles": 2,
  "totalMaintenanceCost": 1280.5,
  "totalFuelCost": 3450.2,
  "totalCost": 4730.7,
  "perVehicle": [
    { "vehicleId": "uuid", "name": "我的轿车", "maintenanceCost": 800, "fuelCost": 2000, "totalCost": 2800,
      "fuelVolume": 320.5, "maintenanceRecordCount": 5, "fuelRecordCount": 20, "latestMileage": 35000 }
  ],
  "monthlyTrend": [{ "month": "2026-01", "maintenanceCost": 100, "fuelCost": 300 }]
}
```

`availableYears` 是该用户全部数据里实际出现过的年份（不受当前 `year` 筛选影响），前端用它渲染"2026年 / 2025年 / 全部"这类年份选择器。

## 其他

| 方法 | 路径 | 说明 | 需要登录 |
|---|---|---|---|
| GET | `/api/health` | 健康检查，同时返回版本信息：`{ status, version, commit }`（`version` 见 `src/version.ts`，`commit` 是构建镜像时 CI 注入的 git commit sha，本地开发环境为 `"dev"`）；前端「账户设置」页面用这个接口显示后端版本 | 否 |
| GET | `/uploads/:filename` | 静态访问已上传的车辆封面图片 | 否（图片本身不含敏感信息） |

## 错误响应格式

统一为：

```json
{ "message": "错误描述" }
```

常见状态码：`400` 参数错误、`401` 未登录或令牌失效、`403` IP 被拉黑、`404` 资源不存在或无权限、`409` 邮箱已注册、`423` 账号被临时锁定、`429` 请求过于频繁、`500` 服务器错误。
