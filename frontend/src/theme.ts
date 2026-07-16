// 全站共享的一套配色 token，避免每个页面各自定义、越做越散。
//
// - brand：整体外壳（登录态壳、导航、认证页背景板）用的主色，深路面蓝，
//   比 antd 默认蓝更沉一些，作为"这是一个记录行驶/保养的工具"的底色。
// - maintenance / fuel / expense：保养记录用暖橙、油耗记录用青蓝、其他消费用紫，
//   贯穿添加记录弹窗、统计图表、列表标签，让三类记录在任何页面都能一眼分辨。
export const BRAND = {
  primary: "#154c8c",
  primaryDeep: "#0c2f52",
  primarySoft: "#eaf1fa",
};

export const RECORD_THEME = {
  maintenance: { color: "#c2620d", tint: "#fdf3e7" },
  fuel: { color: "#0d8a86", tint: "#e7f6f5" },
  expense: { color: "#7757b0", tint: "#f1ecf9" },
};

// 页面外壳用的中性色：页面背景 / 卡片背景 / 分隔线，统一从这里取，
// 避免 Layout、导航栏这类外壳组件里到处写 #fff / #eee 字面量。
export const SURFACE = {
  page: "#f5f6f8",
  card: "#ffffff",
  border: "rgba(0,0,0,0.08)",
};
