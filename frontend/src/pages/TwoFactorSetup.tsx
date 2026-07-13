import React, { useState } from "react";
import { Button, Card, Form, Input, Typography, message, Image, Alert, Space } from "antd";
import { SafetyOutlined } from "@ant-design/icons";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { BRAND } from "../theme";

export default function TwoFactorSetup() {
  const { user, refreshMe } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/totp/setup");
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } finally {
      setLoading(false);
    }
  }

  async function onEnable(values: { code: string }) {
    setLoading(true);
    try {
      await api.post("/auth/totp/enable", values);
      message.success("两步验证已开启");
      setQrCode(null);
      await refreshMe();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "验证码不正确");
    } finally {
      setLoading(false);
    }
  }

  async function onDisable(values: { password: string }) {
    setLoading(true);
    try {
      await api.post("/auth/totp/disable", values);
      message.success("两步验证已关闭");
      await refreshMe();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "密码不正确");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      style={{ maxWidth: 480, borderRadius: 12 }}
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
            <SafetyOutlined />
          </span>
          两步验证 (TOTP)
        </span>
      }
    >
      {user?.totpEnabled ? (
        <>
          <Alert type="success" showIcon message="两步验证已开启" style={{ marginBottom: 16 }} />
          <Form layout="vertical" onFinish={onDisable}>
            <Form.Item name="password" label="输入密码以关闭两步验证" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Button danger htmlType="submit" loading={loading}>
              关闭两步验证
            </Button>
          </Form>
        </>
      ) : qrCode ? (
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            请使用 Google Authenticator / Microsoft Authenticator 等验证器 App 扫描二维码：
          </Typography.Paragraph>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 16,
              background: "#fafafa",
              border: "1px solid #f0f0f0",
              borderRadius: 10,
            }}
          >
            <Image src={qrCode} width={200} preview={false} />
          </div>
          <Typography.Text type="secondary">或手动输入密钥：{secret}</Typography.Text>
          <Form layout="vertical" onFinish={onEnable}>
            <Form.Item name="code" label="输入验证器生成的 6 位验证码" rules={[{ required: true, len: 6 }]}>
              <Input maxLength={6} placeholder="6 位验证码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ background: BRAND.primary }}>
              确认开启
            </Button>
          </Form>
        </Space>
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            开启后，登录时除了密码，还需要输入验证器 App 生成的 6 位动态验证码，进一步保护账号安全。
          </Typography.Paragraph>
          <Button type="primary" onClick={startSetup} loading={loading} style={{ background: BRAND.primary }}>
            开启两步验证
          </Button>
        </>
      )}
    </Card>
  );
}
