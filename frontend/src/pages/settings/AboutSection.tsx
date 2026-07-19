import React, { useEffect, useState } from "react";
import { Card, Space, Tag } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { APP_VERSION, GIT_COMMIT } from "../../version";
import CardTitle from "../../components/CardTitle";

// 短 commit hash 只取前 7 位，跟 git 命令行、GitHub 界面显示习惯一致
function shortCommit(commit: string) {
  return commit && commit !== "dev" ? commit.slice(0, 7) : commit;
}

export default function AboutSection() {
  const [backendVersion, setBackendVersion] = useState<{ version: string; commit: string } | null>(null);

  useEffect(() => {
    // /api/health 不需要登录，用普通请求即可；拿不到时不影响页面其它功能，
    // 版本信息那一行直接不显示后端部分。
    api
      .get("/health")
      .then((res) => setBackendVersion({ version: res.data.version, commit: res.data.commit }))
      .catch(() => setBackendVersion(null));
  }, []);

  return (
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
  );
}
