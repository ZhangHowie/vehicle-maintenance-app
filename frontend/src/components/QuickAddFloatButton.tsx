import React, { useEffect, useState } from "react";
import { FloatButton } from "antd";
import { PlusOutlined, ToolOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useMatch } from "react-router-dom";
import { api } from "../api/client";
import RecordFormModal, { RecordType, VehicleOption } from "./RecordFormModal";
import { notifyRecordsUpdated } from "../events";
import { RECORD_THEME } from "../theme";

// 全局悬浮添加按钮：任意页面都能快速添加一条保养或油耗记录，默认关联当前车辆（若在车辆详情页）
// 或最近的一辆车，也可以在弹窗里手动切换车辆。
export default function QuickAddFloatButton() {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [modalType, setModalType] = useState<RecordType | null>(null);
  const [vehicleId, setVehicleId] = useState<string>("");
  const vehicleMatch = useMatch("/vehicles/:id");

  useEffect(() => {
    api.get("/vehicles").then((res) => setVehicles(res.data));
  }, [modalType]);

  function openModal(type: RecordType) {
    const defaultId = vehicleMatch?.params.id ?? vehicles[0]?.id ?? "";
    setVehicleId(defaultId);
    setModalType(type);
  }

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
      </FloatButton.Group>

      {modalType && (
        <RecordFormModal
          open={Boolean(modalType)}
          type={modalType}
          vehicles={vehicles}
          vehicleId={vehicleId}
          onVehicleChange={setVehicleId}
          onClose={() => setModalType(null)}
          onSuccess={() => notifyRecordsUpdated()}
        />
      )}
    </>
  );
}
