import React, { useState } from "react";
import { Button, Form, Input, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { BRAND } from "../theme";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; password: string; confirm: string }) {
    if (values.password !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await register(values.email, values.password);
      navigate("/");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="注册账号" subtitle="创建账号，开始记录你的车辆">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
          <Input size="large" placeholder="you@example.com" />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, min: 8, message: "至少 8 位，需包含大小写字母和数字" }]}
        >
          <Input.Password size="large" />
        </Form.Item>
        <Form.Item name="confirm" label="确认密码" rules={[{ required: true }]}>
          <Input.Password size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ background: BRAND.primary }}>
          注册
        </Button>
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
          <Link to="/login">已有账号？去登录</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
