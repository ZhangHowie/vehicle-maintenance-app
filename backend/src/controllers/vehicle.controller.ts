import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";

const fuelTypeEnum = z.enum(["P92", "P95", "P98", "DIESEL", "ELECTRIC"]);

// 可选字符串字段用 .nullable()：编辑车辆时前端会把没填过的字段原样回传（值是 null 而不是
// undefined，因为数据是从后端读出来再回填的），如果只用 .optional() 会拒绝 null 报
// "Expected string, received null"。
const vehicleSchema = z.object({
  name: z.string().min(1, "请填写车辆名称"),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  plateNo: z.string().nullable().optional(),
  defaultFuelType: fuelTypeEnum.default("P92"),
});

async function ensureOwnership(vehicleId: string, userId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.userId !== userId) throw new ApiError(404, "车辆不存在");
  return vehicle;
}

export async function listVehicles(req: Request, res: Response) {
  const vehicles = await prisma.vehicle.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json(vehicles);
}

export async function createVehicle(req: Request, res: Response) {
  const body = vehicleSchema.parse(req.body);
  const vehicle = await prisma.vehicle.create({ data: { ...body, userId: req.userId! } });
  res.status(201).json(vehicle);
}

export async function getVehicle(req: Request, res: Response) {
  const vehicle = await ensureOwnership(req.params.id, req.userId!);
  res.json(vehicle);
}

export async function updateVehicle(req: Request, res: Response) {
  await ensureOwnership(req.params.id, req.userId!);
  const body = vehicleSchema.partial().parse(req.body);
  const vehicle = await prisma.vehicle.update({ where: { id: req.params.id }, data: body });
  res.json(vehicle);
}

export async function deleteVehicle(req: Request, res: Response) {
  await ensureOwnership(req.params.id, req.userId!);
  await prisma.vehicle.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

// 上传/更新车辆封面图及裁剪范围
export async function uploadCover(req: Request, res: Response) {
  await ensureOwnership(req.params.id, req.userId!);
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new ApiError(400, "请上传图片");

  let coverCrop: Prisma.InputJsonValue | undefined = undefined;
  if (req.body.crop) {
    try {
      coverCrop = JSON.parse(req.body.crop) as Prisma.InputJsonValue;
    } catch {
      throw new ApiError(400, "裁剪范围参数格式不正确");
    }
  }

  const vehicle = await prisma.vehicle.update({
    where: { id: req.params.id },
    data: {
      coverImageUrl: `/uploads/${file.filename}`,
      ...(coverCrop !== undefined ? { coverCrop } : {}),
    },
  });
  res.json(vehicle);
}
