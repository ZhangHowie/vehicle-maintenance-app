import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Empty, Tag, Spin, Typography } from "antd";
import { PlusOutlined, CarOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fuelTypeLabel } from "../constants";
import Dashboard from "../components/Dashboard";
import { onRecordsUpdated } from "../events";
import { BRAND } from "../theme";

interface Vehicle {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  plateNo?: string;
  coverImageUrl?: string;
  defaultFuelType: string;
}

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api
      .get("/vehicles")
      .then((res) => setVehicles(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    return onRecordsUpdated(load);
  }, []);

  if (loading) return <Spin />;

  return (
    <div>
      <Dashboard />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的车辆
        </Typography.Title>
        <Link to="/vehicles/new">
          <Button type="primary" icon={<PlusOutlined />} style={{ background: BRAND.primary }}>
            添加车辆
          </Button>
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: "center", padding: "24px 0" }}>
          <Empty
            image={<CarOutlined style={{ fontSize: 56, color: "#c8d6e8" }} />}
            description={
              <span style={{ color: "#888" }}>
                还没有车辆，添加第一辆开始记录保养和加油
              </span>
            }
          >
            <Link to="/vehicles/new">
              <Button type="primary" icon={<PlusOutlined />} style={{ background: BRAND.primary }}>
                添加车辆
              </Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {vehicles.map((v) => (
            <Col xs={24} sm={12} md={8} lg={6} key={v.id}>
              <Link to={`/vehicles/${v.id}`}>
                <Card
                  hoverable
                  style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                  styles={{ body: { padding: 16 } }}
                  cover={
                    v.coverImageUrl ? (
                      <div style={{ aspectRatio: "16 / 9", overflow: "hidden" }}>
                        <img
                          src={v.coverImageUrl}
                          alt={v.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          aspectRatio: "16 / 9",
                          background: "linear-gradient(135deg, #e6f0ff 0%, #f5f6f8 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CarOutlined style={{ fontSize: 40, color: "#a0c4ff" }} />
                      </div>
                    )
                  }
                >
                  <Card.Meta
                    title={v.name}
                    description={
                      <>
                        <div style={{ color: "#666" }}>{[v.brand, v.model].filter(Boolean).join(" ") || "-"}</div>
                        <div style={{ color: "#999", fontSize: 12 }}>{v.plateNo}</div>
                        <Tag color="blue" style={{ marginTop: 8 }}>
                          {fuelTypeLabel(v.defaultFuelType)}
                        </Tag>
                      </>
                    }
                  />
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
