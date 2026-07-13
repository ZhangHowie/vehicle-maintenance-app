import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";
import { toPlain } from "../utils/serialize";

const fuelTypeEnum = z.enum(["P92", "P95", "P98", "DIESEL", "ELECTRIC"]);

// 数字字段用 z.coerce.number()，兼容前端编辑时把 Prisma Decimal（序列化为字符串）原样回传的情况，
// 而不是要求严格的 number 类型（否则会报"Expected number, received string”）。
const fuelRecordSchema = z.object({
  date: z.string().datetime().or(z.string()),
  mileage: z.coerce.number().int().nonnegative(),
  volume: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  fuelType: fuelTypeEnum,
  isFullTank: z.boolean().default(true),
  lastRecorded: z.boolean().default(true),
  // .nullable()：编辑记录时前端会把没填过的备注原样回传（值是 null），只用 .optional()
  // 会拒绝 null 报"Expected string, received null"。
  remark: z.string().nullable().optional(),
});

async function ensureVehicleOwnership(vehicleId: string, userId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.userId !== userId) throw new ApiError(404, "车辆不存在");
  return vehicle;
}

async function ensureRecordOwnership(recordId: string, userId: string) {
  const record = await prisma.fuelRecord.findUnique({ where: { id: recordId }, include: { vehicle: true } });
  if (!record || record.vehicle.userId !== userId) throw new ApiError(404, "油耗记录不存在");
  return record;
}

export async function listFuelRecords(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const records = await prisma.fuelRecord.findMany({
    where: { vehicleId: req.params.vehicleId },
    orderBy: { date: "desc" },
  });
  res.json(toPlain(records));
}

export async function createFuelRecord(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const body = fuelRecordSchema.parse(req.body);
  const record = await prisma.fuelRecord.create({
    data: { ...body, date: new Date(body.date), vehicleId: req.params.vehicleId },
  });
  res.status(201).json(toPlain(record));
}

export async function updateFuelRecord(req: Request, res: Response) {
  await ensureRecordOwnership(req.params.id, req.userId!);
  const body = fuelRecordSchema.parse(req.body);
  const record = await prisma.fuelRecord.update({
    where: { id: req.params.id },
    data: { ...body, date: new Date(body.date) },
  });
  res.json(toPlain(record));
}

export async function deleteFuelRecord(req: Request, res: Response) {
  await ensureRecordOwnership(req.params.id, req.userId!);
  await prisma.fuelRecord.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

// 油耗统计：采用"两次加满之间累计加油量"的标准算法。
// - 只有加满（isFullTank）时的记录才能作为可靠的里程基准点（因为只有加满才能确定油箱状态）。
// - 从上一个基准点到当前记录之间，把期间所有加油量累加起来，除以里程差，得到这一段的百公里油耗。
// - 只要中间任何一条记录的"上次是否记录"（lastRecorded）为 false，说明这条记录之前有一次没被记录的
//   加油，累计的加油量不可信，直接丢弃这一段；如果这条记录本身是加满，则以它为起点重新开始累计。
export async function fuelStats(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const records = await prisma.fuelRecord.findMany({
    where: { vehicleId: req.params.vehicleId },
    orderBy: { mileage: "asc" },
  });

  const segments: {
    fromMileage: number;
    toMileage: number;
    date: Date;
    litersPer100km: number;
  }[] = [];

  let referenceMileage: number | null = null;
  let accumulatedVolume = 0;

  for (const record of records) {
    if (!record.lastRecorded) {
      // 链路被打断：这条记录之前有未记录的加油，之前累计的量不可信
      referenceMileage = record.isFullTank ? record.mileage : null;
      accumulatedVolume = 0;
      continue;
    }

    accumulatedVolume += Number(record.volume);

    if (record.isFullTank) {
      if (referenceMileage !== null) {
        const distance = record.mileage - referenceMileage;
        if (distance > 0) {
          segments.push({
            fromMileage: referenceMileage,
            toMileage: record.mileage,
            date: record.date,
            litersPer100km: Number(((accumulatedVolume / distance) * 100).toFixed(2)),
          });
        }
      }
      referenceMileage = record.mileage;
      accumulatedVolume = 0;
    }
    // 未加满：继续累计，等下一次加满时再结算
  }

  const recentLitersPer100km = segments.length > 0 ? segments[segments.length - 1].litersPer100km : null;
  const averageLitersPer100km =
    segments.length > 0
      ? Number((segments.reduce((s, x) => s + x.litersPer100km, 0) / segments.length).toFixed(2))
      : null;

  res.json({ segments, recentLitersPer100km, averageLitersPer100km });
}
