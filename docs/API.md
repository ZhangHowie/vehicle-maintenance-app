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
| GET | `/export?format=json` | 导出全部车辆及记录为 JSON 文件下载 |
| GET | `/export?format=csv` | 导出为 CSV + 原始 JSON 打包的 zip 文件下载 |
| POST | `/import` | 导入 `export?format=json` 格式的 JSON（作为请求体），批量重建车辆/保养/油耗记录（不含图片文件） |

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
| GET | `/api/health` | 健康检查 | 否 |
| GET | `/uploads/:filename` | 静态访问已上传的车辆封面图片 | 否（图片本身不含敏感信息） |

## 错误响应格式

统一为：

```json
{ "message": "错误描述" }
```

常见状态码：`400` 参数错误、`401` 未登录或令牌失效、`403` IP 被拉黑、`404` 资源不存在或无权限、`409` 邮箱已注册、`423` 账号被临时锁定、`429` 请求过于频繁、`500` 服务器错误。
