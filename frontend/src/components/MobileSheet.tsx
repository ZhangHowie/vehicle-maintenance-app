import React from "react";
import { Modal, Grid } from "antd";
import type { ModalProps } from "antd";

const { useBreakpoint } = Grid;

// 移动端下把普通居中 Modal 变成从底部滑出的全宽"抽屉"（圆角 + 拖拽把手 + 安全区），
// 修掉窄屏上固定宽度对话框容易溢出、显得局促的问题，也更贴近 iOS App 的表单交互习惯。
// 桌面端原样透传成普通居中 Modal，外观和直接用 antd Modal 完全一样。
export default function MobileSheet({ title, width, wrapClassName, styles, children, ...rest }: ModalProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  if (!isMobile) {
    return (
      <Modal title={title} width={width} wrapClassName={wrapClassName} styles={styles} {...rest}>
        {children}
      </Modal>
    );
  }

  return (
    <Modal
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
