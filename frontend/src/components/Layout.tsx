import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout as AntLayout, Menu, Button, Grid, Avatar } from "antd";
import { CarOutlined, SettingOutlined, LogoutOutlined, DashboardOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import QuickAddFloatButton from "./QuickAddFloatButton";
import { BRAND } from "../theme";

const { Header, Content, Sider } = AntLayout;
const { useBreakpoint } = Grid;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: <Link to="/">首页</Link> },
    { key: "/settings", icon: <SettingOutlined />, label: <Link to="/settings">账户设置</Link> },
  ];

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          theme="dark"
          style={{ background: BRAND.primaryDeep, boxShadow: "2px 0 8px rgba(0,0,0,0.1)" }}
        >
          <div
            style={{
              color: "#fff",
              padding: "20px 16px",
              fontWeight: 700,
              fontSize: 17,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: `linear-gradient(135deg, ${BRAND.primaryDeep}, ${BRAND.primary})`,
            }}
          >
            <CarOutlined style={{ fontSize: 20 }} />
            车辆保养管理
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ background: BRAND.primaryDeep }}
          />
        </Sider>
      )}
      <AntLayout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            {isMobile && (
              <>
                <CarOutlined />
                车辆保养管理
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 8, color: "#555" }}>
              <Avatar size="small" style={{ backgroundColor: BRAND.primary }}>
                {user?.email?.[0]?.toUpperCase()}
              </Avatar>
              {user?.email}
            </span>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              退出登录
            </Button>
          </div>
        </Header>
        <Content style={{ padding: 20, background: "#f5f6f8" }}>
          <Outlet />
        </Content>
        {isMobile && (
          <Menu mode="horizontal" selectedKeys={[location.pathname]} items={menuItems} style={{ justifyContent: "center" }} />
        )}
      </AntLayout>
      <QuickAddFloatButton />
    </AntLayout>
  );
}
