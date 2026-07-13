import React, { useState } from "react";
import { Button, Form, Input, message, Result } from "antd";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import AuthLayout from "../components/AuthLayout";
import { BRAND } from "../theme";

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onFinish(values: { email: string }) {
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", values);
      setSent(true);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "发送失败");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="邮件已发送">
        <Result
          status="success"
          title="请查收邮箱"
          subTitle="如果该邮箱已注册，重置密码邮件已发送，按邮件里的链接继续操作。"
          style={{ padding: "24px 0" }}
        />
        <div style={{ textAlign: "center", fontSize: 13 }}>
          <Link to="/login">返回登录</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="忘记密码" subtitle="输入注册邮箱，我们会发送重置密码的链接">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
          <Input size="large" placeholder="you@example.com" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ background: BRAND.primary }}>
          发送重置邮件
        </Button>
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
          <Link to="/login">返回登录</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
