import React, { useState } from "react";
import { Segmented } from "antd";
import { UserOutlined, TeamOutlined, DatabaseOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import ProfileSection from "./settings/ProfileSection";
import UsersSection from "./settings/UsersSection";
import DataSection from "./settings/DataSection";
import AboutSection from "./settings/AboutSection";

type SectionKey = "profile" | "users" | "data" | "about";

export default function Settings() {
  const { user } = useAuth();
  const [section, setSection] = useState<SectionKey>("profile");

  const options = [
    { label: "个人资料", value: "profile", icon: <UserOutlined /> },
    ...(user?.role === "ADMIN" ? [{ label: "用户管理", value: "users", icon: <TeamOutlined /> }] : []),
    { label: "数据管理", value: "data", icon: <DatabaseOutlined /> },
    { label: "关于", value: "about", icon: <InfoCircleOutlined /> },
  ].map((o) => ({ label: (<span style={{ display: "flex", alignItems: "center", gap: 6 }}>{o.icon}{o.label}</span>), value: o.value }));

  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      {/* 同车辆详情页的年份选择器：选项多时横向滚动，避免在窄屏上溢出/挤压 */}
      <div style={{ overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        <Segmented options={options} value={section} onChange={(v) => setSection(v as SectionKey)} style={{ flexShrink: 0 }} />
      </div>

      {section === "profile" && <ProfileSection />}
      {section === "users" && user?.role === "ADMIN" && <UsersSection />}
      {section === "data" && <DataSection />}
      {section === "about" && <AboutSection />}
    </div>
  );
}
