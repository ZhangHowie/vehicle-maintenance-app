import React, { useEffect, useState } from "react";
import { Button, Card, Form, Input, Select, message, Space } from "antd";
import { CarOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { FUEL_TYPE_OPTIONS } from "../constants";
import ImageCropUpload from "../components/ImageCropUpload";
import { SectionLabel } from "../components/SectionLabel";
import { BRAND } from "../theme";

export default function VehicleForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) {
      api.get(`/vehicles/${id}`).then((res) => {
        form.setFieldsValue(res.data);
        setExistingCoverUrl(res.data.coverImageUrl ?? null);
      });
    }
  }, [id]);

  useEffect(() => {
    if (!pendingCover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingCover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingCover]);

  async function onFinish(values: any) {
    setLoading(true);
    try {
      let vehicleId = id;
      if (isEdit) {
        await api.put(`/vehicles/${id}`, values);
      } else {
        const { data } = await api.post("/vehicles", values);
        vehicleId = data.id;
      }

      if (pendingCover && vehicleId) {
        const formData = new FormData();
        // 图片在裁剪弹窗里已经按 16:9 裁剪好了，这里直接上传裁剪后的文件即可，
        // 不再需要额外传裁剪范围。
        formData.append("file", pendingCover);
        await api.post(`/vehicles/${vehicleId}/cover`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      message.success("保存成功");
      navigate(`/vehicles/${vehicleId}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      style={{ maxWidth: 560, borderRadius: 12 }}
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
              background: BRAND.primarySoft,
              color: BRAND.primary,
              fontSize: 14,
            }}
          >
            <CarOutlined />
          </span>
          {isEdit ? "编辑车辆" : "添加车辆"}
        </span>
      }
    >
      <Form layout="vertical" form={form} onFinish={onFinish} initialValues={{ defaultFuelType: "P92" }}>
        <SectionLabel color={BRAND.primary}>基本信息</SectionLabel>
        <Form.Item name="name" label="车辆名称" rules={[{ required: true, message: "请输入车辆名称" }]}>
          <Input placeholder="例如：我的小轿车" />
        </Form.Item>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item name="brand" label="品牌">
            <Input placeholder="如本田" />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input placeholder="如雅阁" />
          </Form.Item>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item name="plateNo" label="车牌号">
            <Input placeholder="如京A·12345" />
          </Form.Item>
          <Form.Item name="defaultFuelType" label="默认油品类型" rules={[{ required: true }]}>
            <Select options={FUEL_TYPE_OPTIONS} />
          </Form.Item>
        </div>

        <SectionLabel color={BRAND.primary}>车辆封面</SectionLabel>
        <Form.Item>
          <Space direction="vertical" style={{ width: "100%" }}>
            {(coverPreview || existingCoverUrl) && (
              <div
                style={{
                  width: "100%",
                  maxWidth: 360,
                  aspectRatio: "16 / 9",
                  overflow: "hidden",
                  borderRadius: 8,
                  border: "1px solid #f0f0f0",
                }}
              >
                <img
                  src={coverPreview ?? existingCoverUrl ?? undefined}
                  alt="封面预览"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            )}
            <ImageCropUpload onCropped={(file) => setPendingCover(file)} />
            {pendingCover && <span style={{ color: "#999", fontSize: 12 }}>已选择新封面，保存后生效（预览已按实际展示比例显示）</span>}
          </Space>
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} style={{ background: BRAND.primary, marginTop: 8 }}>
          保存
        </Button>
      </Form>
    </Card>
  );
}
