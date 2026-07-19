import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { BRAND } from "./src/theme";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // 手动在 main.tsx 里用 virtual:pwa-register 接入，而不是用默认注入的极简
      // registerSW.js（那个版本只 register()，检测到新版本后不会自动刷新页面）。
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      workbox: {
        // heic2any 是仅在用户选择 HEIC 图片时才会用到的转换库（~1.3MB），
        // 预缓存进 Service Worker 只会拖慢每次新版本发布后的后台更新下载，
        // 增大"长时间没打开、回来后第一次刷新还在用旧版本"这个窗口期，排除掉改成按需网络加载。
        globIgnores: ["**/heic2any-*.js"],
      },
      manifest: {
        name: "车辆保养管理",
        short_name: "车辆保养",
        description: "记录车辆保养维修与油耗",
        theme_color: BRAND.primary,
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
