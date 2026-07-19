import React, { useState } from "react";
import { Card, Button, message, Space, Upload, Divider, Progress } from "antd";
import { UploadOutlined, DownloadOutlined, DatabaseOutlined, RightOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { BRAND } from "../../theme";
import CardTitle from "../../components/CardTitle";

export default function DataSection() {
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<"uploading" | "processing" | null>(null);
  const [importProgress, setImportProgress] = useState(0);

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
      const { importedVehicles, importedMaintenance, importedFuel, importedExpense, importedImages } = res.data;
      message.success(
        `导入成功：车辆 ${importedVehicles} 辆（含封面图片 ${importedImages ?? 0} 张），保养记录 ${importedMaintenance} 条，油耗记录 ${importedFuel} 条，消费记录 ${importedExpense ?? 0} 条`
      );
      // 导入的车辆/记录不会自动出现在当前页面已加载的数据里，刷新一下让首页、车辆列表
      // 立刻看到导入结果，避免用户以为"导入成功了但数据没变"。
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
  );
}
