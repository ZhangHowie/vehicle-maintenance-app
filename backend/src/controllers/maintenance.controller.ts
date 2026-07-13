import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";
import { toPlain } from "../utils/serialize";

// 数字字段用 z.coerce.number()，兼容前端编辑时把 Prisma Decimal（序列化为字符串）原样回传的情况，
// 而不是要求严格的 number 类型（否则会报"Expected number, received string"）。
// 可选字符串字段（brand / remark）用 .nullable()：编辑记录时前端会把没填过的字段原样回传，
// 值是 null 而不是 undefined（因为是从后端读出来的），只用 .optional() 会拒绝 null
// 报"Expected string, received null"。
const itemSchema = z.object({
  project: z.string().min(1, "请填写保养项目"),
  brand: z.string().nullable().optional(),
  quantity: z.coerce.number().int().positive().default(1),
  price: z.coerce.number().nonnegative(),
});

const recordSchema = z.object({
  date: z.string().datetime().or(z.string()),
  mileage: z.coerce.number().int().nonnegative().optional(),
  remark: z.string().nullable().optional(),
  // 整单优惠金额（例如满减、抹零），从各项目合计中扣除
  discountAmount: z.coerce.number().nonnegative().optional().default(0),
  items: z.array(itemSchema).min(1, "至少填写一个保养项目"),
});

async function ensureVehicleOwnership(vehicleId: string, userId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.userId !== userId) throw new ApiError(404, "车辆不存在");
  return vehicle;
}

async function ensureRecordOwnership(recordId: string, userId: string) {
  const record = await prisma.maintenanceRecord.findUnique({ where: { id: recordId }, include: { vehicle: true } });
  if (!record || record.vehicle.userId !== userId) throw new ApiError(404, "保养记录不存在");
  return record;
}

function computeTotal(items: { quantity: number; price: number }[], discountAmount = 0): number {
  const itemsSum = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  return Math.max(0, Math.round((itemsSum - discountAmount) * 100) / 100);
}

export async function listMaintenanceRecords(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const records = await prisma.maintenanceRecord.findMany({
    where: { vehicleId: req.params.vehicleId },
    include: { items: true },
    orderBy: { date: "desc" },
  });
  res.json(toPlain(records));
}

export async function createMaintenanceRecord(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const body = recordSchema.parse(req.body);
  const totalPrice = computeTotal(body.items, body.discountAmount);

  const record = await prisma.maintenanceRecord.create({
    data: {
      vehicleId: req.params.vehicleId,
      date: new Date(body.date),
      mileage: body.mileage,
      remark: body.remark,
      discountAmount: body.discountAmount,
      totalPrice,
      items: { create: body.items },
    },
    include: { items: true },
  });
  res.status(201).json(toPlain(record));
}

export async function updateMaintenanceRecord(req: Request, res: Response) {
  await ensureRecordOwnership(req.params.id, req.userId!);
  const body = recordSchema.parse(req.body);
  const totalPrice = computeTotal(body.items, body.discountAmount);

  const record = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.maintenanceItem.deleteMany({ where: { maintenanceRecordId: req.params.id } });
    return tx.maintenanceRecord.update({
      where: { id: req.params.id },
      data: {
        date: new Date(body.date),
        mileage: body.mileage,
        remark: body.remark,
        discountAmount: body.discountAmount,
        totalPrice,
        items: { create: body.items },
      },
      include: { items: true },
    });
  });
  res.json(toPlain(record));
}

export async function deleteMaintenanceRecord(req: Request, res: Response) {
  await ensureRecordOwnership(req.params.id, req.userId!);
  await prisma.maintenanceRecord.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
