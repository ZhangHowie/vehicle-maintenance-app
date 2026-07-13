import React, { useState } from "react";
import { Button, Form, Input, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import AuthLayout from "../components/AuthLayout";
import { BRAND } from "../theme";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { newPassword: string; confirm: string }) {
    if (values.newPassword !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: params.get("email"),
        token: params.get("token"),
        newPassword: values.newPassword,
      });
      message.success("密码已重置，请重新登录");
      navigate("/login");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "重置失败，请重新申请重置链接");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="重置密码" subtitle="设置一个新密码">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}>
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" label="确认新密码" rules={[{ required: true }]}>
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ background: BRAND.primary }}>
          重置密码
        </Button>
      </Form>
    </AuthLayout>
  );
}
