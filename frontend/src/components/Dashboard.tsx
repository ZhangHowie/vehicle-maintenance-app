import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, Empty, Spin, Segmented } from "antd";
import { CarOutlined, ToolOutlined, ThunderboltOutlined, ShoppingOutlined, DollarOutlined } from "@ant-design/icons";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { api } from "../api/client";
import { onRecordsUpdated } from "../events";
import { BRAND, RECORD_THEME } from "../theme";
import { StatCard } from "./StatCard";

const COLORS = [BRAND.primary, "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2", "#eb2f96", "#a0d911"];
const CURRENT_YEAR = new Date().getFullYear();
const ALL_YEARS = "all";

interface OverviewStats {
  year: number | "all";
  availableYears: number[];
  totalVehicles: number;
  totalMaintenanceCost: number;
  totalFuelCost: number;
  totalExpenseCost: number;
  totalCost: number;
  perVehicle: { vehicleId: string; name: string; totalCost: number }[];
  monthlyTrend: { month: string; maintenanceCost: number; fuelCost: number; expenseCost: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  // 默认按当前年份统计，也可以切到往年或"全部"
  const [year, setYear] = useState<number | typeof ALL_YEARS>(CURRENT_YEAR);

  function load() {
    api
      .get(`/stats/overview?year=${year}`)
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    return onRecordsUpdated(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // 年份选项：始终包含当前年，再补上数据里实际出现过的其它年份，最后加一个"全部"
  const yearOptions = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR, ...(stats?.availableYears ?? [])]);
    const options: { label: string; value: number | typeof ALL_YEARS }[] = Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({ label: `${y}年`, value: y }));
    options.push({ label: "全部", value: ALL_YEARS });
    return options;
  }, [stats?.availableYears]);

  if (loading && !stats) return <Spin />;
  if (!stats || stats.totalVehicles === 0) return null;

  const pieData = stats.perVehicle
    .filter((v) => v.totalCost > 0)
    .map((v) => ({ name: v.name, value: v.totalCost }));

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 年份选择器外面套一层可横向滚动的容器：右对齐（flex-end）的 Segmented 在选项
          较多、屏幕较窄时会整体超出容器往左边溢出，最左边的按钮被裁掉一部分看不全，
          加了 overflowX 之后超出部分变成可以滑动查看，而不是直接被裁切。 */}
      <div style={{ overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", minWidth: "fit-content" }}>
          <Segmented
            options={yearOptions}
            value={year}
            onChange={(v) => setYear(v as number | typeof ALL_YEARS)}
            style={{ flexShrink: 0 }}
          />
        </div>
      </div>
      {/* align="stretch" 让同一行里的卡片高度保持一致：默认情况下 Row 的每个 Col
          只按自己内容的高度撑开，标题文字长短不一时（比如"加油总支出"跟"总支出"）
          会导致卡片底边对不齐，stretch 之后统一按这一行里最高的卡片对齐。 */}
      <Row gutter={[12, 12]} align="stretch">
        <Col xs={12} sm={6}>
          <StatCard title="车辆数" value={stats.totalVehicles} prefix={<CarOutlined />} color={BRAND.primary} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="保养总支出"
            value={stats.totalMaintenanceCost}
            precision={2}
            prefix={<ToolOutlined />}
            color={RECORD_THEME.maintenance.color}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="加油总支出"
            value={stats.totalFuelCost}
            precision={2}
            prefix={<ThunderboltOutlined />}
            color={RECORD_THEME.fuel.color}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="其他消费总支出"
            value={stats.totalExpenseCost}
            precision={2}
            prefix={<ShoppingOutlined />}
            color={RECORD_THEME.expense.color}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="总支出" value={stats.totalCost} precision={2} prefix={<DollarOutlined />} color={BRAND.primary} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title={`各车辆支出占比${year === ALL_YEARS ? "" : `（${year} 年）`}`} style={{ height: 340 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toFixed(2)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无支出数据" style={{ marginTop: 60 }} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title={year === ALL_YEARS ? "全部支出趋势（按月）" : `${year} 年支出趋势（按月）`} style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v.toFixed(2)} />
                <Legend />
                <Bar dataKey="maintenanceCost" name="保养支出" stackId="a" fill={RECORD_THEME.maintenance.color} radius={[0, 0, 0, 0]} />
                <Bar dataKey="fuelCost" name="加油支出" stackId="a" fill={RECORD_THEME.fuel.color} radius={[0, 0, 0, 0]} />
                <Bar dataKey="expenseCost" name="其他消费" stackId="a" fill={RECORD_THEME.expense.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
