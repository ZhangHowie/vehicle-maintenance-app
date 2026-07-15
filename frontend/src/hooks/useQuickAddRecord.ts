import { useEffect, useState } from "react";
import { useMatch } from "react-router-dom";
import { api } from "../api/client";
import { RecordType, VehicleOption } from "../components/RecordFormModal";
import { notifyRecordsUpdated } from "../events";

// 桌面端悬浮加号按钮和移动端底部导航栏的中间按钮共用同一套「拉取车辆列表 →
// 选记录类型 → 决定默认关联车辆 → 打开表单」逻辑，抽成 hook 避免两处分别维护。
export function useQuickAddRecord() {
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

  function closeModal() {
    setModalType(null);
  }

  return {
    vehicles,
    modalType,
    vehicleId,
    setVehicleId,
    openModal,
    closeModal,
    onSuccess: notifyRecordsUpdated,
  };
}
