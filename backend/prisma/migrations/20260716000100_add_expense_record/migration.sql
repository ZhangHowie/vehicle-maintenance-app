-- 其他消费记录：停车费/行车记录仪/脚垫等不属于保养或加油的杂项支出
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "item" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseRecord_vehicleId_date_idx" ON "ExpenseRecord"("vehicleId", "date");

ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
