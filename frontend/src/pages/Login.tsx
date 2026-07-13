import React, { useState } from "react";
import { Button, Form, Input, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { BRAND } from "../theme";

export default function Login() {
  const { login, loginTotp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if (result.requiresTotp && result.preAuthToken) {
        setPreAuthToken(result.preAuthToken);
      } else {
        navigate("/");
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "登录失败");
    } finally {
      setLoading(false);
    }
  }

  async function onTotpFinish(values: { code: string }) {
    if (!preAuthToken) return;
    setLoading(true);
    try {
      await loginTotp(preAuthToken, values.code);
      navigate("/");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "验证码不正确");
    } finally {
      setLoading(false);
    }
  }

  if (preAuthToken) {
    return (
      <AuthLayout title="两步验证" subtitle="请输入验证器 App 生成的 6 位验证码">
        <Form layout="vertical" onFinish={onTotpFinish}>
          <Form.Item name="code" rules={[{ required: true, len: 6, message: "请输入 6 位验证码" }]}>
            <Input maxLength={6} placeholder="6 位验证码" size="large" autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ background: BRAND.primary }}>
            验证并登录
          </Button>
        </Form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="登录" subtitle="使用邮箱和密码登录你的账号">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
          <Input autoComplete="username" size="large" placeholder="you@example.com" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
          <Input.Password autoComplete="current-password" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ background: BRAND.primary }}>
          登录
        </Button>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <Link to="/forgot-password">忘记密码？</Link>
          <Link to="/register">注册新账号</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
