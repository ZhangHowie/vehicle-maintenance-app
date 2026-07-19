import { useEffect, useState } from "react";
import { api } from "../api/client";

// 登录/注册页在未登录状态下也需要知道要不要显示"注册新账号"入口，
// 用公开接口读取一次即可，不需要登录态。
export function useMultiUserStatus() {
  const [multiUserEnabled, setMultiUserEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get("/settings/public")
      .then((res) => setMultiUserEnabled(res.data.multiUserEnabled))
      .catch(() => setMultiUserEnabled(null));
  }, []);

  return multiUserEnabled;
}
