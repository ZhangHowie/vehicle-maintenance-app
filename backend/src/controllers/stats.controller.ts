import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

type VehicleWithRecords = Prisma.VehicleGetPayload<{
  include: { maintenanceRecords: true; fuelRecords: true; expenseRecords: true };
}>;
type MaintenanceRecordRow = VehicleWithRecords["maintenanceRecords"][number];
type FuelRecordRow = VehicleWithRecords["fuelRecords"][number];
type ExpenseRecordRow = VehicleWithRecords["expenseRecords"][number];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// 解析 ?year= 参数：不传 / 传 "all" / 传非法值都当作"全部年份"；否则解析成具体年份
function parseYearParam(raw: unknown): number | "all" {
  if (typeof raw !== "string" || raw === "all" || raw.trim() === "") return "all";
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1970 && n <= 9999) return n;
  return "all";
}

// 跨车辆的汇总统计：总支出、每辆车的费用构成、支出趋势，供首页仪表盘使用。
// 支持 ?year=2026 按年筛选，?year=all 或不传则统计全部历史数据。
export async function overview(req: Request, res: Response) {
  const yearParam = parseYearParam(req.query.year);

  const vehicles: VehicleWithRecords[] = await prisma.vehicle.findMany({
    where: { userId: req.userId! },
    include: { maintenanceRecords: true, fuelRecords: true, expenseRecords: true },
    orderBy: { createdAt: "asc" },
  });

  // 可选年份列表，始终反映该用户全部数据里实际出现过的年份，不受当前筛选影响，
  // 用于前端渲染"2026年 / 2025年 / 全部"这类年份选择器。
  const yearSet = new Set<number>();
  for (const v of vehicles) {
    for (const r of v.maintenanceRecords) yearSet.add(r.date.getFullYear());
    for (const r of v.fuelRecords) yearSet.add(r.date.getFullYear());
    for (const r of v.expenseRecords) yearSet.add(r.date.getFullYear());
  }
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  const inSelectedYear = (d: Date) => yearParam === "all" || d.getFullYear() === yearParam;

  const perVehicle = vehicles.map((v: VehicleWithRecords) => {
    const maintenanceRecords = v.maintenanceRecords.filter((r: MaintenanceRecordRow) => inSelectedYear(r.date));
    const fuelRecords = v.fuelRecords.filter((r: FuelRecordRow) => inSelectedYear(r.date));
    const expenseRecords = v.expenseRecords.filter((r: ExpenseRecordRow) => inSelectedYear(r.date));

    const maintenanceCost = maintenanceRecords.reduce(
      (sum: number, r: MaintenanceRecordRow) => sum + Number(r.totalPrice),
      0
    );
    const fuelCost = fuelRecords.reduce(
      (sum: number, r: FuelRecordRow) => sum + Number(r.volume) * Number(r.unitPrice),
      0
    );
    const expenseCost = expenseRecords.reduce((sum: number, r: ExpenseRecordRow) => sum + Number(r.amount), 0);
    const fuelVolume = fuelRecords.reduce((sum: number, r: FuelRecordRow) => sum + Number(r.volume), 0);
    // 最新里程用全部历史数据算，不受年份筛选影响——里程是累计值，只看某一年没有意义
    const mileages: number[] = [
      ...v.maintenanceRecords.map((r: MaintenanceRecordRow) => r.mileage).filter((m): m is number => m !== null),
      ...v.fuelRecords.map((r: FuelRecordRow) => r.mileage),
    ];
    const latestMileage = mileages.length > 0 ? Math.max(...mileages) : null;

    return {
      vehicleId: v.id,
      name: v.name,
      maintenanceCost: round2(maintenanceCost),
      fuelCost: round2(fuelCost),
      expenseCost: round2(expenseCost),
      totalCost: round2(maintenanceCost + fuelCost + expenseCost),
      fuelVolume: round2(fuelVolume),
      maintenanceRecordCount: maintenanceRecords.length,
      fuelRecordCount: fuelRecords.length,
      expenseRecordCount: expenseRecords.length,
      latestMileage,
    };
  });

  const totalMaintenanceCost = round2(perVehicle.reduce((sum: number, v) => sum + v.maintenanceCost, 0));
  const totalFuelCost = round2(perVehicle.reduce((sum: number, v) => sum + v.fuelCost, 0));
  const totalExpenseCost = round2(perVehicle.reduce((sum: number, v) => sum + v.expenseCost, 0));

  // 支出趋势：选中具体年份时固定展示该年 1-12 月；选"全部"时展示从最早到最新记录跨越的每个月
  // （个人用车数据量级下点数完全可控，不需要额外分页）。
  let months: string[];
  if (yearParam === "all") {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const v of vehicles) {
      for (const r of [...v.maintenanceRecords, ...v.fuelRecords, ...v.expenseRecords]) {
        if (!minDate || r.date < minDate) minDate = r.date;
        if (!maxDate || r.date > maxDate) maxDate = r.date;
      }
    }
    if (!minDate || !maxDate) {
      months = [monthKey(new Date())];
    } else {
      months = [];
      const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      while (cursor <= end) {
        months.push(monthKey(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  } else {
    months = Array.from({ length: 12 }, (_, i) => monthKey(new Date(yearParam, i, 1)));
  }

  const monthlyMap = new Map(months.map((m) => [m, { month: m, maintenanceCost: 0, fuelCost: 0, expenseCost: 0 }]));

  for (const v of vehicles) {
    for (const r of v.maintenanceRecords) {
      const key = monthKey(r.date);
      const entry = monthlyMap.get(key);
      if (entry) entry.maintenanceCost += Number(r.totalPrice);
    }
    for (const r of v.fuelRecords) {
      const key = monthKey(r.date);
      const entry = monthlyMap.get(key);
      if (entry) entry.fuelCost += Number(r.volume) * Number(r.unitPrice);
    }
    for (const r of v.expenseRecords) {
      const key = monthKey(r.date);
      const entry = monthlyMap.get(key);
      if (entry) entry.expenseCost += Number(r.amount);
    }
  }

  const monthlyTrend = months.map((m) => {
    const entry = monthlyMap.get(m)!;
    return {
      month: m,
      maintenanceCost: round2(entry.maintenanceCost),
      fuelCost: round2(entry.fuelCost),
      expenseCost: round2(entry.expenseCost),
    };
  });

  res.json({
    year: yearParam,
    availableYears,
    totalVehicles: vehicles.length,
    totalMaintenanceCost,
    totalFuelCost,
    totalExpenseCost,
    totalCost: round2(totalMaintenanceCost + totalFuelCost + totalExpenseCost),
    perVehicle,
    monthlyTrend,
  });
}
