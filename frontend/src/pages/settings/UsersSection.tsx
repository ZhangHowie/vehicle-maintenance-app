import React, { useEffect, useState } from "react";
import { Card, Table, Tag, Button, Switch, Modal, Form, Input, message, Space, Popconfirm, Empty } from "antd";
import { TeamOutlined, EditOutlined, DeleteOutlined, UserAddOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { BRAND } from "../../theme";
import CardTitle from "../../components/CardTitle";

interface ManagedUser {
  id: string;
  username: string;
  email: string | null;
  role: "ADMIN" | "USER";
  createdAt: string;
  vehicleCount: number;
}

export default function UsersSection() {
  const { user: currentUser } = useAuth();
  const [multiUserEnabled, setMultiUserEnabled] = useState<boolean | null>(null);
  const [multiUserLoading, setMultiUserLoading] = useState(false);
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [form] = Form.useForm();

  function loadSettings() {
    api
      .get("/settings")
      .then((res) => setMultiUserEnabled(res.data.multiUserEnabled))
      .catch(() => setMultiUserEnabled(null));
  }

  function loadUsers() {
    api
      .get("/users")
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]));
  }

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  function onToggleMultiUser(checked: boolean) {
    const doUpdate = async () => {
      setMultiUserLoading(true);
      try {
        await api.patch("/settings", { multiUserEnabled: checked });
        setMultiUserEnabled(checked);
        message.success(checked ? "已开启多用户模式" : "已关闭多用户模式");
      } catch (e: any) {
        message.error(e?.response?.data?.message ?? "设置失败");
      } finally {
        setMultiUserLoading(false);
      }
    };

    Modal.confirm({
      title: checked ? "确认开启多用户模式？" : "确认关闭多用户模式？",
      content: checked
        ? "开启后系统将允许注册新账号，且每个账号（包括你）只能看到自己名下的数据。"
        : "关闭后将不再允许注册新账号，你的管理员账号会重新可以看到系统里所有账号的数据。",
      onOk: doUpdate,
    });
  }

  function openEdit(u: ManagedUser) {
    setEditingUser(u);
    form.setFieldsValue({ username: u.username, newPassword: "" });
  }

  async function onSaveUser(values: { username: string; newPassword?: string }) {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const payload: { username?: string; newPassword?: string } = {};
      if (values.username !== editingUser.username) payload.username = values.username;
      if (values.newPassword) payload.newPassword = values.newPassword;
      if (Object.keys(payload).length === 0) {
        setEditingUser(null);
        return;
      }
      await api.patch(`/users/${editingUser.id}`, payload);
      message.success(payload.newPassword ? "已保存，对方下次登录需要用新密码并重新设置密码" : "已保存");
      setEditingUser(null);
      loadUsers();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "保存失败");
    } finally {
      setSavingUser(false);
    }
  }

  async function onDeleteUser(u: ManagedUser) {
    try {
      await api.delete(`/users/${u.id}`);
      message.success(`已删除账号 ${u.username}`);
      loadUsers();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "删除失败");
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title={<CardTitle icon={<TeamOutlined />}>多用户模式</CardTitle>} style={{ borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ maxWidth: 420, fontSize: 12, color: "#999" }}>
            关闭时（默认）：不允许注册新账号，你的管理员账号能看到下面表格里所有账号的数据。
            开启后：允许注册新账号，每个账号只能看到自己名下的数据。
          </div>
          <Switch checked={multiUserEnabled ?? false} loading={multiUserLoading} onChange={onToggleMultiUser} />
        </div>
      </Card>

      <Card title={<CardTitle icon={<UserAddOutlined />}>账号列表</CardTitle>} style={{ borderRadius: 12 }}>
        <Table<ManagedUser>
          rowKey="id"
          dataSource={users ?? []}
          loading={users === null}
          pagination={false}
          size="small"
          // 窄屏（手机）下列会超出卡片宽度，允许表格横向滚动而不是被裁掉
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty description="暂无账号" /> }}
          columns={[
            {
              title: "用户名",
              dataIndex: "username",
              render: (_, u) => (
                <Space size={6}>
                  {u.username}
                  {u.role === "ADMIN" && <Tag color="blue">管理员</Tag>}
                </Space>
              ),
            },
            { title: "邮箱", dataIndex: "email", render: (v) => v ?? <span style={{ color: "#ccc" }}>未设置</span> },
            { title: "车辆数", dataIndex: "vehicleCount" },
            {
              title: "创建时间",
              dataIndex: "createdAt",
              render: (v) => dayjs(v).format("YYYY-MM-DD"),
            },
            {
              title: "操作",
              key: "actions",
              render: (_, u) => (
                <Space size={12}>
                  <EditOutlined style={{ cursor: "pointer", color: BRAND.primary }} onClick={() => openEdit(u)} />
                  <Popconfirm
                    title="删除该账号？"
                    description="该账号名下的车辆和记录会一并删除，且无法恢复。"
                    okButtonProps={{ danger: true }}
                    disabled={u.id === currentUser?.id}
                    onConfirm={() => onDeleteUser(u)}
                  >
                    <DeleteOutlined
                      style={{
                        cursor: u.id === currentUser?.id ? "not-allowed" : "pointer",
                        color: u.id === currentUser?.id ? "#ccc" : "#ff4d4f",
                      }}
                    />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="编辑账号"
        open={!!editingUser}
        onCancel={() => setEditingUser(null)}
        onOk={() => form.submit()}
        confirmLoading={savingUser}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={onSaveUser}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              { pattern: /^[a-zA-Z0-9_]{3,32}$/, message: "3-32 位，只能包含字母、数字、下划线" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="重置密码（留空则不修改）"
            rules={[{ min: 8, message: "至少 8 位，需包含大小写字母和数字" }]}
            extra="重置后对方下次登录会被强制要求修改密码。"
          >
            <Input.Password placeholder="不填则保持原密码不变" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
