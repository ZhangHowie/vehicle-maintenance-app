import { Request, Response } from "express";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";
import { toPlain } from "../utils/serialize";

// ============================================================================
// 导出 / 导入数据格式说明
//
// 导出文件带一个 schemaVersion 字段，标识“车辆及其记录”这部分数据结构的版本号，
// 跟应用本身的版本号（package.json version）是两回事——只要车辆/记录/图片这几张表的
// 导出结构不变，即使应用升级了很多次，schemaVersion 也不需要跟着变。
// 只有当导出的字段结构发生不兼容变化时才递增 schemaVersion，并在 importData 里为老版本
// 数据做兼容处理，这样老版本导出的文件在新版本系统上依然能正确导入，不会因为升级后
// 字段变化导致导入出现数据异常或者莫名其妙的字段丢失。
//
// v1（早期版本）：vehicles[].{name,brand,model,plateNo,defaultFuelType,maintenanceRecords,fuelRecords}
//                 不含封面图片、不含裁剪范围。
// v2：在 v1 基础上新增 vehicles[].coverImage（图片内容以 base64 内嵌，
//                 不是只存一个引用别的服务器上文件的 URL——否则导入到另一台机器/换了新的
//                 uploads 数据卷之后图片必然是失效的）和 vehicles[].coverCrop（封面裁剪范围）。
// v3（当前版本）：在 v2 基础上新增 vehicles[].expenseRecords（其他消费记录：停车费/行车
//                 记录仪/脚垫等）。v1/v2 文件没有这个字段，导入时按空数组处理。
// ============================================================================

const CURRENT_SCHEMA_VERSION = 3;
const MIN_SUPPORTED_SCHEMA_VERSION = 1;

const uploadsDir = path.join(process.cwd(), "uploads");
const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const extToMime: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const mimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
// 单张封面图片解码后的大小上限，跟上传接口（middleware/upload.ts）保持一致，
// 防止有人伪造一个超大的导入文件把磁盘打爆。
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// 把数据库里的一批车辆（含关联的保养/油耗记录）整理成导出 JSON 的结构，
// 车辆封面图片会从磁盘读出来、按 base64 内嵌进去，保证导出文件是完全自包含的——
// 换一台机器 / 换一个全新的 uploads 数据卷，只靠这一个 JSON 文件就能把图片也恢复出来。
async function buildExportPayload(vehiclesRaw: Awaited<ReturnType<typeof fetchVehiclesForExport>>) {
  const vehicles = await Promise.all(
    vehiclesRaw.map(async (v: Awaited<ReturnType<typeof fetchVehiclesForExport>>[number]) => {
      const plain = toPlain(v);
      let coverImage: { filename: string; mimeType: string; dataBase64: string } | null = null;

      if (plain.coverImageUrl) {
        const filename = path.basename(plain.coverImageUrl as string);
        const filePath = path.join(uploadsDir, filename);
        try {
          const buffer = await fs.promises.readFile(filePath);
          const ext = path.extname(filename).toLowerCase();
          coverImage = {
            filename,
            mimeType: extToMime[ext] ?? "application/octet-stream",
            dataBase64: buffer.toString("base64"),
          };
        } catch {
          // 封面文件在磁盘上已经找不到了（比如手动清理过 uploads 卷），
          // 不影响导出其它数据，跳过图片即可，不让整个导出失败。
          console.warn(`[导出] 车辆 ${plain.name} 的封面文件缺失，已跳过：${filePath}`);
        }
      }

      return {
        name: plain.name as string,
        brand: (plain.brand as string | null) ?? null,
        model: (plain.model as string | null) ?? null,
        plateNo: (plain.plateNo as string | null) ?? null,
        defaultFuelType: plain.defaultFuelType,
        coverImage,
        coverCrop: plain.coverCrop ?? null,
        maintenanceRecords: (plain.maintenanceRecords as any[]).map((r) => ({
          // 显式转成 ISO 字符串（而不是留一个 Date 实例）：这份对象既用于 JSON.stringify
          // 导出，也直接用于下面 CSV 拼接时的 .join(",")——Date 实例被数组 join 时会走
          // toString() 得到形如 "Wed Jan 01 2026 00:00:00 GMT+0000 (UTC)" 的本地化字符串，
          // 中间还可能带逗号，会把 CSV 的列错开。
          date: r.date instanceof Date ? r.date.toISOString() : r.date,
          mileage: r.mileage ?? null,
          remark: r.remark ?? null,
          discountAmount: r.discountAmount ?? 0,
          items: (r.items as any[]).map((item) => ({
            project: item.project,
            brand: item.brand ?? null,
            quantity: item.quantity,
            price: item.price,
          })),
        })),
        fuelRecords: (plain.fuelRecords as any[]).map((f) => ({
          date: f.date instanceof Date ? f.date.toISOString() : f.date,
          mileage: f.mileage,
          volume: f.volume,
          unitPrice: f.unitPrice,
          fuelType: f.fuelType,
          isFullTank: f.isFullTank,
          lastRecorded: f.lastRecorded,
          remark: f.remark ?? null,
        })),
        expenseRecords: (plain.expenseRecords as any[]).map((e) => ({
          date: e.date instanceof Date ? e.date.toISOString() : e.date,
          item: e.item,
          amount: e.amount,
          remark: e.remark ?? null,
        })),
      };
    })
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    vehicleCount: vehicles.length,
    vehicles,
  };
}

