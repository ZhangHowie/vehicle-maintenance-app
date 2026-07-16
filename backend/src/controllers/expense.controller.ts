import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";
import { toPlain } from "../utils/serialize";

const expenseRecordSchema = z.object({
  date: z.string().datetime().or(z.string()),
  item: z.string().min(1, "请填写消费项目"),
  amount: z.coerce.number().nonnegative(),
  remark: z.string().nullable().optional(),
});

async function ensureVehicleOwnership(vehicleId: string, userId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.userId !== userId) throw new ApiError(404, "车辆不存在");
  return vehicle;
}

async function ensureRecordOwnership(recordId: string, userId: string) {
  const record = await prisma.expenseRecord.findUnique({ where: { id: recordId }, include: { vehicle: true } });
  if (!record || record.vehicle.userId !== userId) throw new ApiError(404, "消费记录不存在");
  return record;
}

export async function listExpenseRecords(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const records = await prisma.expenseRecord.findMany({
    where: { vehicleId: req.params.vehicleId },
    orderBy: { date: "desc" },
  });
  res.json(toPlain(records));
}

export async function createExpenseRecord(req: Request, res: Response) {
  await ensureVehicleOwnership(req.params.vehicleId, req.userId!);
  const body = expenseRecordSchema.parse(req.body);
  const record = await prisma.expenseRecord.create({
    data: { ...body, date: new Date(body.date), vehicleId: req.params.vehicleId },
  });
  res.status(201).json(toPlain(record));
}

export async function updateExpenseRecord(req: Request, res: Response) {
  await ensureRecordOwnership(req.params.id, req.userId!);
  const body = expenseRecordSchema.parse(req.body);
  const record = await prisma.expenseRecord.update({
    where: { id: req.params.id },
    data: { ...body, date: new Date(body.date) },
  });
  res.json(toPlain(record));
}

export async function deleteExpenseRecord(req: Request, res: Response) {
  await ensureRecordOwnership(req.params.id, req.userId!);
  await prisma.expenseRecord.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
