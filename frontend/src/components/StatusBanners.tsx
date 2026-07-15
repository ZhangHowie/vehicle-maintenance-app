import React, { useEffect, useState } from "react";
import { CloseOutlined, ShareAltOutlined, WifiOutlined } from "@ant-design/icons";
import { BRAND } from "../theme";

const INSTALL_DISMISSED_KEY = "vma_install_prompt_dismissed";

function NoticeBar({
  icon,
  text,
  background,
  color,
  bottom,
  onClose,
}: {
  icon: React.ReactNode;
  text: React.ReactNode;
  background: string;
  color: string;
  bottom: string | number;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom,
        zIndex: 15,
        maxWidth: 420,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background,
        color,
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 16, display: "flex" }}>{icon}</span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{text}</span>
      {onClose && (
        <CloseOutlined style={{ fontSize: 12, cursor: "pointer", opacity: 0.8 }} onClick={onClose} />
      )}
    </div>
  );
}

// iOS Safari 不支持标准的 beforeinstallprompt 安装弹窗，只能靠页面自己提示用户
// 通过分享菜单手动"添加到主屏幕"。只在 iOS + 非独立窗口模式（还没添加过）时出现，
// 关闭后记到 localStorage 里，不会每次进来都提示。
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
    setVisible(isIOS && !isStandalone && !dismissed);
  }, []);

  if (!visible) return null;

  return (
    <NoticeBar
      icon={<ShareAltOutlined />}
      text={
        <>
          点击底部分享按钮 <ShareAltOutlined style={{ fontSize: 12 }} />，选择"添加到主屏幕"，像 App 一样使用
        </>
      }
      background={BRAND.primaryDeep}
      color="#fff"
      bottom="calc(66px + env(safe-area-inset-bottom))"
      onClose={() => {
        localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
        setVisible(false);
      }}
    />
  );
}

// 应用强依赖后端接口（认证、数据读写都不走本地缓存），网络断开时明确提示，
// 避免用户在看不出原因的情况下反复重试操作。
export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <NoticeBar
      icon={<WifiOutlined />}
      text="网络已断开，部分功能暂时不可用"
      background="#5c3a0e"
      color="#fff"
      bottom="calc(66px + env(safe-area-inset-bottom))"
    />
  );
}