function fetchVehiclesForExport(userId: string) {
  return prisma.vehicle.findMany({
    where: { userId },
    include: { maintenanceRecords: { include: { items: true } }, fuelRecords: true, expenseRecords: true },
    orderBy: { createdAt: "asc" },
  });
}

// 导出当前用户的全部数据（所有车辆 + 保养记录 + 油耗记录 + 封面图片）为 JSON，用于备份/迁移。
export async function exportData(req: Request, res: Response) {
  const vehiclesRaw = await fetchVehiclesForExport(req.userId!);
  const payload = await buildExportPayload(vehiclesRaw);

  const format = (req.query.format as string) ?? "json";

  if (format === "csv") {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=vehicle-data-export.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    const maintenanceRows = ["车辆,日期,里程,项目,品牌,数量,单价,优惠金额,备注"];
    const fuelRows = ["车辆,日期,里程,加油量(L),单价,油品,是否加满,上次是否记录,备注"];
    const expenseRows = ["车辆,日期,项目,金额,备注"];

    for (const v of payload.vehicles) {
      for (const r of v.maintenanceRecords) {
        for (const item of r.items) {
          maintenanceRows.push(
            [
              v.name,
              r.date,
              r.mileage ?? "",
              item.project,
              item.brand ?? "",
              item.quantity,
              item.price,
              r.discountAmount ?? 0,
              String(r.remark ?? "").replace(/,/g, "，"),
            ].join(",")
          );
        }
      }
      for (const f of v.fuelRecords) {
        fuelRows.push(
          [v.name, f.date, f.mileage, f.volume, f.unitPrice, f.fuelType, f.isFullTank, f.lastRecorded, String(f.remark ?? "").replace(/,/g, "，")].join(",")
        );
      }
      for (const e of v.expenseRecords) {
        expenseRows.push(
          [v.name, e.date, e.item, e.amount, String(e.remark ?? "").replace(/,/g, "，")].join(",")
        );
      }
    }

    archive.append(maintenanceRows.join("\n"), { name: "maintenance_records.csv" });
    archive.append(fuelRows.join("\n"), { name: "fuel_records.csv" });
    archive.append(expenseRows.join("\n"), { name: "expense_records.csv" });
    // 完整 JSON（含图片）也一并打进压缩包，CSV 只是给人肉眼看/导 Excel 用的，
    // 真正要拿去导入恢复数据，请用这份 full_export.json。
    archive.append(JSON.stringify(payload, null, 2), { name: "full_export.json" });
    await archive.finalize();
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=vehicle-data-export.json");
  res.send(JSON.stringify(payload, null, 2));
}

const fuelTypeEnum = z.enum(["P92", "P95", "P98", "DIESEL", "ELECTRIC"]);

const coverImageSchema = z
  .object({
    filename: z.string().optional(),
    mimeType: z.string().optional(),
    dataBase64: z.string(),
  })
  .nullable()
  .optional();

// 里程、数量在数据库里是 Int 字段，如果直接把浮点数传给 Prisma 会抛
// PrismaClientValidationError（比如 "Expected Int, provided Float."），在事务里
// 表现为一次莫名其妙的 500。这里统一 round 成整数，防患于未然——正常的里程数/
// 保养项目数量本来也不应该是小数。
const toIntOrNull = z.coerce
  .number()
  .nullable()
  .optional()
  .transform((v) => (v === null || v === undefined ? v : Math.round(v)));
const toInt = z.coerce.number().transform((v) => Math.round(v));

// 这份 zod schema 对 v1/v2 都通用：v1 导出的文件里没有 coverImage/coverCrop 字段，
// 在这里都是 .nullable().optional()，缺失时会落到 undefined，自然跳过图片导入，
// 不会因为老版本文件缺字段而校验失败。
const vehicleImportSchema = z.object({
  name: z.string().min(1, "车辆名称不能为空"),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  plateNo: z.string().nullable().optional(),
  defaultFuelType: fuelTypeEnum.default("P92"),
  coverImage: coverImageSchema,
  coverCrop: z.any().nullable().optional(),
  maintenanceRecords: z
    .array(
      z.object({
        date: z.string(),
        mileage: toIntOrNull,
        remark: z.string().nullable().optional(),
        discountAmount: z.coerce.number().nonnegative().nullable().optional().default(0),
        items: z.array(
          z.object({
            project: z.string(),
            brand: z.string().nullable().optional(),
            quantity: toInt,
            price: z.coerce.number(),
          })
        ),
      })
    )
    .default([]),
  fuelRecords: z
    .array(
      z.object({
        date: z.string(),
        mileage: toInt,
        volume: z.coerce.number(),
        unitPrice: z.coerce.number(),
        fuelType: fuelTypeEnum,
        isFullTank: z.boolean().default(true),
        lastRecorded: z.boolean().default(true),
        remark: z.string().nullable().optional(),
      })
    )
    .default([]),
  // v1/v2 导出文件没有这个字段，缺失时按空数组处理（不是导入失败）
  expenseRecords: z
    .array(
      z.object({
        date: z.string(),
        item: z.string(),
        amount: z.coerce.number(),
        remark: z.string().nullable().optional(),
      })
    )
    .default([]),
});

const importPayloadSchema = z.object({
  vehicles: z.array(vehicleImportSchema).min(1, "导入文件里没有任何车辆数据"),
});

function extractSchemaVersion(raw: unknown): number {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // 新版本字段名是 schemaVersion；老版本（重构前）导出文件用的字段名是 version，
    // 值恒为 1，这里当作 v1 兼容处理。
    if (typeof obj.schemaVersion === "number") return obj.schemaVersion;
    if (typeof obj.version === "number") return obj.version;
  }
  return NaN;
}

