import React from "react";

// 小色块 + 标题的分组标签，用来把长表单切成有意义的信息块（基本信息 / 项目明细 / 费用……），
// 在添加保养·油耗记录弹窗里已经验证过效果，这里抽成公共组件供车辆表单、设置页等复用。
export function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 12px" }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: color, display: "inline-block" }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{children}</span>
    </div>
  );
}

export function TotalSummary({
  label,
  value,
  color,
  tint,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  tint: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: tint,
        border: `1px solid ${color}33`,
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{hint}</div>}
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        ¥{Number.isFinite(value) ? value.toFixed(2) : "0.00"}
      </span>
    </div>
  );
}
