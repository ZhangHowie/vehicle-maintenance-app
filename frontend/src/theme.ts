// 全站共享的一套配色 token，避免每个页面各自定义、越做越散。
//
// - brand：整体外壳（登录态壳、导航、认证页背景板）用的主色，深路面蓝，
//   比 antd 默认蓝更沉一些，作为"这是一个记录行驶/保养的工具"的底色。
// - maintenance / fuel：保养记录用暖橙、油耗记录用青蓝，贯穿添加记录弹窗、
//   统计图表、列表标签，让两类记录在任何页面都能一眼分辨。
export const BRAND = {
  primary: "#154c8c",
  primaryDeep: "#0c2f52",
  primarySoft: "#eaf1fa",
};

export const RECORD_THEME = {
  maintenance: { color: "#c2620d", tint: "#fdf3e7" },
  fuel: { color: "#0d8a86", tint: "#e7f6f5" },
};
