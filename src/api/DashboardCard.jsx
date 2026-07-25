// src/components/shared/DashboardCard.jsx
import React from "react";

export default function DashboardCard({ title, value, subtitle }) {
  return (
    <div className="card stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-sub">{subtitle}</div>}
    </div>
  );
}
