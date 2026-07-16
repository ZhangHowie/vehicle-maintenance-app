import React from "react";
import { FloatButton } from "antd";
import { PlusOutlined, ToolOutlined, ThunderboltOutlined, ShoppingOutlined } from "@ant-design/icons";
import RecordFormModal from "./RecordFormModal";
import { RECORD_THEME } from "../theme";
import { useQuickAddRecord } from "../hooks/useQuickAddRecord";

// 桌面端悬浮添加按钮：任意页面都能快速添加一条保养或油耗记录，默认关联当前车辆
// （若在车辆详情页）或最近的一辆车，也可以在弹窗里手动切换车辆。
// 移动端的等价入口并入了 Layout.tsx 底部导航栏的凸起按钮，不再用这个悬浮版本。
export default function QuickAddFloatButton() {
  const { vehicles, modalType, vehicleId, setVehicleId, openModal, closeModal, onSuccess } = useQuickAddRecord();

  if (vehicles.length === 0) return null;

  return (
    <>
      <FloatButton.Group trigger="click" type="primary" style={{ right: 24, bottom: 24 }} icon={<PlusOutlined />}>
        <FloatButton
          icon={<ToolOutlined style={{ color: RECORD_THEME.maintenance.color }} />}
          tooltip="添加保养记录"
          onClick={() => openModal("maintenance")}
        />
        <FloatButton
          icon={<ThunderboltOutlined style={{ color: RECORD_THEME.fuel.color }} />}
          tooltip="添加油耗记录"
          onClick={() => openModal("fuel")}
        />
        <FloatButton
          icon={<ShoppingOutlined style={{ color: RECORD_THEME.expense.color }} />}
          tooltip="添加消费记录"
          onClick={() => openModal("expense")}
        />
      </FloatButton.Group>

      {modalType && (
        <RecordFormModal
          open={Boolean(modalType)}
          type={modalType}
          vehicles={vehicles}
          vehicleId={vehicleId}
          onVehicleChange={setVehicleId}
          onClose={closeModal}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}