function extFromCoverImage(img: { filename?: string; mimeType?: string }): string {
  if (img.mimeType && mimeToExt[img.mimeType]) return mimeToExt[img.mimeType];
  if (img.filename) {
    const ext = path.extname(img.filename).toLowerCase();
    if (allowedExt.has(ext)) return ext;
  }
  return ".jpg";
}

// 导入数据：接收 exportData 产出的 JSON（v1 或 v2 均可），重新创建为当前用户的数据，
// 包含车辆封面图片。整个导入过程在一个数据库事务里完成——只要有任何一辆车、任何一条记录
// 校验或写入失败，整批导入全部回滚，不会出现“导出时明明有 2 辆车，导入后却只剩 1 辆”这种
// 因为中途失败导致的部分导入、数据不完整的情况；失败时会返回具体是哪里出了问题。
export async function importData(req: Request, res: Response) {
  const raw = req.body;
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as any).vehicles)) {
    throw new ApiError(400, "导入数据格式不正确：文件内容不是有效的导出 JSON（缺少 vehicles 数组）");
  }

  const schemaVersion = extractSchemaVersion(raw);
  if (!Number.isFinite(schemaVersion)) {
    throw new ApiError(400, "导入数据格式不正确：文件缺少版本号（schemaVersion），可能不是本系统导出的文件");
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ApiError(
      400,
      `这份备份文件的版本（v${schemaVersion}）比当前系统支持的版本（v${CURRENT_SCHEMA_VERSION}）更新，请先把系统升级到最新版本再导入，避免新字段被忽略导致数据异常`
    );
  }
  if (schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    throw new ApiError(400, `不支持的备份文件版本：v${schemaVersion}`);
  }

  const body = importPayloadSchema.parse(raw);
  const userId = req.userId!;

  // 记录这次导入过程中新写入磁盘的图片文件路径，一旦数据库事务因为任何原因回滚，
  // 这些还没有被任何 vehicle 记录引用的孤儿文件也要一并删掉，避免残留垃圾文件。
  const writtenFiles: string[] = [];

  try {
    const summary = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let importedVehicles = 0;
        let importedMaintenance = 0;
        let importedFuel = 0;
        let importedExpense = 0;
        let importedImages = 0;

        for (const v of body.vehicles) {
          let coverImageUrl: string | undefined;
          let coverCrop: Prisma.InputJsonValue | undefined;

          if (v.coverImage?.dataBase64) {
            const ext = extFromCoverImage(v.coverImage);
            if (!allowedExt.has(ext)) {
              throw new ApiError(400, `车辆「${v.name}」的封面图片格式不受支持`);
            }
            const buffer = Buffer.from(v.coverImage.dataBase64, "base64");
            if (buffer.length === 0) {
              throw new ApiError(400, `车辆「${v.name}」的封面图片数据为空或无法解码`);
            }
            if (buffer.length > MAX_IMAGE_BYTES) {
              throw new ApiError(400, `车辆「${v.name}」的封面图片超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 限制`);
            }
            const filename = `${uuid()}${ext}`;
            const filePath = path.join(uploadsDir, filename);
            await fs.promises.writeFile(filePath, buffer);
            writtenFiles.push(filePath);
            coverImageUrl = `/uploads/${filename}`;
            importedImages++;
          }

          if (v.coverCrop !== null && v.coverCrop !== undefined) {
            coverCrop = v.coverCrop as Prisma.InputJsonValue;
          }

          const vehicle = await tx.vehicle.create({
            data: {
              userId,
              name: v.name,
              brand: v.brand ?? undefined,
              model: v.model ?? undefined,
              plateNo: v.plateNo ?? undefined,
              defaultFuelType: v.defaultFuelType,
              coverImageUrl,
              coverCrop,
            },
          });
          importedVehicles++;

          for (const r of v.maintenanceRecords) {
            const discountAmount = r.discountAmount ?? 0;
            const itemsSum = r.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
            const totalPrice = Math.max(0, Math.round((itemsSum - discountAmount) * 100) / 100);
            await tx.maintenanceRecord.create({
              data: {
                vehicleId: vehicle.id,
                date: new Date(r.date),
                mileage: r.mileage ?? undefined,
                remark: r.remark ?? undefined,
                discountAmount,
                totalPrice,
                items: { create: r.items },
              },
            });
            importedMaintenance++;
          }

          for (const f of v.fuelRecords) {
            await tx.fuelRecord.create({
              data: {
                vehicleId: vehicle.id,
                date: new Date(f.date),
                mileage: f.mileage,
                volume: f.volume,
                unitPrice: f.unitPrice,
                fuelType: f.fuelType,
                isFullTank: f.isFullTank,
                lastRecorded: f.lastRecorded,
                remark: f.remark ?? undefined,
              },
            });
            importedFuel++;
          }

          for (const e of v.expenseRecords) {
            await tx.expenseRecord.create({
              data: {
                vehicleId: vehicle.id,
                date: new Date(e.date),
                item: e.item,
                amount: e.amount,
                remark: e.remark ?? undefined,
              },
            });
            importedExpense++;
          }
        }

        return { importedVehicles, importedMaintenance, importedFuel, importedExpense, importedImages };
      },
      // 一次性导入多辆车、多条记录、多张图片可能比默认的 5s 事务超时要长，适当放宽。
      { maxWait: 15000, timeout: 120000 }
    );

    res.json(summary);
  } catch (err) {
    for (const filePath of writtenFiles) {
      fs.promises.unlink(filePath).catch(() => {});
    }
    throw err;
  }
}

export async function importDataGuard(req: Request, _res: Response) {
  if (!req.body || typeof req.body !== "object") {
    throw new ApiError(400, "导入数据格式不正确");
  }
}
