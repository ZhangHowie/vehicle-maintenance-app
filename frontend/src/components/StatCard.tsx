import React from "react";
import { Card, Statistic } from "antd";

// 首页和车辆详情页的统计卡片统一用这个组件：
// 1. 标题强制单行 + 省略号，不再因为文字换行导致同一行里的卡片高度不一致
//    （之前"加油总支出""最近百公里油耗"等卡片底边对不齐，根源就是标题换行）。
// 2. 内边距/字号都比 antd Card 默认小一圈，移动端一屏能看到更多信息。
// 配合外层 <Row align="stretch"> 使用，保证同一行卡片高度始终一致。
export function StatCard({
  title,
  value,
  precision,
  prefix,
  color,
}: {
  title: React.ReactNode;
  value: number | string;
  precision?: number;
  prefix?: React.ReactNode;
  color: string;
}) {
  return (
    <Card
      style={{ borderTop: `3px solid ${color}`, borderRadius: 10, height: "100%" }}
      styles={{ body: { padding: "10px 12px" } }}
    >
      <Statistic
        title={
          <span
            style={{
              fontSize: 12,
              color: "#888",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </span>
        }
        value={value}
        precision={precision}
        prefix={prefix}
        valueStyle={{ color, fontSize: 18, fontWeight: 600 }}
      />
    </Card>
  );
}
