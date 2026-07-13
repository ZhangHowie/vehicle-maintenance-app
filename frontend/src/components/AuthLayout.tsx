import React from "react";
import { Grid } from "antd";
import { CarOutlined, ToolOutlined, ThunderboltOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { BRAND, RECORD_THEME } from "../theme";

const { useBreakpoint } = Grid;

// 登录 / 注册 / 找回密码这几个页面之前是"灰色背景 + 居中白卡片"的默认样式，
// 换成左侧品牌分栏 + 右侧表单的双栏布局：左边用一条虚线"行驶路线"串起
// 记录、保养、加油三个节点，作为这几个认证页共用的视觉签名，
// 也点出这个工具具体是做什么的，而不是一个无差别的登录框。
function BrandPanel() {
  return (
    <div
      style={{
        position: "relative",
        width: 380,
        flexShrink: 0,
        background: `linear-gradient(165deg, ${BRAND.primaryDeep} 0%, ${BRAND.primary} 55%, #0d6a72 100%)`,
        color: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px 36px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 700 }}>
        <CarOutlined style={{ fontSize: 22 }} />
        车辆保养管理
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.5, marginBottom: 12 }}>
          把每一次保养、
          <br />
          每一次加油都记清楚
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.8 }}>
          按车辆分别记录维修保养项目和加油明细，
          <br />
          自动算出油耗和支出趋势，数据留在你自己的服务器上。
        </div>
      </div>

      {/* 签名图形：一条虚线路线串起"记录 → 保养 → 加油"三个节点 */}
      <svg
        viewBox="0 0 320 170"
        width="100%"
        height="170"
        style={{ position: "relative", zIndex: 1 }}
        aria-hidden
      >
        <path
          d="M10 150 C 90 150, 70 90, 140 85 S 230 40, 310 25"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
        {[
          { x: 10, y: 150, icon: <CheckCircleOutlined />, label: "记录" },
          { x: 140, y: 85, icon: <ToolOutlined />, label: "保养" },
          { x: 310, y: 25, icon: <ThunderboltOutlined />, label: "加油" },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={15} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
            <foreignObject x={-8} y={-8} width={16} height={16}>
              <div style={{ fontSize: 13, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.icon}
              </div>
            </foreignObject>
            <text x={0} y={30} fontSize={11} fill="rgba(255,255,255,0.75)" textAnchor="middle">
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      {/* 柔和的装饰光斑，克制地呼应保养/加油两种记录的强调色，不喧宾夺主 */}
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${RECORD_THEME.fuel.color}55 0%, transparent 70%)`,
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -50,
          left: -50,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${RECORD_THEME.maintenance.color}40 0%, transparent 70%)`,
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  const screens = useBreakpoint();
  const showPanel = screens.md;

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#fff" }}>
      {showPanel && <BrandPanel />}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 340 }}>
          {!showPanel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 16,
                color: BRAND.primary,
                marginBottom: 24,
              }}
            >
              <CarOutlined style={{ fontSize: 20 }} />
              车辆保养管理
            </div>
          )}
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1a1a1a" }}>{title}</h2>
          {subtitle && <div style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>{subtitle}</div>}
          {!subtitle && <div style={{ marginBottom: 20 }} />}
          {children}
          {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
