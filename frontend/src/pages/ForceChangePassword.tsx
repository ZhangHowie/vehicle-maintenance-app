import React, { useState } from "react";
import { Button, Form, Input, Alert, message } from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { BRAND } from "../theme";

// 使用默认管理员账号首次登录后，强制在这里修改密码，不能跳过或访问其他页面。
export default function ForceChangePassword() {
  const { refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { currentPassword: string; newPassword: string; confirm: string }) {
    if (values.newPassword !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success("密码已修改");
      await refreshMe();
      navigate("/");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "修改失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="请修改初始密码">
      <Alert
        type="warning"
        showIcon
        message="首次使用默认账号登录，必须修改密码后才能继续使用"
        style={{ marginBottom: 16 }}
      />
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="currentPassword" label="当前密码（即默认密码）" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" size="large" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[{ required: true, min: 8, message: "至少 8 位，需包含大小写字母和数字" }]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Form.Item name="confirm" label="确认新密码" rules={[{ required: true }]}>
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ background: BRAND.primary }}>
          修改密码并继续
        </Button>
        <Button type="link" block onClick={logout} style={{ marginTop: 4 }}>
          退出登录
        </Button>
      </Form>
    </AuthLayout>
  );
}
