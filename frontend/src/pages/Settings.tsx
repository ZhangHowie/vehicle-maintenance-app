import React, { useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Space, Upload, Divider, Avatar, Progress, Tag } from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  SafetyOutlined,
  LockOutlined,
  DatabaseOutlined,
  RightOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { BRAND } from "../theme";
import { APP_VERSION, GIT_COMMIT } from "../version";

// 图标气泡 + 标题的卡片标题样式，跟登录页品牌角标、添加记录弹窗的图标气泡是同一套视觉语言，
// 让"设置"页看起来和这个应用的其它部分是一体的，而不是套用 antd 默认卡片标题。
function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
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
        {icon}
      </span>
      {children}
    </span>
  );
}

// 短 commit hash 只取前 7 位，跟 git 命令行、GitHub 界面显示习惯一致
function shortCommit(commit: string) {
  return commit && commit !== "dev" ? commit.slice(0, 7) : commit;
}

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<"uploading" | "processing" | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [backendVersion, setBackendVersion] = useState<{ version: string; commit: string } | null>(null);

  useEffect(() => {
    // /api/health 不需要登录，用普通请求即可；拿不到时不影响页面其它功能，
    // 版本信息那一行直接不显示后端部分。
    api
      .get("/health")
      .then((res) => setBackendVersion({ version: res.data.version, commit: res.data.commit }))
      .catch(() => setBackendVersion(null));
  }, []);

  async function onChangePassword(values: { currentPassword: string; newPassword: string; confirm: string }) {
    if (values.newPassword !== values.confirm) {
      message.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", values);
      message.success("密码已修改");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "修改失败");
    } finally {
      setLoading(false);
    }
  }

  async function exportData(format: "json" | "csv") {
    const res = await api.get(`/data/export?format=${format}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "csv" ? "vehicle-data-export.zip" : "vehicle-data-export.json";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    setImporting(true);
    setImportPhase("uploading");
    setImportProgress(0);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await api.post("/data/import", json, {
        onUploadProgress: (evt) => {
          // 内嵌了封面图片的导入文件可能有几 MB 到几十 MB，上传本身需要一点时间，
          // 这里用真实的请求体发送进度驱动进度条，不是假动画。上传到 100% 之后，
          // 后端还要在一个数据库事务里写车辆/记录/图片文件，这段没有进度可言，
          // 切到"处理中"的不确定态提示，而不是让进度条卡在 99% 让人以为卡住了。
          if (evt.total) {
            const percent = Math.round((evt.loaded * 100) / evt.total);
            setImportProgress(percent);
            if (percent >= 100) setImportPhase("processing");
          }
        },
      });
      const { importedVehicles, importedMaintenance, importedFuel, importedImages } = res.data;
      message.success(
        `导入成功：车辆 ${importedVehicles} 辆（含封面图片 ${importedImages ?? 0} 张），保养记录 ${importedMaintenance} 条，油耗记录 ${importedFuel} 条`
      );
      // 导入的车辆/记录不会自动出现在当前页面已加载的数据里，刷新一下让首页、车辆列表
      // 立刻看到导入结果，避免用户以为“导入成功了但数据没变”。
      window.setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        message.error("导入失败：文件不是有效的 JSON，请选择本系统导出的备份文件");
      } else {
        message.error(e?.response?.data?.message ?? "导入失败，请检查文件格式");
      }
    } finally {
      setImporting(false);
      setImportPhase(null);
      setImportProgress(0);
    }
    return false;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%", maxWidth: 560 }}>
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar size={48} style={{ backgroundColor: BRAND.primary, fontSize: 18 }}>
            {user?.email?.[0]?.toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.email}</div>
            <div style={{ fontSize: 12, color: "#999" }}>
              两步验证：{user?.totpEnabled ? "已开启" : "未开启"}
            </div>
          </div>
          <Link to="/settings/2fa">
            <Button icon={<SafetyOutlined />}>
              {user?.totpEnabled ? "管理两步验证" : "开启两步验证"}
            </Button>
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
          <Button type="primary" htmlType="submit" loading={loading} style={{ background: BRAND.primary }}>
            修改密码
          </Button>
        </Form>
      </Card>

      <Card title={<CardTitle icon={<DatabaseOutlined />}>数据导入 / 导出 / 备份</CardTitle>} style={{ borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => exportData("json")}>
              导出 JSON
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportData("csv")}>
              导出 CSV/Excel（压缩包）
            </Button>
          </Space>
          <Divider style={{ margin: "8px 0" }} />
          <Upload beforeUpload={importData} showUploadList={false} accept="application/json" disabled={importing}>
            <Button icon={<UploadOutlined />} loading={importing}>
              {importing ? "正在导入…" : "导入 JSON 数据"}
            </Button>
          </Upload>
          {importPhase && (
            <div style={{ maxWidth: 360 }}>
              <Progress
                percent={importPhase === "processing" ? 100 : importProgress}
                status={importPhase === "processing" ? "active" : "normal"}
                strokeColor={BRAND.primary}
                size="small"
              />
              <div style={{ fontSize: 12, color: "#999" }}>
                {importPhase === "uploading" ? `正在上传备份文件…${importProgress}%` : "文件已上传，正在写入数据库…"}
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 4,
              padding: "8px 12px",
              background: "#fafafa",
              borderRadius: 8,
              color: "#888",
              fontSize: 12,
            }}
          >
            <RightOutlined style={{ fontSize: 10, marginTop: 3 }} />
            导入不会覆盖或删除现有数据，只会新增；导入的 JSON 需要是本系统「导出 JSON」生成的文件（含封面图片，导入到全新环境也能恢复图片）。整批导入是原子操作：其中任何一辆车、任何一条记录有问题都会整体失败并回滚，不会出现部分导入、数据不完整的情况。
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "8px 12px",
              background: "#fafafa",
              borderRadius: 8,
              color: "#888",
              fontSize: 12,
            }}
          >
            <RightOutlined style={{ fontSize: 10, marginTop: 3 }} />
            数据库自动备份由服务端 backup 容器每日执行，管理员可在服务器 backups 目录中找到备份文件。
          </div>
        </Space>
      </Card>

      <Card title={<CardTitle icon={<InfoCircleOutlined />}>版本信息</CardTitle>} style={{ borderRadius: 12 }}>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#666", fontSize: 13 }}>前端</span>
            <Space size={6}>
              <Tag color="blue">v{APP_VERSION}</Tag>
              <span style={{ fontSize: 12, color: "#999", fontFamily: "monospace" }}>{shortCommit(GIT_COMMIT)}</span>
            </Space>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#666", fontSize: 13 }}>后端</span>
            {backendVersion ? (
              <Space size={6}>
                <Tag color="blue">v{backendVersion.version}</Tag>
                <span style={{ fontSize: 12, color: "#999", fontFamily: "monospace" }}>{shortCommit(backendVersion.commit)}</span>
              </Space>
            ) : (
              <span style={{ fontSize: 12, color: "#ccc" }}>获取失败</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            两边 commit 都对应同一次代码推送时才是完全同步的最新版本；如果只更新了一边（比如只 pull 了前端镜像），这里能看出来。
          </div>
        </Space>
      </Card>
    </Space>
  );
}
