import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./styles/index.css";

// vite.config.ts 里关掉了 injectRegister（默认的极简版只负责 register()，
// 完全不处理"发现新版本后怎么办"），改成在这里手动接入 virtual:pwa-register——
// 这样新版本部署后，已安装的 Service Worker 检测到更新会自动 skipWaiting/接管，
// 并在接管的瞬间自动刷新一次页面，不会出现"首次打开引用了旧版本资源导致白屏，
// 需要手动刷新才能恢复"的问题。
if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff" } }}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
