import React, { useEffect } from "react";
import { Modal, Grid } from "antd";
import type { ModalProps } from "antd";

const { useBreakpoint } = Grid;

// 移动端下把普通居中 Modal 变成从底部滑出的全宽"抽屉"（圆角 + 拖拽把手 + 安全区），
// 修掉窄屏上固定宽度对话框容易溢出、显得局促的问题，也更贴近 iOS App 的表单交互习惯。
// 桌面端原样透传成普通居中 Modal，外观和直接用 antd Modal 完全一样。
export default function MobileSheet({ title, width, wrapClassName, styles, children, open, ...rest }: ModalProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // antd 自带的 body 滚动锁定（overflow:hidden）在 iOS Safari 上对 touchmove 无效，
  // 抽屉弹出后背后的页面仍然能被手指划动滚动。改成把 body 本身钉成 position:fixed
  // （并记录/还原滚动位置），这是 iOS 上唯一可靠的锁滚动做法。
  useEffect(() => {
    if (!isMobile || !open) return;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = { position: style.position, top: style.top, left: style.left, right: style.right };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.left = prev.left;
      style.right = prev.right;
      window.scrollTo(0, scrollY);
    };
  }, [isMobile, open]);

  if (!isMobile) {
    return (
      <Modal title={title} width={width} wrapClassName={wrapClassName} styles={styles} open={open} {...rest}>
        {children}
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={
        <>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(0,0,0,0.15)",
              margin: "-4px auto 10px",
            }}
          />
          {title}
        </>
      }
      width="100%"
      wrapClassName={["mobile-sheet-wrap", wrapClassName].filter(Boolean).join(" ")}
      styles={{
        ...styles,
        body: { maxHeight: "70vh", overflowY: "auto", ...(styles?.body ?? {}) },
      }}
      {...rest}
    >
      {children}
    </Modal>
  );
}
