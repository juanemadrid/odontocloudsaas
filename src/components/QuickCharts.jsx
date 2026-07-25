// ===============================
// 📈 QuickCharts.jsx
// Gráfico "Pacientes · Última semana"
// ===============================
import React from "react";
import "../styles/dashboard.css";

export default function QuickCharts({ data = [], locale = "es" }) {
  // Si no hay data o todo es cero → mostramos mensaje
  const hasValues =
    Array.isArray(data) && data.some((d) => typeof d.value === "number" && d.value > 0);

  if (!data || data.length === 0) {
    return <div className="chart-empty">Sin datos de la última semana.</div>;
  }

  // Configuración del SVG
  const width = 100;
  const height = 40;
  const paddingX = 6;
  const paddingY = 6;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const stepX = (width - paddingX * 2) / Math.max(data.length - 1, 1);

  const points = data.map((point, index) => {
    const x = paddingX + stepX * index;
    const y =
      height - paddingY - (point.value / maxValue) * (height - paddingY * 2);
    return { x, y, ...point };
  });

  const pathD =
    points.length > 0
      ? points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" ")
      : "";

  return (
    <div className="oc-line-chart">
      {!hasValues && (
        <div className="chart-no-values">
          Sin pacientes registrados en la última semana.
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Líneas de guía */}
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="chart-axis"
        />
        <line
          x1={paddingX}
          y1={paddingY}
          x2={paddingX}
          y2={height - paddingY}
          className="chart-axis"
        />

        {/* Línea de datos */}
        {pathD && (
          <path
            d={pathD}
            className={hasValues ? "chart-line" : "chart-line chart-line-flat"}
          />
        )}

        {/* Puntos */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={1.2} className="chart-point" />
            <title>
              {p.label} · {p.value} pacientes
            </title>
          </g>
        ))}
      </svg>

      {/* Etiquetas de días abajo */}
      <div className="chart-labels">
        {points.map((p, idx) => (
          <span key={idx} className="chart-label">
            {p.shortLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
