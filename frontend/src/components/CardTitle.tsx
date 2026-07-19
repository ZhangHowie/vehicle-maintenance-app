import React from "react";
import { BRAND } from "../theme";

// 图标气泡 + 标题，贯穿全站的小标题装饰模式（设置页卡片标题、记录详情弹窗标题等）。
export default function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 7,
          background: BRAND.primarySoft,
          color: BRAND.primary,
          fontSize: 14,
        }}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}
