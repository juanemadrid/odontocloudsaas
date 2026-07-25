// src/components/RecentActivity.jsx
import React from "react";

export default function RecentActivity({ items = [] }) {
  return (
    <div className="card activity-card">
      <h4>Actividad reciente</h4>
      <ul className="activity-list">
        {items.map((it) => (
          <li key={it.id}>
            <strong>{it.title}</strong>
            <div className="time">{it.time}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
 
