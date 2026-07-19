import React, { useState } from "react";
import { Card, Form, Input, Button, message, Space, Avatar } from "antd";
import { SafetyOutlined, LockOutlined, EditOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { BRAND } from "../../theme";
import CardTitle from "../../components/CardTitle";

export default function ProfileSection() {
  const { user, refreshMe } = useAuth();
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function onUpdateUsername(values: { username: string }) {
    setUsernameLoading(true);
    try {
      await api.patch("/auth/me", values);
      await refreshMe();
      message.success("用户名已修改");
      setEditingUsername(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "修改失败");
    } finally {
      setUsernameLoading(false);
    }
  }

  async function onChangePassword(values: { currentPassword: string; newPassword: string; confirm: string }) {
    if (values.newPassword !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setPasswordLoading(true);
    try {
      await api.post("/auth/change-password", values);
      message.success("密码已修改");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "修改失败");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar size={48} style={{ backgroundColor: BRAND.primary, fontSize: 18 }}>
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            {editingUsername ? (
              <Form layout="inline" initialValues={{ username: user?.username }} onFinish={onUpdateUsername}>
                <Form.Item
                  name="username"
                  rules={[
                    { required: true, message: "请输入用户名" },
                    { pattern: /^[a-zA-Z0-9_]{3,32}$/, message: "3-32 位，只能包含字母、数字、下划线" },
                  ]}
                  style={{ marginBottom: 8 }}
                >
                  <Input size="small" autoFocus style={{ width: 160 }} />
                </Form.Item>
                <Form.Item style={{ marginBottom: 8 }}>
                  <Space size={6}>
                    <Button type="primary" size="small" htmlType="submit" loading={usernameLoading} style={{ background: BRAND.primary }}>
                      保存
                    </Button>
                    <Button size="small" onClick={() => setEditingUsername(false)}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {user?.username}
                <EditOutlined
                  style={{ fontSize: 13, color: "#999", cursor: "pointer" }}
                  onClick={() => setEditingUsername(true)}
                />
              </div>
            )}
            <div style={{ fontSize: 12, color: "#999" }}>
              {user?.email ? `${user.email} · ` : ""}
              两步验证：{user?.totpEnabled ? "已开启" : "未开启"}
            </div>
          </div>
          <Link to="/settings/2fa">
            <Button icon={<SafetyOutlined />}>{user?.totpEnabled ? "管理两步验证" : "开启两步验证"}</Button>
          </Link>
        </div>
      </Card>

      <Card title={<CardTitle icon={<LockOutlined />}>修改密码</CardTitle>} style={{ borderRadius: 12 }}>
        <Form layout="vertical" onFinish={onChangePassword}>
          <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirm" label="确认新密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={passwordLoading} style={{ background: BRAND.primary }}>
            修改密码
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
