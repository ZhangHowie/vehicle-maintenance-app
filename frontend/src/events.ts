// 轻量事件总线：全局悬浮按钮新增记录成功后，通知当前页面（首页仪表盘/车辆详情页）重新拉取数据，
// 避免引入额外的全局状态管理库。
const RECORDS_UPDATED_EVENT = "vma:records-updated";

export function notifyRecordsUpdated() {
  window.dispatchEvent(new CustomEvent(RECORDS_UPDATED_EVENT));
}

export function onRecordsUpdated(handler: () => void): () => void {
  window.addEventListener(RECORDS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(RECORDS_UPDATED_EVENT, handler);
}
