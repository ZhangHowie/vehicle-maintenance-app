import React, { useEffect, useMemo, useState } from "react";
import { Card, Tabs, Table, Button, Space, Popconfirm, message, Statistic, Row, Col, Tag, Empty, Segmented } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { api } from "../api/client";
import { fuelTypeLabel } from "../constants";
import RecordFormModal, { RecordType } from "../components/RecordFormModal";
import { notifyRecordsUpdated } from "../events";
import { RECORD_THEME } from "../theme";

const CURRENT_YEAR = new Date().getFullYear();
const ALL_YEARS = "all" as const;
type YearFilter = number | typeof ALL_YEARS;
type ExpenseFilter = "all" | "maintenance" | "fuel";

// 分组标题用的小图标气泡，跟 Tab 页签保持同一套配色（保养=暖橙，油耗=青蓝），
// 这样详情页的记录表格和"添加记录"弹窗在视觉上是同一套语言。
function TabLabel({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
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

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<any>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<{ recentLitersPer100km: number | null; averageLitersPer100km: number | null }>({
    recentLitersPer100km: null,
    averageLitersPer100km: null,
  });

  const [modalState, setModalState] = useState<{ type: RecordType; recordId?: string; initialValues?: any } | null>(
    null
  );

  // 默认按当前年份筛选统计和记录列表，也可以切到往年或"全部"
  const [year, setYear] = useState<YearFilter>(CURRENT_YEAR);
  // 月支出趋势图的类型筛选：全部 / 只看保养 / 只看加油
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>("all");

  function loadAll() {
    api.get(`/vehicles/${id}`).then((res) => setVehicle(res.data));
    api.get(`/vehicles/${id}/maintenance-records`).then((res) => setMaintenanceRecords(res.data));
    api.get(`/vehicles/${id}/fuel-records`).then((res) => setFuelRecords(res.data));
    api.get(`/vehicles/${id}/fuel-records/stats`).then((res) => setStats(res.data));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  function handleModalSuccess() {
    loadAll();
    notifyRecordsUpdated();
  }

  // 年份选项：始终包含当前年，再补上这辆车数据里实际出现过的其它年份，最后加一个"全部"
  const yearOptions = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR]);
    for (const r of maintenanceRecords) years.add(dayjs(r.date).year());
    for (const r of fuelRecords) years.add(dayjs(r.date).year());
    const options: { label: string; value: YearFilter }[] = Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({ label: `${y}年`, value: y }));
    options.push({ label: "全部", value: ALL_YEARS });
    return options;
  }, [maintenanceRecords, fuelRecords]);

  const filteredMaintenance = useMemo(() => {
    if (year === ALL_YEARS) return maintenanceRecords;
    return maintenanceRecords.filter((r) => dayjs(r.date).year() === year);
  }, [maintenanceRecords, year]);

  const filteredFuel = useMemo(() => {
    if (year === ALL_YEARS) return fuelRecords;
    return fuelRecords.filter((r) => dayjs(r.date).year() === year);
  }, [fuelRecords, year]);

  // 支出构成：保养 / 加油 两项，替代原先按保养项目拆分的饼图
  const expenseComposition = useMemo(() => {
    const maintenanceCost = filteredMaintenance.reduce((sum, r) => sum + Number(r.totalPrice), 0);
    const fuelCost = filteredFuel.reduce((sum, r) => sum + Number(r.volume) * Number(r.unitPrice), 0);
    return [
      { name: "保养", value: Math.round(maintenanceCost * 100) / 100, color: RECORD_THEME.maintenance.color },
      { name: "油费", value: Math.round(fuelCost * 100) / 100, color: RECORD_THEME.fuel.color },
    ].filter((d) => d.value > 0);
  }, [filteredMaintenance, filteredFuel]);

  // 月支出趋势：选中具体年份就固定展示该年 1-12 月；选"全部"就展示这辆车从最早到最新记录跨越的每个月
  const monthlyExpense = useMemo(() => {
    let months: string[];
    if (year === ALL_YEARS) {
      const allDates = [...maintenanceRecords, ...fuelRecords].map((r) => dayjs(r.date));
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

    const map = new Map(months.map((m) => [m, { month: m, maintenanceCost: 0, fuelCost: 0 }]));
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
    return months.map((m) => {
      const entry = map.get(m)!;
      return {
        month: m,
        maintenanceCost: Math.round(entry.maintenanceCost * 100) / 100,
        fuelCost: Math.round(entry.fuelCost * 100) / 100,
      };
    });
  }, [maintenanceRecords, fuelRecords, year]);

  const showMaintenanceLine = expenseFilter === "all" || expenseFilter === "maintenance";
  const showFuelLine = expenseFilter === "all" || expenseFilter === "fuel";

  if (!vehicle) return null;

  return (
    <div>
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

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <h2 style={{ margin: 0 }}>{vehicle.name}</h2>
          <Space>
            <Tag>{[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "-"}</Tag>
            <Tag>{vehicle.plateNo}</Tag>
            <Tag color={RECORD_THEME.fuel.color}>{fuelTypeLabel(vehicle.defaultFuelType)}</Tag>
          </Space>
        </Col>
        <Col>
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
        </Col>
      </Row>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Segmented options={yearOptions} value={year} onChange={(v) => setYear(v as YearFilter)} />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderTop: `3px solid ${RECORD_THEME.fuel.color}`, borderRadius: 10 }}>
            <Statistic
              title="最近百公里油耗 (L)"
              value={stats.recentLitersPer100km ?? "暂无数据"}
              valueStyle={{ color: RECORD_THEME.fuel.color }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderTop: `3px solid ${RECORD_THEME.maintenance.color}`, borderRadius: 10 }}>
            <Statistic
              title="保养记录数"
              value={filteredMaintenance.length}
              valueStyle={{ color: RECORD_THEME.maintenance.color }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderTop: `3px solid ${RECORD_THEME.fuel.color}`, borderRadius: 10 }}>
            <Statistic
              title="油耗记录数"
              value={filteredFuel.length}
              valueStyle={{ color: RECORD_THEME.fuel.color }}
            />
          </Card>
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
                onChange={(v) => setExpenseFilter(v as ExpenseFilter)}
                options={[
                  { label: "全部", value: "all" },
                  { label: "保养", value: "maintenance" },
                  { label: "加油", value: "fuel" },
                ]}
              />
            }
            style={{ height: 320 }}
          >
            {monthlyExpense.some((m) => m.maintenanceCost > 0 || m.fuelCost > 0) ? (
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
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无支出数据" style={{ marginTop: 50 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: "maintenance",
            label: (
              <TabLabel icon={<ToolOutlined />} color={RECORD_THEME.maintenance.color}>
                保养记录
              </TabLabel>
            ),
            children: (
              <>
                <div style={{ textAlign: "right", marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalState({ type: "maintenance" })}
                    style={{ background: RECORD_THEME.maintenance.color, borderColor: RECORD_THEME.maintenance.color }}
                  >
                    添加保养记录
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  dataSource={filteredMaintenance}
                  scroll={{ x: true }}
                  columns={[
                    { title: "日期", dataIndex: "date", render: (v) => dayjs(v).format("YYYY-MM-DD") },
                    { title: "里程(km)", dataIndex: "mileage" },
                    {
                      title: "项目",
                      dataIndex: "items",
                      render: (items: any[]) => items.map((i) => i.project).join("、"),
                    },
                    {
                      title: "优惠",
                      dataIndex: "discountAmount",
                      render: (v: number) => (Number(v) > 0 ? `-¥${Number(v).toFixed(2)}` : "-"),
                    },
                    { title: "总价", dataIndex: "totalPrice", render: (v: number) => `¥${Number(v).toFixed(2)}` },
                    { title: "备注", dataIndex: "remark" },
                    {
                      title: "操作",
                      render: (_: any, r: any) => (
                        <Space>
                          <a onClick={() => setModalState({ type: "maintenance", recordId: r.id, initialValues: r })}>
                            编辑
                          </a>
                          <Popconfirm title="确认删除？" onConfirm={() => deleteMaintenance(r.id)}>
                            <a>删除</a>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "fuel",
            label: (
              <TabLabel icon={<ThunderboltOutlined />} color={RECORD_THEME.fuel.color}>
                油耗记录
              </TabLabel>
            ),
            children: (
              <>
                <div style={{ textAlign: "right", marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalState({ type: "fuel" })}
                    style={{ background: RECORD_THEME.fuel.color, borderColor: RECORD_THEME.fuel.color }}
                  >
                    添加油耗记录
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  dataSource={filteredFuel}
                  scroll={{ x: true }}
                  columns={[
                    { title: "日期", dataIndex: "date", render: (v) => dayjs(v).format("YYYY-MM-DD") },
                    { title: "里程(km)", dataIndex: "mileage" },
                    { title: "加油量(L)", dataIndex: "volume" },
                    { title: "单价", dataIndex: "unitPrice" },
                    { title: "油品", dataIndex: "fuelType", render: fuelTypeLabel },
                    { title: "是否跳枪", dataIndex: "isFullTank", render: (v) => (v ? "是" : "否") },
                    { title: "上次是否记录", dataIndex: "lastRecorded", render: (v) => (v ? "是" : "否") },
                    {
                      title: "操作",
                      render: (_: any, r: any) => (
                        <Space>
                          <a onClick={() => setModalState({ type: "fuel", recordId: r.id, initialValues: r })}>编辑</a>
                          <Popconfirm title="确认删除？" onConfirm={() => deleteFuel(r.id)}>
                            <a>删除</a>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />

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
    </div>
  );
}
