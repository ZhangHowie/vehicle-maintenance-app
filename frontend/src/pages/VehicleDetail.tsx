import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Popconfirm,
  message,
  Row,
  Col,
  Tag,
  Empty,
  Segmented,
  Descriptions,
  Select,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  ShoppingOutlined,
  ArrowLeftOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "../api/client";
import { fuelTypeLabel } from "../constants";
import RecordFormModal, { RecordType } from "../components/RecordFormModal";
import MobileSheet from "../components/MobileSheet";
import { StatCard } from "../components/StatCard";
import { notifyRecordsUpdated } from "../events";
import { BRAND, RECORD_THEME } from "../theme";

const CURRENT_YEAR = new Date().getFullYear();
const ALL_YEARS = "all" as const;
type YearFilter = number | typeof ALL_YEARS;
// 月支出趋势图的类型筛选（跟下面"其他消费"记录类型是两回事，这里指的是趋势图要看哪几条线）
type TrendFilter = "all" | "maintenance" | "fuel" | "expense";

// 保养/油耗/消费切换按钮上图标+文字的小标签，颜色跟随各自的主题色（保养=暖橙，油耗=青蓝，消费=紫）
function SwitchLabel({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color, display: "flex", alignItems: "center" }}>{icon}</span>
      {children}
    </span>
  );
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RECORD_VIEW_LABEL: Record<RecordType, string> = { maintenance: "保养", fuel: "油耗", expense: "消费" };
const DETAIL_ICON: Record<RecordType, React.ReactNode> = {
  maintenance: <ToolOutlined />,
  fuel: <ThunderboltOutlined />,
  expense: <ShoppingOutlined />,
};

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<any>(null);
  // 顶部"切换车辆"下拉的选项，只在移动端进入详情页后没法方便地返回列表页/切换到
  // 别的车辆时用得上——桌面端有侧边栏一直在，用不上也不影响。
  const [allVehicles, setAllVehicles] = useState<{ id: string; name: string }[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    recentLitersPer100km: number | null;
    averageLitersPer100km: number | null;
    segments: { fromMileage: number; toMileage: number; date: string; litersPer100km: number }[];
  }>({
    recentLitersPer100km: null,
    averageLitersPer100km: null,
    segments: [],
  });

  const [modalState, setModalState] = useState<{ type: RecordType; recordId?: string; initialValues?: any } | null>(
    null
  );
  // 点击某一条记录查看详情（只读），跟"编辑"是分开的入口
  const [detailRecord, setDetailRecord] = useState<{ type: RecordType; record: any } | null>(null);

  // 默认按当前年份筛选统计和记录列表，也可以切到往年或"全部"
  const [year, setYear] = useState<YearFilter>(CURRENT_YEAR);
  // 月支出趋势图的类型筛选：全部 / 只看保养 / 只看加油 / 只看消费
  const [expenseFilter, setExpenseFilter] = useState<TrendFilter>("all");
  // 下方记录列表：保养 / 油耗 / 消费 三选一切换显示，而不是三个表格堆在一起，
  // 减少移动端要滚动的长度。
  const [recordView, setRecordView] = useState<RecordType>("maintenance");

  function loadAll() {
    api.get(`/vehicles/${id}`).then((res) => setVehicle(res.data));
    api.get(`/vehicles/${id}/maintenance-records`).then((res) => setMaintenanceRecords(res.data));
    api.get(`/vehicles/${id}/fuel-records`).then((res) => setFuelRecords(res.data));
    api.get(`/vehicles/${id}/expense-records`).then((res) => setExpenseRecords(res.data));
    api.get(`/vehicles/${id}/fuel-records/stats`).then((res) => setStats(res.data));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    api.get("/vehicles").then((res) => setAllVehicles(res.data));
  }, []);

  async function deleteVehicle() {
    await api.delete(`/vehicles/${id}`);
    message.success("已删除");
    navigate("/");
  }

  async function deleteMaintenance(recordId: string) {
    await api.delete(`/vehicles/${id}/maintenance-records/${recordId}`);
    loadAll();
    notifyRecordsUpdated();
  }

  async function deleteFuel(recordId: string) {
    await api.delete(`/vehicles/${id}/fuel-records/${recordId}`);
    loadAll();
    notifyRecordsUpdated();
  }

  async function deleteExpense(recordId: string) {
    await api.delete(`/vehicles/${id}/expense-records/${recordId}`);
    loadAll();
    notifyRecordsUpdated();
  }

  function handleModalSuccess() {
    loadAll();
    notifyRecordsUpdated();
  }

  // 年份选项：始终包含当前年，再补上这辆车数据里实际出现过的其它年份，最后加一个"全部"
  const yearOptions = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR]);
    for (const r of maintenanceRecords) years.add(dayjs(r.date).year());
    for (const r of fuelRecords) years.add(dayjs(r.date).year());
    for (const r of expenseRecords) years.add(dayjs(r.date).year());
    const options: { label: string; value: YearFilter }[] = Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({ label: `${y}年`, value: y }));
    options.push({ label: "全部", value: ALL_YEARS });
    return options;
  }, [maintenanceRecords, fuelRecords, expenseRecords]);

  const filteredMaintenance = useMemo(() => {
    if (year === ALL_YEARS) return maintenanceRecords;
    return maintenanceRecords.filter((r) => dayjs(r.date).year() === year);
  }, [maintenanceRecords, year]);

  const filteredFuel = useMemo(() => {
    if (year === ALL_YEARS) return fuelRecords;
    return fuelRecords.filter((r) => dayjs(r.date).year() === year);
  }, [fuelRecords, year]);

  const filteredExpense = useMemo(() => {
    if (year === ALL_YEARS) return expenseRecords;
    return expenseRecords.filter((r) => dayjs(r.date).year() === year);
  }, [expenseRecords, year]);

  // 支出构成：保养 / 加油 / 其他消费 三项，替代原先按保养项目拆分的饼图
  const expenseComposition = useMemo(() => {
    const maintenanceCost = filteredMaintenance.reduce((sum, r) => sum + Number(r.totalPrice), 0);
    const fuelCost = filteredFuel.reduce((sum, r) => sum + Number(r.volume) * Number(r.unitPrice), 0);
    const otherCost = filteredExpense.reduce((sum, r) => sum + Number(r.amount), 0);
    return [
      { name: "保养", value: Math.round(maintenanceCost * 100) / 100, color: RECORD_THEME.maintenance.color },
      { name: "油费", value: Math.round(fuelCost * 100) / 100, color: RECORD_THEME.fuel.color },
      { name: "其他消费", value: Math.round(otherCost * 100) / 100, color: RECORD_THEME.expense.color },
    ].filter((d) => d.value > 0);
  }, [filteredMaintenance, filteredFuel, filteredExpense]);

  // 每条加油记录自己的百公里油耗：只有"加满"且成功和上一个加满点构成一段区间的记录才有值
  // （对应 fuelStats 接口按里程算出的 segments，用 toMileage 对应到具体是哪条记录）。
  const fuelEfficiencyByMileage = useMemo(() => {
    const map = new Map<number, number>();
    for (const seg of stats.segments) map.set(seg.toMileage, seg.litersPer100km);
    return map;
  }, [stats.segments]);

  // 本期（受年份筛选影响）汇总：总支出、总保养、总加油、总消费、平均每天行驶里程、平均每公里油费。
  // 平均行驶里程 / 平均油费用"本期内里程最大值 - 最小值"除以"最早/最晚记录相差天数"来估算。
  const periodStats = useMemo(() => {
    const totalMaintenanceCost = filteredMaintenance.reduce((sum, r) => sum + Number(r.totalPrice), 0);
    const totalFuelCost = filteredFuel.reduce((sum, r) => sum + Number(r.volume) * Number(r.unitPrice), 0);
    const totalExpenseCost = filteredExpense.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalCost = totalMaintenanceCost + totalFuelCost + totalExpenseCost;

    const dated = [...filteredMaintenance, ...filteredFuel]
      .filter((r) => typeof r.mileage === "number")
      .map((r) => ({ date: dayjs(r.date), mileage: r.mileage as number }));

    let avgDistancePerDay: number | null = null;
    let avgFuelCostPerKm: number | null = null;
    if (dated.length >= 2) {
      const earliest = dated.reduce((a, b) => (a.date.isBefore(b.date) ? a : b));
      const latest = dated.reduce((a, b) => (a.date.isAfter(b.date) ? a : b));
      const mileageDelta = latest.mileage - earliest.mileage;
      const daysDelta = Math.max(1, latest.date.diff(earliest.date, "day"));
      if (mileageDelta > 0) {
        avgDistancePerDay = mileageDelta / daysDelta;
        avgFuelCostPerKm = totalFuelCost / mileageDelta;
      }
    }

    return {
      totalMaintenanceCost: Math.round(totalMaintenanceCost * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalExpenseCost: Math.round(totalExpenseCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      avgDistancePerDay: avgDistancePerDay !== null ? Math.round(avgDistancePerDay * 10) / 10 : null,
      avgFuelCostPerKm: avgFuelCostPerKm !== null ? Math.round(avgFuelCostPerKm * 100) / 100 : null,
    };
  }, [filteredMaintenance, filteredFuel, filteredExpense]);

  // 月支出趋势：选中具体年份就固定展示该年 1-12 月；选"全部"就展示这辆车从最早到最新记录跨越的每个月
  const monthlyExpense = useMemo(() => {
    let months: string[];
    if (year === ALL_YEARS) {
      const allDates = [...maintenanceRecords, ...fuelRecords, ...expenseRecords].map((r) => dayjs(r.date));
      if (allDates.length === 0) {
        months = [monthKey(new Date())];
      } else {
        const min = allDates.reduce((a, b) => (a.isBefore(b) ? a : b));
        const max = allDates.reduce((a, b) => (a.isAfter(b) ? a : b));
        months = [];
        let cursor = min.startOf("month");
        const end = max.startOf("month");
        while (cursor.isBefore(end) || cursor.isSame(end)) {
          months.push(cursor.format("YYYY-MM"));
          cursor = cursor.add(1, "month");
        }
      }
    } else {
      months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    }

    const map = new Map(months.map((m) => [m, { month: m, maintenanceCost: 0, fuelCost: 0, expenseCost: 0 }]));
    for (const r of maintenanceRecords) {
      const key = dayjs(r.date).format("YYYY-MM");
      const entry = map.get(key);
      if (entry) entry.maintenanceCost += Number(r.totalPrice);
    }
    for (const r of fuelRecords) {
      const key = dayjs(r.date).format("YYYY-MM");
      const entry = map.get(key);
      if (entry) entry.fuelCost += Number(r.volume) * Number(r.unitPrice);
    }
    for (const r of expenseRecords) {
      const key = dayjs(r.date).format("YYYY-MM");
      const entry = map.get(key);
      if (entry) entry.expenseCost += Number(r.amount);
    }
    return months.map((m) => {
      const entry = map.get(m)!;
      return {
        month: m,
        maintenanceCost: Math.round(entry.maintenanceCost * 100) / 100,
        fuelCost: Math.round(entry.fuelCost * 100) / 100,
        expenseCost: Math.round(entry.expenseCost * 100) / 100,
      };
    });
  }, [maintenanceRecords, fuelRecords, expenseRecords, year]);

  const showMaintenanceLine = expenseFilter === "all" || expenseFilter === "maintenance";
  const showFuelLine = expenseFilter === "all" || expenseFilter === "fuel";
  const showExpenseLine = expenseFilter === "all" || expenseFilter === "expense";

  if (!vehicle) return null;

  return (
    <div>
      {/* 返回首页 + 切换车辆：吸顶显示，移动端点进详情页之后不用滚到页面最底部去找
          导航菜单，也不用先退回列表页才能看别的车。 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 14,
          padding: "6px 0",
          background: "#f5f6f8",
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
          返回
        </Button>
        {allVehicles.length > 1 && (
          <Select
            value={id}
            onChange={(v) => navigate(`/vehicles/${v}`)}
            style={{ minWidth: 130, maxWidth: 200 }}
            suffixIcon={<SwapOutlined />}
            options={allVehicles.map((v) => ({ value: v.id, label: v.name }))}
          />
        )}
      </div>

      {vehicle.coverImageUrl && (
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            aspectRatio: "16 / 9",
            overflow: "hidden",
            borderRadius: 12,
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <img
            src={vehicle.coverImageUrl}
            alt={vehicle.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* 名称/编辑删除跟标签分成两行，中间显式给了 marginTop，而不是依赖 Row 在
          窄屏换行时自动产生的间距——那种间距是 0，换行后标签紧贴在编辑/删除按钮
          下面，看起来快要重叠在一起。 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>{vehicle.name}</h2>
          <Space>
            <Link to={`/vehicles/${id}/edit`}>
              <Button icon={<EditOutlined />}>编辑</Button>
            </Link>
            <Popconfirm title="确认删除该车辆及全部记录？" onConfirm={deleteVehicle}>
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>
        <Space wrap style={{ marginTop: 10 }}>
          <Tag>{[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "-"}</Tag>
          <Tag>{vehicle.plateNo}</Tag>
          <Tag color={RECORD_THEME.fuel.color}>{fuelTypeLabel(vehicle.defaultFuelType)}</Tag>
        </Space>
      </div>

      {/* 同 Dashboard：右对齐的 Segmented 选项多时会往左溢出屏幕，套一层横向滚动容器 */}
      <div style={{ overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", minWidth: "fit-content" }}>
          <Segmented options={yearOptions} value={year} onChange={(v) => setYear(v as YearFilter)} style={{ flexShrink: 0 }} />
        </div>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="stretch">
        <Col xs={12} sm={8}>
          <StatCard
            title={`总消费金额${year === ALL_YEARS ? "" : `（${year}）`}`}
            value={periodStats.totalCost}
            precision={2}
            prefix="¥"
            color={BRAND.primary}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title={`总保养金额${year === ALL_YEARS ? "" : `（${year}）`}`}
            value={periodStats.totalMaintenanceCost}
            precision={2}
            prefix="¥"
            color={RECORD_THEME.maintenance.color}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title={`总加油金额${year === ALL_YEARS ? "" : `（${year}）`}`}
            value={periodStats.totalFuelCost}
            precision={2}
            prefix="¥"
            color={RECORD_THEME.fuel.color}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title={`其他消费金额${year === ALL_YEARS ? "" : `（${year}）`}`}
            value={periodStats.totalExpenseCost}
            precision={2}
            prefix="¥"
            color={RECORD_THEME.expense.color}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title="最近百公里油耗 (L)"
            value={stats.recentLitersPer100km ?? "暂无数据"}
            color={RECORD_THEME.fuel.color}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title="平均百公里油耗 (L)"
            value={stats.averageLitersPer100km ?? "暂无数据"}
            color={RECORD_THEME.fuel.color}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title={`平均油费 (元/km)${year === ALL_YEARS ? "" : `（${year}）`}`}
            value={periodStats.avgFuelCostPerKm ?? "暂无数据"}
            color={RECORD_THEME.fuel.color}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            title={`平均行驶 (km/天)${year === ALL_YEARS ? "" : `（${year}）`}`}
            value={periodStats.avgDistancePerDay ?? "暂无数据"}
            color={BRAND.primary}
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard title="保养记录数" value={filteredMaintenance.length} color={RECORD_THEME.maintenance.color} />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard title="油耗记录数" value={filteredFuel.length} color={RECORD_THEME.fuel.color} />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard title="消费记录数" value={filteredExpense.length} color={RECORD_THEME.expense.color} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10}>
          <Card title={`支出构成${year === ALL_YEARS ? "" : `（${year} 年）`}`} style={{ height: 320 }}>
            {expenseComposition.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={expenseComposition}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {expenseComposition.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无支出数据" style={{ marginTop: 50 }} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title={`月支出趋势${year === ALL_YEARS ? "" : `（${year} 年）`}`}
            extra={
              <Segmented
                size="small"
                value={expenseFilter}
                onChange={(v) => setExpenseFilter(v as TrendFilter)}
                options={[
                  { label: "全部", value: "all" },
                  { label: "保养", value: "maintenance" },
                  { label: "加油", value: "fuel" },
                  { label: "消费", value: "expense" },
                ]}
              />
            }
            style={{ height: 320 }}
          >
            {monthlyExpense.some((m) => m.maintenanceCost > 0 || m.fuelCost > 0 || m.expenseCost > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyExpense}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                  <Legend />
                  {showMaintenanceLine && (
                    <Line
                      type="monotone"
                      dataKey="maintenanceCost"
                      name="保养支出"
                      stroke={RECORD_THEME.maintenance.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {showFuelLine && (
                    <Line
                      type="monotone"
                      dataKey="fuelCost"
                      name="加油支出"
                      stroke={RECORD_THEME.fuel.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {showExpenseLine && (
                    <Line
                      type="monotone"
                      dataKey="expenseCost"
                      name="其他消费"
                      stroke={RECORD_THEME.expense.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无支出数据" style={{ marginTop: 50 }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 保养/油耗两个列表改成按钮切换、每次只显示一个，而不是两个表格堆在同一屏——
          详情页本来卡片+图表就已经很长了，两份表格再摞在一起，移动端要滚很久才能
          看到想要的记录。列表本身也只保留最关键的几列，优惠/备注/编辑/删除都不在
          列表里显示了，点开某一行的详情弹窗（下面 Modal）能看到完整信息，也能在
          那里编辑或删除。 */}
      <Card style={{ borderRadius: 10 }} styles={{ body: { padding: "12px 12px 4px" } }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Segmented
            value={recordView}
            onChange={(v) => setRecordView(v as RecordType)}
            options={[
              {
                value: "maintenance",
                label: (
                  <SwitchLabel icon={<ToolOutlined />} color={RECORD_THEME.maintenance.color}>
                    保养记录
                  </SwitchLabel>
                ),
              },
              {
                value: "fuel",
                label: (
                  <SwitchLabel icon={<ThunderboltOutlined />} color={RECORD_THEME.fuel.color}>
                    油耗记录
                  </SwitchLabel>
                ),
              },
              {
                value: "expense",
                label: (
                  <SwitchLabel icon={<ShoppingOutlined />} color={RECORD_THEME.expense.color}>
                    消费记录
                  </SwitchLabel>
                ),
              },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalState({ type: recordView })}
            style={{ background: RECORD_THEME[recordView].color, borderColor: RECORD_THEME[recordView].color }}
          >
            添加{RECORD_VIEW_LABEL[recordView]}记录
          </Button>
        </div>

        {recordView === "maintenance" ? (
          <Table
            rowKey="id"
            dataSource={filteredMaintenance}
            scroll={{ x: true }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            onRow={(r) => ({
              onClick: () => setDetailRecord({ type: "maintenance", record: r }),
              style: { cursor: "pointer" },
            })}
            columns={[
              { title: "日期", dataIndex: "date", render: (v) => dayjs(v).format("YYYY-MM-DD") },
              { title: "里程(km)", dataIndex: "mileage" },
              {
                title: "项目",
                dataIndex: "items",
                render: (items: any[]) => items.map((i) => i.project).join("、"),
              },
              { title: "总价", dataIndex: "totalPrice", render: (v: number) => `¥${Number(v).toFixed(2)}` },
            ]}
          />
        ) : recordView === "fuel" ? (
          <Table
            rowKey="id"
            dataSource={filteredFuel}
            scroll={{ x: true }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            onRow={(r) => ({
              onClick: () => setDetailRecord({ type: "fuel", record: r }),
              style: { cursor: "pointer" },
            })}
            columns={[
              { title: "日期", dataIndex: "date", render: (v) => dayjs(v).format("YYYY-MM-DD") },
              { title: "里程(km)", dataIndex: "mileage" },
              {
                title: "百公里油耗(L)",
                dataIndex: "mileage",
                render: (mileage: number) => {
                  const v = fuelEfficiencyByMileage.get(mileage);
                  return v !== undefined ? v : "-";
                },
              },
            ]}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={filteredExpense}
            scroll={{ x: true }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            onRow={(r) => ({
              onClick: () => setDetailRecord({ type: "expense", record: r }),
              style: { cursor: "pointer" },
            })}
            columns={[
              { title: "日期", dataIndex: "date", render: (v) => dayjs(v).format("YYYY-MM-DD") },
              { title: "项目", dataIndex: "item" },
              { title: "金额", dataIndex: "amount", render: (v: number) => `¥${Number(v).toFixed(2)}` },
            ]}
          />
        )}
      </Card>

      {modalState && vehicle && (
        <RecordFormModal
          open={Boolean(modalState)}
          type={modalState.type}
          vehicles={[{ id: vehicle.id, name: vehicle.name, defaultFuelType: vehicle.defaultFuelType }]}
          vehicleId={vehicle.id}
          recordId={modalState.recordId}
          initialValues={modalState.initialValues}
          onClose={() => setModalState(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {detailRecord && (
        <MobileSheet
          open={Boolean(detailRecord)}
          onCancel={() => setDetailRecord(null)}
          width={520}
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: RECORD_THEME[detailRecord.type].tint,
                  color: RECORD_THEME[detailRecord.type].color,
                  fontSize: 14,
                }}
              >
                {DETAIL_ICON[detailRecord.type]}
              </span>
              {RECORD_VIEW_LABEL[detailRecord.type]}记录详情
            </span>
          }
          footer={[
            // 编辑/删除都收进了详情弹窗里，列表行本身不再放操作按钮
            <Popconfirm
              key="delete"
              title="确认删除该条记录？"
              onConfirm={async () => {
                if (detailRecord.type === "maintenance") await deleteMaintenance(detailRecord.record.id);
                else if (detailRecord.type === "fuel") await deleteFuel(detailRecord.record.id);
                else await deleteExpense(detailRecord.record.id);
                setDetailRecord(null);
              }}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>,
            <Button key="close" onClick={() => setDetailRecord(null)}>
              关闭
            </Button>,
            <Button
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              style={{
                background: RECORD_THEME[detailRecord.type].color,
                borderColor: RECORD_THEME[detailRecord.type].color,
              }}
              onClick={() => {
                const r = detailRecord.record;
                setModalState({ type: detailRecord.type, recordId: r.id, initialValues: r });
                setDetailRecord(null);
              }}
            >
              编辑
            </Button>,
          ]}
        >
          {detailRecord.type === "maintenance" ? (
            <>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="日期">
                  {dayjs(detailRecord.record.date).format("YYYY-MM-DD")}
                </Descriptions.Item>
                <Descriptions.Item label="里程">{detailRecord.record.mileage ?? "-"} km</Descriptions.Item>
                <Descriptions.Item label="优惠金额">
                  {Number(detailRecord.record.discountAmount) > 0
                    ? `-¥${Number(detailRecord.record.discountAmount).toFixed(2)}`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="总价">
                  ¥{Number(detailRecord.record.totalPrice).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {detailRecord.record.remark || "-"}
                </Descriptions.Item>
              </Descriptions>
              <div style={{ margin: "16px 0 8px", fontSize: 13, fontWeight: 600, color: "#333" }}>保养项目明细</div>
              <Table
                size="small"
                pagination={false}
                rowKey={(_: any, i?: number) => String(i)}
                dataSource={detailRecord.record.items ?? []}
                columns={[
                  { title: "项目", dataIndex: "project" },
                  { title: "品牌", dataIndex: "brand", render: (v: string | null) => v || "-" },
                  { title: "个数", dataIndex: "quantity" },
                  { title: "单价", dataIndex: "price", render: (v: number) => `¥${Number(v).toFixed(2)}` },
                  {
                    title: "金额",
                    render: (_: any, item: any) => `¥${(Number(item.quantity) * Number(item.price)).toFixed(2)}`,
                  },
                ]}
              />
            </>
          ) : detailRecord.type === "fuel" ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="日期">{dayjs(detailRecord.record.date).format("YYYY-MM-DD")}</Descriptions.Item>
              <Descriptions.Item label="里程">{detailRecord.record.mileage} km</Descriptions.Item>
              <Descriptions.Item label="加油量">{Number(detailRecord.record.volume).toFixed(2)} L</Descriptions.Item>
              <Descriptions.Item label="单价">¥{Number(detailRecord.record.unitPrice).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="总金额">
                ¥{(Number(detailRecord.record.volume) * Number(detailRecord.record.unitPrice)).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="该次百公里油耗">
                {fuelEfficiencyByMileage.get(detailRecord.record.mileage) !== undefined
                  ? `${fuelEfficiencyByMileage.get(detailRecord.record.mileage)} L`
                  : "暂无数据"}
              </Descriptions.Item>
              <Descriptions.Item label="油品">{fuelTypeLabel(detailRecord.record.fuelType)}</Descriptions.Item>
              <Descriptions.Item label="是否跳枪">{detailRecord.record.isFullTank ? "是" : "否"}</Descriptions.Item>
              <Descriptions.Item label="上次是否记录" span={2}>
                {detailRecord.record.lastRecorded ? "是" : "否"}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailRecord.record.remark || "-"}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="日期">{dayjs(detailRecord.record.date).format("YYYY-MM-DD")}</Descriptions.Item>
              <Descriptions.Item label="金额">¥{Number(detailRecord.record.amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="消费项目" span={2}>
                {detailRecord.record.item}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailRecord.record.remark || "-"}
              </Descriptions.Item>
            </Descriptions>
          )}
        </MobileSheet>
      )}
    </div>
  );
}
