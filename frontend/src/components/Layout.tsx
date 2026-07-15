import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout as AntLayout, Menu, Button, Grid, Avatar, Popover, Space } from "antd";
import {
  CarOutlined,
  SettingOutlined,
  LogoutOutlined,
  DashboardOutlined,
  PlusOutlined,
  ToolOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import QuickAddFloatButton from "./QuickAddFloatButton";
import RecordFormModal from "./RecordFormModal";
import { InstallPrompt, OfflineBanner } from "./StatusBanners";
import { useQuickAddRecord } from "../hooks/useQuickAddRecord";
import { BRAND, RECORD_THEME, SURFACE } from "../theme";

const { Header, Content, Sider } = AntLayout;
const { useBreakpoint } = Grid;

// 移动端底部导航栏中间的凸起加号按钮：用保养橙/加油青蓝对角劈开，直接把全站
// 记录类型的配色系统用在导航本身上，点开是"保养/加油"两个选项——桌面端的
// 悬浮加号按钮（QuickAddFloatButton）在移动端不再单独渲染，这个按钮就是它
// 在移动端导航栏里的等价入口。
function CenterAddButton() {
  const navigate = useNavigate();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const { vehicles, modalType, vehicleId, setVehicleId, openModal, closeModal, onSuccess } = useQuickAddRecord();

  return (
    <>
      <Popover
        open={vehicles.length > 0 && flyoutOpen}
        onOpenChange={(next) => {
          if (vehicles.length === 0) {
            navigate("/");
            return;
          }
          setFlyoutOpen(next);
        }}
        trigger="click"
        placement="top"
        content={
          <Space direction="vertical" size={2} style={{ minWidth: 148 }}>
            <Button
              type="text"
              icon={<ToolOutlined style={{ color: RECORD_THEME.maintenance.color }} />}
              onClick={() => {
                setFlyoutOpen(false);
                openModal("maintenance");
              }}
              style={{ width: "100%", textAlign: "left" }}
            >
              添加保养记录
            </Button>
            <Button
              type="text"
              icon={<ThunderboltOutlined style={{ color: RECORD_THEME.fuel.color }} />}
              onClick={() => {
                setFlyoutOpen(false);
                openModal("fuel");
              }}
              style={{ width: "100%", textAlign: "left" }}
            >
              添加油耗记录
            </Button>
          </Space>
        }
      >
        <button
          type="button"
          aria-label="添加记录"
          style={{
            width: 56,
            height: 56,
            marginTop: -28,
            borderRadius: "50%",
            border: `3px solid ${SURFACE.card}`,
            background: `linear-gradient(135deg, ${RECORD_THEME.maintenance.color} 0 50%, ${RECORD_THEME.fuel.color} 50% 100%)`,
            boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          <PlusOutlined />
        </button>
      </Popover>

      {modalType && (
        <RecordFormModal
          open={Boolean(modalType)}
          type={modalType}
          vehicles={vehicles}
          vehicleId={vehicleId}
          onVehicleChange={setVehicleId}
          onClose={closeModal}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}

function TabItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        color: active ? BRAND.primary : "#8a8f99",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
      }}
    >
      <span style={{ fontSize: 19 }}>{icon}</span>
      {label}
    </Link>
  );
}

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
            background: isMobile ? "rgba(255,255,255,0.85)" : SURFACE.card,
            backdropFilter: isMobile ? "saturate(180%) blur(20px)" : undefined,
            WebkitBackdropFilter: isMobile ? "saturate(180%) blur(20px)" : undefined,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px",
            borderBottom: isMobile ? `1px solid ${SURFACE.border}` : undefined,
            boxShadow: isMobile ? undefined : "0 1px 4px rgba(0,0,0,0.06)",
            position: isMobile ? "sticky" : undefined,
            top: isMobile ? 0 : undefined,
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
        {/* 移动端底部导航栏固定在视口底部（而不是像之前那样紧跟在页面内容后面），
            之前"首页"入口在内容最下面，进详情页之后要滚动很久才能找到，现在
            任何时候都能一眼看到、一点就到。paddingBottom 给 Content 留出被这条
            固定栏挡住的空间，避免内容最后一部分被盖住点不到。 */}
        <Content style={{ padding: 20, paddingBottom: isMobile ? 76 : 20, background: SURFACE.page }}>
          <Outlet />
        </Content>
        {isMobile && (
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 20,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              height: 56,
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "saturate(180%) blur(20px)",
              WebkitBackdropFilter: "saturate(180%) blur(20px)",
              borderTop: `1px solid ${SURFACE.border}`,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <TabItem to="/" icon={<DashboardOutlined />} label="首页" active={location.pathname === "/"} />
            <CenterAddButton />
            <TabItem
              to="/settings"
              icon={<SettingOutlined />}
              label="设置"
              active={location.pathname === "/settings"}
            />
          </div>
        )}
      </AntLayout>
      {!isMobile && <QuickAddFloatButton />}
      <InstallPrompt />
      <OfflineBanner />
    </AntLayout>
  );
}
