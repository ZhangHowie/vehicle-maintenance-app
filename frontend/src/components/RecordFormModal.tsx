import React, { useEffect, useMemo, useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Switch,
  Space,
  Button,
  message,
  Grid,
} from "antd";
import { PlusOutlined, MinusCircleOutlined, ToolOutlined, ThunderboltOutlined, ShoppingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../api/client";
import { FUEL_TYPE_OPTIONS } from "../constants";
import { RECORD_THEME } from "../theme";
import { SectionLabel, TotalSummary } from "./SectionLabel";
import MobileSheet from "./MobileSheet";

export type RecordType = "maintenance" | "fuel" | "expense";

export interface VehicleOption {
  id: string;
  name: string;
  defaultFuelType: string;
}

interface Props {
  open: boolean;
  type: RecordType;
  vehicles: VehicleOption[];
  vehicleId: string;
  onVehicleChange?: (id: string) => void;
  recordId?: string;
  initialValues?: any;
  onClose: () => void;
  onSuccess: () => void;
}

// 两种记录类型各有自己的强调色，贯穿分组标题、高亮汇总卡片和主按钮，
// 让"添加保养"和"添加油耗"在视觉上一眼可辨，而不是共用同一套无差别的表单外观。
// 配色本身定义在 theme.ts，这里只补上各自的图标。
const THEME = {
  maintenance: { ...RECORD_THEME.maintenance, icon: <ToolOutlined /> },
  fuel: { ...RECORD_THEME.fuel, icon: <ThunderboltOutlined /> },
  expense: { ...RECORD_THEME.expense, icon: <ShoppingOutlined /> },
};

// 保养项目表格：表头和每一行共用同一套 grid 列宽定义，从根本上保证"项目/品牌/个数/单价"
// 横向对齐，且每一行竖向也严格对齐（不再依赖 Space 组件里手动拼凑的像素宽度）。
const ITEM_GRID = "minmax(140px,1.6fr) minmax(90px,1fr) 84px 104px 24px";
const { useBreakpoint } = Grid;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function RecordFormModal({
  open,
  type,
  vehicles,
  vehicleId,
  onVehicleChange,
  recordId,
  initialValues,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(recordId);
  const isMobile = !useBreakpoint().md;
  const currentVehicle = vehicles.find((v) => v.id === vehicleId);
  const theme = THEME[type];

  // 表单里实时预览用的字段监听（不影响提交，提交时后端会用同样的逻辑重新计算权威值）
  const watchedItems = Form.useWatch("items", form) as { quantity?: number; price?: number }[] | undefined;
  const watchedDiscount = Form.useWatch("discountAmount", form) as number | undefined;
  const watchedVolume = Form.useWatch("volume", form) as number | undefined;
  const watchedUnitPrice = Form.useWatch("unitPrice", form) as number | undefined;

  const maintenanceTotal = useMemo(() => {
    const sum = (watchedItems ?? []).reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.price) || 0), 0);
    return Math.max(0, round2(sum - (Number(watchedDiscount) || 0)));
  }, [watchedItems, watchedDiscount]);

  const fuelAmount = useMemo(() => {
    if (typeof watchedVolume === "number" && typeof watchedUnitPrice === "number") {
      return round2(watchedVolume * watchedUnitPrice);
    }
    return 0;
  }, [watchedVolume, watchedUnitPrice]);

  // 打开弹窗时：编辑则回填原始数据，新增则给出合理默认值
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      const amount =
        type === "fuel" && initialValues.volume != null && initialValues.unitPrice != null
          ? round2(Number(initialValues.volume) * Number(initialValues.unitPrice))
          : undefined;
      form.setFieldsValue({
        ...initialValues,
        date: dayjs(initialValues.date),
        ...(amount !== undefined ? { amount } : {}),
      });
    } else if (type === "maintenance") {
      form.resetFields();
      form.setFieldsValue({ date: dayjs(), discountAmount: 0, items: [{ project: "", quantity: 1, price: 0 }] });
    } else if (type === "fuel") {
      form.resetFields();
      form.setFieldsValue({
        date: dayjs(),
        fuelType: currentVehicle?.defaultFuelType ?? "P92",
        isFullTank: true,
        lastRecorded: true,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ date: dayjs() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId, type, vehicleId]);

  // 新增加油记录时，带入该车辆上一条记录的里程数和单价，减少重复输入；
  // 只在"新增"（非编辑）且能取到车辆时才生效，避免覆盖编辑中的原始数据。
  useEffect(() => {
    if (!open || type !== "fuel" || initialValues || !vehicleId) return;
    api
      .get(`/vehicles/${vehicleId}/fuel-records`)
      .then((res) => {
        const records = res.data as any[];
        if (!Array.isArray(records) || records.length === 0) return;
        const last = records[0]; // 后端按日期降序返回，第一条即最近一次
        form.setFieldsValue({
          mileage: last.mileage,
          unitPrice: Number(last.unitPrice),
        });
      })
      .catch(() => {
        // 拿不到历史记录不影响填写，静默忽略
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, vehicleId, initialValues]);

  // 加油量 / 单价 / 总金额 三者只需填两个：改单价时若已有加油量就重算总金额，
  // 否则若已有总金额就反算加油量；改加油量或总金额时，只要单价存在就联动另一个。
  function handleValuesChange(changed: Record<string, unknown>) {
    if (type !== "fuel") return;
    const all = form.getFieldsValue();
    const unitPrice = Number(all.unitPrice);
    const hasUnitPrice = typeof all.unitPrice === "number" && unitPrice > 0;

    if ("unitPrice" in changed) {
      if (hasUnitPrice && typeof all.volume === "number") {
        form.setFieldValue("amount", round2(all.volume * unitPrice));
      } else if (hasUnitPrice && typeof all.amount === "number") {
        form.setFieldValue("volume", round2(all.amount / unitPrice));
      }
    } else if ("volume" in changed) {
      if (hasUnitPrice && typeof all.volume === "number") {
        form.setFieldValue("amount", round2(all.volume * unitPrice));
      }
    } else if ("amount" in changed) {
      if (hasUnitPrice && typeof all.amount === "number") {
        form.setFieldValue("volume", round2(all.amount / unitPrice));
      }
    }
  }

  async function onFinish(values: any) {
    if (!vehicleId) {
      message.error("请选择所属车辆");
      return;
    }
    setLoading(true);
    // 加油记录里 amount 只是加油量/总金额互算用的辅助字段，后端不需要也不认识它，
    // 提交前去掉；消费记录的 amount 是真正要提交的字段，不能一起去掉。
    const { amount, ...rest } = values;
    const payload = type === "fuel" ? { ...rest, date: values.date.toISOString() } : { ...values, date: values.date.toISOString() };
    const basePath =
      type === "maintenance"
        ? `/vehicles/${vehicleId}/maintenance-records`
        : type === "fuel"
        ? `/vehicles/${vehicleId}/fuel-records`
        : `/vehicles/${vehicleId}/expense-records`;
    try {
      if (isEdit) {
        await api.put(`${basePath}/${recordId}`, payload);
      } else {
        await api.post(basePath, payload);
      }
      message.success("保存成功");
      onSuccess();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "保存失败");
    } finally {
      setLoading(false);
    }
  }

  const TITLES: Record<RecordType, string> = { maintenance: "保养记录", fuel: "油耗记录", expense: "消费记录" };
  const title = `${isEdit ? "编辑" : "添加"}${TITLES[type]}`;

  return (
    <MobileSheet
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 7,
              background: theme.tint,
              color: theme.color,
              fontSize: 14,
            }}
          >
            {theme.icon}
          </span>
          {title}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={type === "maintenance" ? 640 : 460}
      maskClosable={false}
    >
      <Form layout="vertical" form={form} onFinish={onFinish} onValuesChange={handleValuesChange}>
        <SectionLabel color={theme.color}>基本信息</SectionLabel>
        <Form.Item label="所属车辆" required style={{ marginBottom: 12 }}>
          {onVehicleChange ? (
            <Select
              value={vehicleId || undefined}
              onChange={onVehicleChange}
              placeholder="请选择车辆"
              options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
            />
          ) : (
            <Input value={currentVehicle?.name} disabled />
          )}
        </Form.Item>

        {type === "maintenance" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item name="date" label="保养日期" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="mileage" label="里程数 (km)" style={{ marginBottom: 0 }}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </div>

            <SectionLabel color={theme.color}>保养项目</SectionLabel>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 460 }}>
                    {fields.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: ITEM_GRID,
                          gap: 8,
                          marginBottom: 6,
                          fontSize: 12,
                          color: "#888",
                        }}
                      >
                        <span>项目</span>
                        <span>品牌</span>
                        <span>个数（个）</span>
                        <span>单价（元）</span>
                        <span />
                      </div>
                    )}
                    {fields.map(({ key, name, ...rest }) => (
                      <div
                        key={key}
                        style={{
                          display: "grid",
                          gridTemplateColumns: ITEM_GRID,
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Form.Item
                          {...rest}
                          name={[name, "project"]}
                          rules={[{ required: true, message: "项目" }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="如机油机滤" />
                        </Form.Item>
                        <Form.Item {...rest} name={[name, "brand"]} style={{ marginBottom: 0 }}>
                          <Input placeholder="品牌" />
                        </Form.Item>
                        <Form.Item
                          {...rest}
                          name={[name, "quantity"]}
                          initialValue={1}
                          rules={[{ required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item
                          {...rest}
                          name={[name, "price"]}
                          rules={[{ required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <MinusCircleOutlined onClick={() => remove(name)} style={{ color: "#999" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="dashed"
                    onClick={() => add({ quantity: 1, price: 0 })}
                    icon={<PlusOutlined />}
                    style={{ marginTop: 4, marginBottom: 4 }}
                  >
                    添加保养项目
                  </Button>
                </div>
              )}
            </Form.List>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "200px 1fr",
                gap: 12,
                alignItems: "end",
                marginTop: 12,
              }}
            >
              <Form.Item name="discountAmount" label="优惠金额（元）" initialValue={0} style={{ marginBottom: 0 }}>
                <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
              </Form.Item>
              <TotalSummary
                label="应付总额"
                value={maintenanceTotal}
                color={theme.color}
                tint={theme.tint}
                hint="= 各项目 个数 × 单价 之和 − 优惠金额"
              />
            </div>

            <Form.Item name="remark" label="备注" style={{ marginTop: 12 }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        ) : type === "fuel" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item name="date" label="加油日期" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="mileage" label="公里数 (km)" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </div>

            <SectionLabel color={theme.color}>加油信息</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item
                name="unitPrice"
                label="加油单价（元/L）"
                rules={[{ required: true, message: "请填写单价" }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber style={{ width: "100%" }} min={0} step={0.01} placeholder="0.00" />
              </Form.Item>
              <Form.Item
                name="volume"
                label="加油量（L）"
                rules={[{ required: true, message: "请填写加油量或总金额" }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber style={{ width: "100%" }} min={0} step={0.01} placeholder="0.00" />
              </Form.Item>
            </div>
            <Form.Item name="amount" label="总金额（元，输入后可反算加油量）" style={{ marginTop: 12, marginBottom: 0 }}>
              <InputNumber style={{ width: "100%" }} min={0} step={0.01} placeholder="留空则自动 = 加油量 × 单价" />
            </Form.Item>
            <div style={{ marginTop: 8 }}>
              <TotalSummary label="本次加油金额" value={fuelAmount} color={theme.color} tint={theme.tint} />
            </div>
            <div style={{ margin: "8px 0 4px", color: "#999", fontSize: 12 }}>
              单价确定后，加油量和总金额只需填一个，另一个会自动算出。
            </div>

            <SectionLabel color={theme.color}>加油属性</SectionLabel>
            <Form.Item name="fuelType" label="加油类型" rules={[{ required: true }]}>
              <Select options={FUEL_TYPE_OPTIONS} />
            </Form.Item>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item name="isFullTank" label="是否跳枪（加满）" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="lastRecorded" label="上次加油是否记录" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item name="date" label="消费日期" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="amount"
                label="金额（元）"
                rules={[{ required: true, message: "请填写金额" }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber style={{ width: "100%" }} min={0} step={0.01} placeholder="0.00" />
              </Form.Item>
            </div>

            <SectionLabel color={theme.color}>消费信息</SectionLabel>
            <Form.Item
              name="item"
              label="消费项目"
              rules={[{ required: true, message: "请填写消费项目" }]}
            >
              <Input placeholder="如停车费、行车记录仪、脚垫" />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}

        <Space style={{ width: "100%", justifyContent: "flex-end", marginTop: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            style={{ background: theme.color, borderColor: theme.color }}
          >
            保存
          </Button>
        </Space>
      </Form>
    </MobileSheet>
  );
}
