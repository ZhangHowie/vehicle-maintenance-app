import React, { useState } from "react";
import { Button, Form, Input, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { BRAND } from "../theme";
import { useMultiUserStatus } from "../hooks/useMultiUserStatus";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const multiUserEnabled = useMultiUserStatus();

  async function onFinish(values: { username: string; email?: string; password: string; confirm: string }) {
    if (values.password !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await register(values.username, values.password, values.email || undefined);
      navigate("/");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "注册失败");
    } finally {
      setLoading(false);
    }
  }

  if (multiUserEnabled === false) {
    return (
      <AuthLayout title="注册账号" subtitle="创建账号，开始记录你的车辆">
        <div style={{ color: "#888", fontSize: 13, lineHeight: 1.8 }}>
          多用户功能未开启，暂不支持注册新账号，请联系管理员在"设置"页中开启。
        </div>
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
          <Link to="/login">返回登录</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="注册账号" subtitle="创建账号，开始记录你的车辆">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="username"
          label="用户名"
          rules={[
            { required: true, message: "请输入用户名" },
            { pattern: /^[a-zA-Z0-9_]{3,32}$/, message: "3-32 位，只能包含字母、数字、下划线" },
          ]}
        >
          <Input size="large" placeholder="用于登录，如 admin" />
        </Form.Item>
        <Form.Item name="email" label="邮箱（可选，用于找回密码）" rules={[{ type: "email", message: "邮箱格式不正确" }]}>
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
