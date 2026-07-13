import { Request, Response } from "express";
import archiver from "archiver";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";
import { toPlain } from "../utils/serialize";

// 导出当前用户的全部数据为 JSON（车辆、保养记录、油耗记录），用于备份/迁移
export async function exportData(req: Request, res: Response) {
  const vehiclesRaw = await prisma.vehicle.findMany({
    where: { userId: req.userId! },
    include: { maintenanceRecords: { include: { items: true } }, fuelRecords: true },
  });
  // Decimal 字段（金额、加油量等）转换成普通 number，保证导出的 JSON 能被 /import 原样导入，
  // 也方便直接用文本编辑器查看和修改。
  const vehicles = toPlain(vehiclesRaw);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    vehicles,
  };

  const format = (req.query.format as string) ?? "json";

  if (format === "csv") {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=vehicle-data-export.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    const maintenanceRows = ["车辆,日期,里程,项目,品牌,数量,单价,优惠金额,备注"];
    const fuelRows = ["车辆,日期,里程,加油量(L),单价,油品,是否加满,上次是否记录,备注"];

    for (const v of vehicles) {
      for (const r of v.maintenanceRecords) {
        for (const item of r.items) {
          maintenanceRows.push(
            [
              v.name,
              r.date.toISOString(),
              r.mileage ?? "",
              item.project,
              item.brand ?? "",
              item.quantity,
              item.price,
              r.discountAmount ?? 0,
              (r.remark ?? "").replace(/,/g, "，"),
            ].join(",")
          );
        }
      }
      for (const f of v.fuelRecords) {
        fuelRows.push(
          [v.name, f.date.toISOString(), f.mileage, f.volume, f.unitPrice, f.fuelType, f.isFullTank, f.lastRecorded, (f.remark ?? "").replace(/,/g, "，")].join(",")
        );
      }
    }

    archive.append(maintenanceRows.join("\n"), { name: "maintenance_records.csv" });
    archive.append(fuelRows.join("\n"), { name: "fuel_records.csv" });
    archive.append(JSON.stringify(payload, null, 2), { name: "full_export.json" });
    await archive.finalize();
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=vehicle-data-export.json");
  res.send(JSON.stringify(payload, null, 2));
}

const importSchema = z.object({
  vehicles: z.array(
    z.object({
      name: z.string(),
      brand: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      plateNo: z.string().nullable().optional(),
      defaultFuelType: z.enum(["P92", "P95", "P98", "DIESEL", "ELECTRIC"]).default("P92"),
      maintenanceRecords: z
        .array(
          z.object({
            date: z.string(),
            mileage: z.coerce.number().nullable().optional(),
            remark: z.string().nullable().optional(),
            discountAmount: z.coerce.number().nonnegative().nullable().optional().default(0),
            items: z.array(
              z.object({
                project: z.string(),
                brand: z.string().nullable().optional(),
                quantity: z.coerce.number(),
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
            mileage: z.coerce.number(),
            volume: z.coerce.number(),
            unitPrice: z.coerce.number(),
            fuelType: z.enum(["P92", "P95", "P98", "DIESEL", "ELECTRIC"]),
            isFullTank: z.boolean().default(true),
            lastRecorded: z.boolean().default(true),
            remark: z.string().nullable().optional(),
          })
        )
        .default([]),
    })
  ),
});

// 导入数据：接收 exportData 产出的 JSON 格式，重新创建为当前用户的数据（不导入图片文件）
export async function importData(req: Request, res: Response) {
  const body = importSchema.parse(req.body);
  const userId = req.userId!;

  let importedVehicles = 0;
  let importedMaintenance = 0;
  let importedFuel = 0;

  for (const v of body.vehicles) {
    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        name: v.name,
        brand: v.brand ?? undefined,
        model: v.model ?? undefined,
        plateNo: v.plateNo ?? undefined,
        defaultFuelType: v.defaultFuelType,
      },
    });
    importedVehicles++;

    for (const r of v.maintenanceRecords) {
      const discountAmount = r.discountAmount ?? 0;
      const itemsSum = r.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
      const totalPrice = Math.max(0, Math.round((itemsSum - discountAmount) * 100) / 100);
      await prisma.maintenanceRecord.create({
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
      await prisma.fuelRecord.create({
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
  }

  res.json({ importedVehicles, importedMaintenance, importedFuel });
}

export async function importDataGuard(req: Request, _res: Response) {
  if (!req.body || typeof req.body !== "object") {
    throw new ApiError(400, "导入数据格式不正确");
  }
}
