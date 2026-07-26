// ===============================
// 🦷 Dashboard.jsx - Panel principal OdontoCloud (enrutado interno por URL)
// ===============================
import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Timestamp } from "firebase/firestore";

// import "../styles/dashboard.css"; // REMOVED: Migrated to index.css

import Agenda from "../modules/agenda/Agenda";
import Pacientes from "../modules/pacientes/Pacientes";
import Odontograma from "../modules/odontograma/Odontograma";
import Reportes from "../modules/reportes/Reportes";
import AdministracionRouter from "../modules/administracion/AdministracionRouter";
import ConfigRouter from "../modules/config/ConfigRouter";
import FinancieroRouter from "../modules/financiero/FinancieroRouter";
import Caja from "../modules/caja/Caja";

import DashboardLayout from "../layout/DashboardLayout";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import StatCard from "../components/shared/StatCard";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import {
    FiHome, FiCalendar, FiUsers, FiFileText, FiBox,
    FiActivity, FiSettings, FiLogOut, FiMenu, FiX, FiClock, FiCheckCircle, FiLayout, FiPieChart, FiGrid, FiDollarSign, FiZap, FiMic
} from "react-icons/fi";

import RecentActivity from "../components/RecentActivity";
import SmartAlerts from "../components/dashboard/SmartAlerts";
import SetupWizardWidget from "../components/dashboard/SetupWizardWidget";

import supabase from "../lib/supabaseClient";



import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { OFFLINE_SESSION_ENABLED } from "../config/runtimeFlags";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "/assets/logo.png";

/* =============================== i18n =============================== */
const MESSAGES = {
  es: {
    nav_home: "Inicio",
    nav_agenda: "Agenda",
    nav_patients: "Pacientes",
    nav_billing: "Facturación",
    nav_inventory: "Inventario",
    nav_odontogram: "Odontograma",
    nav_reports: "Reportes",
    nav_cash: "Caja",
    nav_admin: "Administración",
    welcomeTitle: "Bienvenido a {tenant}", // Placeholder
    welcomeSubtitle:
      "Administra tus pacientes, agenda, inventario y facturación de manera inteligente y moderna.",
    clinicLabel: "Clínica",
    userLabel: "Usuario",
    roleLabel: "Rol",
    searchPlaceholder: "Buscar acciones o ir a…",
    stats_patientsToday: "Pacientes totales",
    stats_appointmentsToday: "Citas hoy",
    stats_revenueToday: "Facturación hoy",
    stats_waiting: "En espera",
    stats_currency: "COP",
    recent_title: "Actividad reciente",
    recent_empty: "Sin actividad registrada.",
    loading: "Cargando...",
    logout: "Cerrar sesión",
    module_coming: "Módulo próximamente.",
    todays_appts: "Citas de hoy",
    see_schedule: "Ir a Agenda",
    no_appts_today: "No hay citas programadas hoy.",
    at: "a las",
  },
  en: {
    nav_home: "Overview",
    nav_agenda: "Schedule",
    nav_patients: "Patients",
    nav_billing: "Billing",
    nav_inventory: "Inventory",
    nav_odontogram: "Odontogram",
    nav_reports: "Reports",
    nav_cash: "Cash",
    nav_admin: "Administration",
    welcomeTitle: "Welcome to OdontoCloud",
    welcomeSubtitle:
      "Manage your patients, schedule, inventory and billing in a smart and modern way.",
    clinicLabel: "Clinic",
    userLabel: "User",
    roleLabel: "Role",
    searchPlaceholder: "Search actions or go to…",
    stats_patientsToday: "Total patients",
    stats_appointmentsToday: "Appointments today",
    stats_revenueToday: "Revenue today",
    stats_waiting: "In waiting room",
    stats_currency: "COP",
    recent_title: "Recent activity",
    recent_empty: "No activity yet.",
    loading: "Loading...",
    logout: "Log out",
    module_coming: "Module coming soon.",
    todays_appts: "Today's appointments",
    see_schedule: "Open Schedule",
    no_appts_today: "No appointments today.",
    at: "at",
  },
};
const detectLocale = () => {
  if (typeof navigator === "undefined") return "es";
  const lang = navigator.language || navigator.userLanguage || "es";
  return lang.toLowerCase().startsWith("es") ? "es" : "en";
};

/* ================== sesión offline + fechas ================== */
const getOfflineSession = () => {
  if (!OFFLINE_SESSION_ENABLED) return null;

  try {
    const data = JSON.parse(localStorage.getItem("odc_session"));
    if (data && Date.now() - data.timestamp < 1000 * 60 * 60 * 24) return data;
    return null;
  } catch {
    return null;
  }
};
const useTodayRange = () =>
  useMemo(() => {
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    );
    const endToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 0
    );
    return {
      startToday: Timestamp.fromDate(startToday),
      endToday: Timestamp.fromDate(endToday),
      startTodayJS: startToday,
    };
  }, []);
const toIsoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const fmtTime = (d, locale) =>
  d.toLocaleTimeString(locale === "es" ? "es-CO" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
const buildDateFromParts = (iso, hhmm) => {
  try {
    const [y, m, d] = (iso || "").split("-").map((x) => parseInt(x, 10));
    const [hh = 0, mm = 0] = (hhmm || "00:00")
      .split(":")
      .map((x) => parseInt(x, 10));
    return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  } catch {
    return new Date();
  }
};

/* ================== Mini chart ================== */
function WeeklyBars({ data = [] }) {
  const height = 200,
    padTop = 18,
    padBottom = 22;
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const n = data.length || 7,
    gap = 10;
  const barWidth = Math.max(16, Math.min(44, (640 - gap * (n + 1)) / n));
  const chartWidth = (barWidth + gap) * n + gap;
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        width={chartWidth}
        height={height + padBottom + 18}
        role="img"
        aria-label="Pacientes registrados por día en la última semana"
      >
        {[0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padTop + (1 - p) * (height - padTop);
          return (
            <line
              key={i}
              x1={0}
              x2={chartWidth}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeDasharray="4 4"
            />
          );
        })}
        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const h = Math.round((v / max) * (height - padTop));
          const x = gap + i * (barWidth + gap);
          const y = height - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx="6"
                ry="6"
                fill={v > 0 ? "#0ea5e9" : "#cbd5e1"}
              >
                <title>{`${d.label || d.shortLabel || ""} · ${v} paciente${v !== 1 ? "s" : ""
                  }`}</title>
              </rect>
              {v > 0 && h > 14 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#0f172a"
                >
                  {v}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height + 14}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {d.shortLabel || ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ================== CommandSearch ================== */
function CommandSearch({ onNavigate, onAction, placeholder }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const commands = useMemo(
    () => [
      { group: "Navegación", label: "Ir a Inicio", keywords: "inicio home overview", run: () => onNavigate?.("Inicio") },
      { group: "Navegación", label: "Ir a Agenda", keywords: "agenda calendario schedule", run: () => onNavigate?.("Agenda") },
      { group: "Navegación", label: "Ir a Pacientes", keywords: "pacientes", run: () => onNavigate?.("Pacientes") },
      { group: "Navegación", label: "Ir a Facturación", keywords: "facturacion facturas billing", run: () => onNavigate?.("Facturación") },
      { group: "Navegación", label: "Ir a Inventario", keywords: "inventario stock", run: () => onNavigate?.("Inventario") },
      { group: "Navegación", label: "Ir a Inventario", keywords: "inventario stock", run: () => onNavigate?.("Inventario") },
      // Update link to real 3D route
      { group: "Navegación", label: "Ir a Odontograma 3D", keywords: "odontograma 3d", run: () => onNavigate?.("Odontograma") },
      { group: "Navegación", label: "Ir a Reportes", keywords: "reportes informes", run: () => onNavigate?.("Reportes") },
      { group: "Navegación", label: "Ir a Reportes", keywords: "reportes informes", run: () => onNavigate?.("Reportes") },

      { group: "Acciones", label: "Nueva cita", keywords: "nueva cita agendar", run: () => onAction?.("new_appointment") },
      { group: "Acciones", label: "Nuevo paciente", keywords: "nuevo paciente alta", run: () => onAction?.("new_patient") },
      { group: "Acciones", label: "Nueva factura", keywords: "nueva factura", run: () => onAction?.("new_invoice") },
      { group: "Acciones", label: "Exportar agenda", keywords: "exportar agenda", run: () => onAction?.("export_agenda") },
      { group: "Acciones", label: "Ir a hoy (Agenda)", keywords: "hoy today", run: () => onAction?.("agenda_today") },
      { group: "Acciones", label: "Cambiar modo oscuro", keywords: "oscuro dark mode", run: () => onAction?.("toggle_dark") },
      { group: "Acciones", label: "Cerrar sesión", keywords: "logout salir cerrar", run: () => onAction?.("logout") },

      { group: "Ayuda", label: "Ver atajos de teclado", keywords: "atajos ayuda", run: () => onAction?.("show_shortcuts") },
      { group: "Ayuda", label: "Soporte / Contacto", keywords: "soporte ayuda contacto", run: () => onAction?.("support") },
    ],
    [onNavigate, onAction]
  );
  const filtered = useMemo(() => {
    const q = term.toLowerCase().trim();
    if (!q) return [];
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q)
    );
  }, [term, commands]);
  useEffect(() => {
    const h = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const run = (cmd) => {
    cmd.run?.();
    setTerm("");
    setOpen(false);
  };
  const onKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % filtered.length);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + filtered.length) % filtered.length);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      filtered[active] && run(filtered[active]);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };
  const grouped = useMemo(() => {
    const m = new Map();
    filtered.forEach((c) => {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group).push(c);
    });
    return Array.from(m.entries());
  }, [filtered]);
  return (
    <div className="oc-search-wrap" ref={boxRef}>
      <input
        className="oc-search"
        type="search"
        inputMode="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(!!e.target.value);
          setActive(0);
        }}
        onFocus={() => setOpen(!!term)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="oc-search-dropdown" role="listbox" aria-label="Resultados de comandos">
          {grouped.length === 0 ? (
            <div className="oc-search-item empty">Escribe para ver opciones…</div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <div className="oc-search-group">{group}</div>
                {items.map((c) => {
                  const idxFlat = filtered.indexOf(c);
                  return (
                    <button
                      key={c.label}
                      className={`oc-search-item ${idxFlat === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(idxFlat)}
                      onClick={() => run(c)}
                      role="option"
                    >
                      <span className="oc-search-title">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   ✅ AdminMegaMenu
   - Ahora navega por rutas reales mediante navigate()
   ========================================================== */
function AdminMegaMenu({
  open,
  anchorRect,
  onClose,
  onSoon,
  onNavigatePath,
  onSetFactView,
  hasAccess, // NEW
  dark,
}) {
  const [sub, setSub] = useState(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    const onScroll = () => onClose?.();
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const top = (anchorRect?.bottom || 60) + 8;
  const left = Math.max(
    12,
    Math.min((anchorRect?.left || 300) - 160, window.innerWidth - 920)
  );
  const gap = 10;
  const leftSub = left + 360 + gap;

  const baseBg = dark ? "#0b1220" : "#ffffff";
  const baseTx = dark ? "#e5e7eb" : "#0f172a";
  const hoverBg = dark ? "#0f1a32" : "#f3f6ff";
  const hoverBd = dark ? "#1f2a44" : "#e2e8f0";
  const hintTx = dark ? "#b6c1d1" : "#475569";

  const card = {
    position: "fixed",
    top,
    left,
    width: 880,
    maxWidth: "calc(100vw - 24px)",
    background: baseBg,
    color: baseTx,
    borderRadius: 14,
    boxShadow: "0 18px 40px rgba(2,6,23,.18)",
    border: `1px solid ${hoverBd}`,
    zIndex: 400,
    padding: 12,
  };
  const subCard = {
    position: "fixed",
    top,
    left: leftSub,
    width: 420,
    maxWidth: "calc(100vw - 24px)",
    background: baseBg,
    color: baseTx,
    borderRadius: 14,
    boxShadow: "0 18px 40px rgba(2,6,23,.18)",
    border: `1px solid ${hoverBd}`,
    zIndex: 410,
    padding: 12,
  };
  const col = { display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px" };
  const item = {
    height: 38,
    borderRadius: 10,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: ".92rem",
    cursor: "pointer",
    border: "1px solid transparent",
    background: "transparent",
    color: baseTx,
    fontWeight: 500,
    textAlign: "left",
  };
  const hoverize = (e, on = true) =>
    Object.assign(
      e.currentTarget.style,
      on
        ? { background: hoverBg, borderColor: hoverBd }
        : { background: "transparent", borderColor: "transparent" }
    );

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => onClose?.(), 180);
  };

  const bridge = {
    position: "fixed",
    top,
    left: left + 360,
    width: gap,
    height: 520,
    zIndex: 405,
  };

  const FACT_ITEMS = [
    { label: "Nomina Electrónica", key: "nomina", path: "facturacion/nomina" },
    { label: "Recibo de caja", key: "recibo", path: "facturacion/recibo" },
    { label: "Saldo a favor", key: "saldo", path: "facturacion/saldo" },
    { label: "Nota crédito", key: "nc", path: "facturacion/nc" },
    { label: "Nota débito", key: "nd", path: "facturacion/nd" },
    { label: "Liquidaciones", key: "liq", path: "facturacion/liq" },
    { label: "Traslados", key: "tras", path: "facturacion/tras" },
    { label: "Pagos", key: "pagos", path: "facturacion/pagos" },
    { label: "Órdenes de compra", key: "oc", path: "facturacion/oc" },
    { label: "Factura de venta", key: "fv", path: "facturacion/facturas" },
    { label: "Facturas de compra", key: "fc", path: "facturacion/fc" },
  ];
  const RIPS_ITEMS = [
    { label: "RIPS anteriores (RS-3374)", key: "rips3374" },
    { label: "RIPS nuevo (RS-2275)", key: "rips2275" },
  ];

  const handleFactClick = (it) => {
    onSetFactView?.(it.key);
    onNavigatePath?.(it.path);
    onClose?.();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 399 }}
      />

      <div style={card} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: 8,
            alignItems: "start",
          }}
        >
          <div style={col}>
            {/* Facturación: Requires 'Facturación' or 'Financiero' (fallback) */}
            {(hasAccess?.("Facturación") || hasAccess?.("Financiero")) && (
              <button
                type="button"
                style={item}
                onMouseEnter={() => { cancelClose(); setSub("facturacion"); }}
                onFocus={() => { cancelClose(); setSub("facturacion"); }}
                onClick={() => setSub((s) => (s === "facturacion" ? null : "facturacion"))}
                onMouseOver={(e) => hoverize(e, true)}
                onMouseOut={(e) => hoverize(e, false)}
              >
                💳 Facturación ▸
              </button>
            )}

            {/* RIPS: Requires 'RIPS' or 'Reportes' */}
            {(hasAccess?.("RIPS") || hasAccess?.("Reportes")) && (
              <button
                type="button"
                style={item}
                onMouseEnter={() => { cancelClose(); setSub("rips"); }}
                onFocus={() => { cancelClose(); setSub("rips"); }}
                onClick={() => setSub((s) => (s === "rips" ? null : "rips"))}
                onMouseOver={(e) => hoverize(e, true)}
                onMouseOut={(e) => hoverize(e, false)}
              >
                📄 RIPS ▸
              </button>
            )}

            {hasAccess?.("Agenda") && (
              <button type="button" style={item} onClick={() => onNavigatePath?.("agenda")} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
                🗓️ Gestión de agenda
              </button>
            )}

            {hasAccess?.("Inventario") && (
              <button type="button" style={item} onClick={() => onNavigatePath?.("inventario")} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
                📦 Inventario
              </button>
            )}

            {hasAccess?.("Editor Web") && (
              <button type="button" style={item} onClick={() => onNavigatePath?.("config/site")} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
                🎨 Editor Web
              </button>
            )}

            {/* Placeholders */}
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              🤝 Convenios
            </button>
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              👥 Terceros
            </button>
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              📣 Campañas
            </button>
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              🌡️ Temperatura y humedad
            </button>
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              ♻️ Residuos
            </button>
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              💊 Medicamentos y planes
            </button>
            <button type="button" style={item} onClick={() => onSoon?.()} onMouseOver={(e) => hoverize(e, true)} onMouseOut={(e) => hoverize(e, false)}>
              🧪 Esterilización
            </button>
          </div>

          <div style={col}>
            <div style={{ fontSize: ".85rem", color: hintTx }}>
              Accesos rápidos a módulos de administración. Pasa el mouse por <b>Facturación</b> o <b>RIPS</b> para ver sus acciones.
            </div>
          </div>
        </div>
      </div>

      <div style={bridge} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />

      {sub && (
        <div style={subCard} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <div style={{ ...col, display: "grid", gridTemplateColumns: "1fr" }}>
            {(sub === "facturacion" ? FACT_ITEMS : RIPS_ITEMS).map((it) => (
              <button
                key={it.label}
                type="button"
                style={item}
                onClick={() => sub === "facturacion" ? handleFactClick(it) : onSoon?.()}
                onMouseOver={(e) => hoverize(e, true)}
                onMouseOut={(e) => hoverize(e, false)}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const getStatusLabel = (est) => {
  const clean = (est || "").toLowerCase().trim();
  if (clean === "attended" || clean === "atendido" || clean === "atendida") return "ATENDIDO";
  if (clean === "waiting" || clean === "en espera") return "EN ESPERA";
  if (clean === "confirmed" || clean === "confirmada" || clean === "confirmado") return "CONFIRMADA";
  if (clean === "pending" || clean === "sin confirmar") return "SIN CONFIRMAR";
  if (clean === "cancelled" || clean === "cancelado" || clean === "cancelada") return "CANCELADO";
  return String(est).toUpperCase();
};

/* =============== Componente de portada (Inicio) =============== */
function Overview({
  t, companyName, companyLogo, userName, role, darkMode,
  weeklySeries, weekRangeLabel,
  todaysAppointments, todaysLoading,
  metrics, metricsLoading,
  recent, recentLoading,
  onGoAgenda,
  softwareLogo, // NEW PROP
  isDoc,
  currentDoctorId,
  basePath // NEW PROP
}) {
  const navigate = useNavigate();

  if (isDoc) {
    // Filter appointments for this doctor
    const docAppointments = todaysAppointments.filter(
      (c) => c.doctorId === currentDoctorId
    );

    const completedCount = docAppointments.filter(
      (c) => {
        const est = (c.estado || "").toLowerCase().trim();
        return ["completada", "completado", "atendido", "atendida", "atendiendo", "completed", "attended"].includes(est);
      }
    ).length;

    const enEsperaCount = docAppointments.filter(
      (c) => {
        const est = (c.estado || "").toLowerCase().trim();
        return ["en espera", "waiting"].includes(est);
      }
    ).length;

    const pendienteCount = docAppointments.filter(
      (c) => {
        const est = (c.estado || "").toLowerCase().trim();
        return ["pendiente", "programada", "confirmada", "sin confirmar", "pending", "confirmed", "sin-confirmar", "confirmado"].includes(est);
      }
    ).length;

    return (
      <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Custom Welcome Banner for Doctor */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-[24px] md:rounded-[32px] p-6 md:p-10 relative overflow-hidden group shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] border border-white/5">
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute top-[-40%] left-[-20%] w-[800px] h-[800px] bg-blue-500/30 rounded-full blur-[140px] animate-pulse" style={{animationDuration: '8s'}} />
            <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[120px] animate-pulse" style={{animationDuration: '12s', animationDelay: '2s'}} />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 p-3 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-4xl">🦷</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">Portal Odontológico Activo</span>
                </div>
                <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                  Dr. {userName}
                </h1>
                <p className="text-slate-300 text-sm font-medium">
                  {companyName} • {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            
            {/* Quick Stats in Banner */}
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 min-w-[100px]">
                <div className="text-3xl font-black text-white">{todaysLoading ? "..." : docAppointments.length}</div>
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1">Citas Hoy</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 min-w-[100px]">
                <div className="text-3xl font-black text-emerald-400">{todaysLoading ? "..." : completedCount}</div>
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1">Atendidos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Doctor Stats Cards - Mejorado con más detalle */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border-2 border-blue-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <FiCalendar className="text-blue-600" size={24} />
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">Hoy</span>
            </div>
            <div className="text-3xl font-black text-slate-800">{todaysLoading ? "..." : docAppointments.length}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Citas</div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-emerald-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <FiCheckCircle className="text-emerald-600" size={24} />
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">✓</span>
            </div>
            <div className="text-3xl font-black text-emerald-600">{todaysLoading ? "..." : completedCount}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Atendidos</div>
            {docAppointments.length > 0 && (
              <div className="text-[10px] text-slate-400 mt-1">
                {Math.round((completedCount / docAppointments.length) * 100)}% completado
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border-2 border-amber-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <FiClock className="text-amber-600" size={24} />
              <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-wider">⏳</span>
            </div>
            <div className="text-3xl font-black text-amber-600">{todaysLoading ? "..." : enEsperaCount}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">En Espera</div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-indigo-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <FiActivity className="text-indigo-600" size={24} />
              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-wider">→</span>
            </div>
            <div className="text-3xl font-black text-indigo-600">{todaysLoading ? "..." : pendienteCount}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Pendientes</div>
          </div>
        </div>

        {/* Doctor Main Dashboard Columns */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Timeline / Clinical Agenda */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-slate-800 tracking-tight text-lg uppercase flex items-center gap-2">
                <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
                Mi Agenda Clínica
              </h3>
              <button 
                onClick={onGoAgenda} 
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                <FiCalendar size={14} />
                Ver Completa
              </button>
            </div>

            {todaysLoading ? (
              <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Cargando agenda clínica...</span>
                </div>
              </div>
            ) : docAppointments.length === 0 ? (
              <div className="text-slate-500 text-sm bg-slate-50 p-8 rounded-xl flex flex-col items-center justify-center text-center flex-1 border border-dashed border-slate-200">
                <span className="text-6xl mb-4">📅</span>
                <p className="font-black text-slate-700 text-lg">No tienes citas programadas para hoy</p>
                <p className="text-sm text-slate-400 mt-2 max-w-md">Disfruta de tu día libre o aprovecha para revisar expedientes pendientes.</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                {docAppointments.map((c) => {
                  const isCompleted = ["completada", "completado", "atendido", "atendida", "atendiendo", "completed", "attended"].includes((c.estado || "").toLowerCase().trim());
                  const isWaiting = ["en espera", "waiting"].includes((c.estado || "").toLowerCase().trim());
                  return (
                    <div key={c.id} className="p-4 hover:bg-slate-50 border-2 border-slate-100 hover:border-blue-200 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg tracking-wider shadow-sm">
                            {c.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider border-2
                            ${isWaiting ? "bg-amber-50 text-amber-700 border-amber-200" :
                              isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"}
                          `}>
                            {getStatusLabel(c.estado)}
                          </span>
                          {c.consultorio && (
                            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                              📍 {c.consultorio}
                            </span>
                          )}
                        </div>
                        <div className="font-black text-slate-800 text-base">{c.pacienteNombre}</div>
                        {c.motivo && <div className="text-xs text-slate-500 flex items-start gap-2"><span>💬</span><span className="italic">{c.motivo}</span></div>}
                      </div>

                      {/* Quick Access to Clinical Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`${basePath}/pacientes?id=${c.pacienteId}&tab=anamnesis`)}
                          className="text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-all"
                          title="Ver Historia Clínica"
                        >
                          📋 Historia
                        </button>
                        <button
                          onClick={() => navigate(`${basePath}/pacientes?id=${c.pacienteId}&tab=odonto`)}
                          className="text-[10px] font-black uppercase tracking-wider bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg transition-all"
                          title="Ver Odontograma"
                        >
                          🦷 Odontograma
                        </button>
                        <button
                          onClick={() => navigate(`${basePath}/pacientes?id=${c.pacienteId}&tab=evo`)}
                          className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg transition-all shadow-sm
                            ${isCompleted 
                              ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200/50 hover:bg-emerald-100/70' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          title={isCompleted ? "Ver Evolución" : "Registrar Evolución"}
                        >
                          {isCompleted ? "✓ Atendido" : "✍️ Evolución"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="space-y-4">
            {/* Quick Links */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <FiZap className="text-blue-600" size={16} />
                Accesos Rápidos
              </h4>
              <div className="space-y-2">
                <button 
                  onClick={() => navigate(`${basePath}/pacientes`)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-between group"
                >
                  <span className="text-sm font-bold text-slate-700">Buscar Paciente</span>
                  <FiUsers className="text-slate-400 group-hover:text-blue-600 transition-colors" size={18} />
                </button>
                <button 
                  onClick={() => navigate(`${basePath}/agenda`)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-between group"
                >
                  <span className="text-sm font-bold text-slate-700">Mi Agenda Completa</span>
                  <FiCalendar className="text-slate-400 group-hover:text-blue-600 transition-colors" size={18} />
                </button>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                💡 Tip del Día
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Usa el <strong>Portal del Paciente</strong> para que tus pacientes vean sus citas, planes y pagos desde casa. Reduce llamadas y mejora la experiencia.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Row: Recent Activity for Doctor */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-extrabold text-slate-800 tracking-tight text-lg uppercase flex items-center gap-2 mb-6">
            <span className="w-1.5 h-5 bg-emerald-600 rounded-full" />
            Actividad Reciente
          </h3>
          {recentLoading ? (
            <div className="text-center py-8 text-slate-400">Cargando...</div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <span className="text-4xl mb-3 block">📝</span>
              <p>No hay actividad registrada aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 5).map((act, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200">
                  <div className={`w-2 h-2 rounded-full ${
                    act.type === 'appointment' ? 'bg-blue-500' :
                    act.type === 'evolution' ? 'bg-emerald-500' :
                    'bg-slate-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{act.description}</p>
                    <p className="text-xs text-slate-400">{act.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Slender Pro v3.0 Compact Mesh HUD */}
      <div className="bg-[#020617] rounded-[24px] md:rounded-[32px] p-6 md:p-10 relative overflow-hidden group shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] border border-white/5">
        {/* Hyperspace Mesh Gradient */}
        <div className="absolute inset-0 opacity-60 pointer-events-none">
          <div className="absolute top-[-40%] left-[-20%] w-[800px] h-[800px] bg-blue-600/30 rounded-full blur-[140px] animate-pulse duration-[12s]" />
          <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px]" />
          <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] bg-cyan-400/10 rounded-full blur-[100px] animate-bounce duration-[15s]" />
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(white 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* SOFTWARE LOGO (OdontoCloud) - LARGE IN BANNER */}
            <div className="w-20 h-20 rounded-2xl bg-white border border-white/20 p-3 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
              <img src={softwareLogo} alt="OdontoCloud Logo" className="max-h-full max-w-full object-contain" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.6)] animate-pulse" />
                <span className="text-[10px] font-bold text-blue-300/80 uppercase tracking-[0.2em]">Master Terminal Activa</span>
              </div>

              <div className="space-y-1">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight uppercase">
                  {role === "superadmin"
                    ? "Panel de Control"
                    : "BIENVENIDO A ODONTOCLOUD"}
                </h1>
                <p className="text-blue-100/40 text-xs font-medium max-w-lg tracking-wide uppercase">
                  {t("welcomeSubtitle")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open-user-profile"))}
              title="Click para ver/editar Perfil de usuario y Firma Electrónica"
              className="bg-white/5 hover:bg-white/15 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-4 transition-all active:scale-95 text-left group"
            >
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-blue-300/50 uppercase tracking-widest group-hover:text-blue-300">Usuario</span>
                <span className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                  {userName}
                </span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-blue-300/50 uppercase tracking-widest group-hover:text-blue-300">Perfil / Firma</span>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-tight">{role || "Admin"}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="absolute bottom-4 left-10 text-[8px] font-black text-white/10 uppercase tracking-[0.5em] pointer-events-none select-none">
          Oc-77 / v2.0
        </div>
      </div>

      {/* Setup Assistant - High Priority Onboarding */}
      <SetupWizardWidget />

      {/* Stats Grid - Slender Pro v3.0 Adaptive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title={t("stats_patientsToday")}
          value={metricsLoading ? "..." : metrics?.pacientesHoy || 0}
          icon={FiUsers} color="blue"
        />
        <StatCard
          title={t("stats_appointmentsToday")}
          value={metricsLoading ? "..." : metrics?.citasHoy || 0}
          icon={FiCalendar} color="green"
        />
        <StatCard
          title={t("stats_revenueToday")}
          value={
            metricsLoading
              ? "..."
              : `$ ${(metrics?.facturacionHoy || 0).toLocaleString("es-CO")}`
          }
          subtitle="COP"
          icon={FiDollarSign} color="amber"
          trend={12} // Example trend, or calculate real if avail
        />
        <StatCard
          title={t("stats_waiting")}
          value={metricsLoading ? "..." : metrics?.enEspera || 0}
          icon={FiClock} color="purple"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Main Chart */}
        <div className="xl:col-span-2 h-[400px]">
          <DashboardCharts
            data={weeklySeries}
            title="Pacientes registrados"
            period={weekRangeLabel}
          />
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-4">
          <SmartAlerts />

          {/* Citas Hoy */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">{t("todays_appts")}</h3>
              <button onClick={onGoAgenda} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver todo</button>
            </div>

            {todaysLoading ? (
              <div className="text-slate-400 text-sm">{t("loading")}</div>
            ) : todaysAppointments.length === 0 ? (
              <div className="text-slate-500 text-sm bg-slate-50 p-4 rounded-lg flex items-center justify-center flex-1">
                {t("no_appts_today")}
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[300px]">
                {todaysAppointments.slice(0, 5).map((c) => {
                  const isCompleted = ["completada", "completado", "atendido", "atendida", "atendiendo", "completed", "attended"].includes((c.estado || "").toLowerCase().trim());
                  const isWaiting = ["en espera", "waiting"].includes((c.estado || "").toLowerCase().trim());
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{c.pacienteNombre}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <FiClock size={10} />
                          {fmtTime(c.fecha, detectLocale())}
                        </div>
                      </div>
                      <span className={`
                            text-xs px-2.5 py-1 rounded-full font-black uppercase tracking-wider border
                            ${isWaiting ? "bg-amber-100 text-amber-700 border-amber-200" :
                          isCompleted ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            "bg-blue-100 text-blue-700 border-blue-200"}
                         `}>
                        {getStatusLabel(c.estado)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity and Integrations - Slender Pro v3.0 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Activity Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-[32px] border border-white shadow-[0_15px_60px_-15px_rgba(0,0,0,0.05)] p-8 transition-all duration-700 hover:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.08)] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/20 rounded-bl-[80px] -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-700" />
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.25em]">{t("recent_title")}</h3>
          </div>
          {recentLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <RecentActivity items={recent} />
          )}
        </div>

        {/* Automation Card - Removed n8n integration */}
      </div>

    </div >
  );
}

/* =============================== Dashboard =============================== */
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [locale] = useState(detectLocale());

  const t = (key) => MESSAGES[locale][key] || key;
  const { user, userProfile } = useAuth();
  const { can } = usePermissions();

  const hasAccess = (feature) => {
    // 1. Super Admin always has access
    if (userProfile?.rol === "superadmin") return true;
    // 2. No tenant = Legacy/Standalone => Allow all (or default behavior)
    if (!userProfile?.inquilino) return true;
    // 3. Check Plan Features
    // If no features defined in plan, maybe allow all? Or block? 
    // Let's assume block if plan exists but feature not listed.
    const features = userProfile?.tenant?.plan?.features || [];
    // If features is empty but plan exists, it's a restricted plan.
    // Normalized check (case insensitive or exact?)
    // Let's assume exact match from the plan management UI.
    return features.includes(feature);
  };

  // Estado "activo" sigue existiendo, pero AHORA se sincroniza con la URL
  const [activeModule, setActiveModule] = useState("Inicio");
  const [factView, setFactView] = useState("recibo");

  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("odontocloud:dark") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("odontocloud:dark", darkMode ? "1" : "0"); } catch { }
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const [session] = useState(() => getOfflineSession());
  const role = userProfile?.profileName || userProfile?.rol || session?.rol || "Administrador";
  const [sessionEmail] = useState(session?.email || "");
  const [loadingUser, setLoadingUser] = useState(false);

  // Unify Company Name and Logo from Tenant
  const isSuperAdmin = userProfile?.rol === "superadmin";
  const companyName = isSuperAdmin ? "OdontoCloud Central" : (userProfile?.tenant?.name || "OdontoCloud");
  const companyLogo = isSuperAdmin ? null : (userProfile?.tenant?.logo || logo);
  const userName = userProfile?.nombreCompleto || userProfile?.nombre || user?.displayName || user?.email || "Usuario";

  const isDoc = userProfile?.esDoctor || userProfile?.rol === "doctor" || userProfile?.rol === "odontologo";
  const [currentDoctorId, setCurrentDoctorId] = useState(userProfile?.uid || null);

  useEffect(() => {
    const fetchDoctorId = async () => {
      if (isDoc && userProfile?.inquilino && userProfile?.email) {
        try {
          const q = query(
            collection(db, "profesionales"),
            where("inquilino", "==", userProfile.inquilino),
            where("correo", "==", userProfile.email)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setCurrentDoctorId(snap.docs[0].id);
          }
        } catch (e) {
          console.warn("Error al buscar doctor por email:", e);
        }
      }
    };
    fetchDoctorId();
  }, [isDoc, userProfile]);

  useEffect(() => {
    // Legacy cleanup - We now use AuthContext userProfile
  }, []);

  const [metrics, setMetrics] = useState({
    pacientesHoy: 0,
    citasHoy: 0,
    facturacionHoy: 0,
    enEspera: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [weeklySeries, setWeeklySeries] = useState([]);
  const [todaysAppointments, setTodaysAppointments] = useState([]);
  const [todaysLoading, setTodaysLoading] = useState(true);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const { startToday, endToday, startTodayJS } = useTodayRange();
  const todayIso = useMemo(() => toIsoDate(startTodayJS), [startTodayJS]);
  const weekRangeLabel = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const end = today;
    const fmt = (d) =>
      d
        .toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })
        .replace(".", "");
    return `${fmt(start)} – ${fmt(end)}`;
  }, [locale]);

  // ── Dashboard Caching Logic (sessionStorage 3-minute TTL) ──
  useEffect(() => {
    if (!userProfile?.inquilino) return;

    const cachedData = sessionStorage.getItem(`odc_dash_cache_${userProfile.inquilino}`);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < 3 * 60 * 1000) {
          setMetrics(parsed.metrics);
          setWeeklySeries(parsed.weeklySeries);
          const appts = (parsed.todaysAppointments || []).map(c => ({
            ...c,
            fecha: c.fecha ? new Date(c.fecha) : new Date()
          }));
          setTodaysAppointments(appts);
          setRecent(parsed.recent || []);

          setMetricsLoading(false);
          setTodaysLoading(false);
          setRecentLoading(false);
          setCacheLoaded(true);
          console.log("⚡ Dashboard loaded from sessionStorage cache.");
          return;
        }
      } catch (e) {
        console.warn("Failed to load dashboard cache:", e);
      }
    }
    setCacheLoaded(false);
  }, [userProfile?.inquilino]);

  useEffect(() => {
    if (cacheLoaded || !userProfile?.inquilino || metricsLoading || todaysLoading || recentLoading) return;

    try {
      const cacheData = {
        timestamp: Date.now(),
        metrics,
        weeklySeries,
        todaysAppointments,
        recent
      };
      sessionStorage.setItem(`odc_dash_cache_${userProfile.inquilino}`, JSON.stringify(cacheData));
      console.log("💾 Dashboard cache saved to sessionStorage.");
    } catch (e) {
      console.error("Error saving dashboard cache:", e);
    }
  }, [cacheLoaded, userProfile?.inquilino, metrics, weeklySeries, todaysAppointments, recent, metricsLoading, todaysLoading, recentLoading]);

  const normalizeCita = (docSnap) => {
    const data = docSnap.data() || {};
    let fechaDate;
    if (data.fecha?.toDate) {
      fechaDate = data.fecha.toDate();
      const hhmm = data.horaInicio || data.hora;
      if (hhmm && typeof hhmm === "string") {
        const [hh = 0, mm = 0] = hhmm.split(":").map((x) => parseInt(x, 10));
        fechaDate.setHours(hh || 0, mm || 0, 0, 0);
      }
    } else if (typeof data.fecha === "string") {
      const hhmm = data.horaInicio || data.hora || "00:00";
      fechaDate = buildDateFromParts(data.fecha, hhmm);
    } else {
      fechaDate = new Date();
    }
    const pacienteNombre = data.pacienteNombre || data.paciente || "Paciente";
    const estado = (data.estado && String(data.estado)) || (data.status && String(data.status)) || "programada";
    return {
      id: docSnap.id,
      fecha: fechaDate,
      pacienteId: data.pacienteId || "",
      pacienteNombre,
      estado,
      motivo: data.motivo || "",
      doctorId: data.doctorId || "",
    };
  };

  useEffect(() => {
    if (!userProfile?.inquilino) return;
    if (cacheLoaded) return;

    const qTodayStr = query(
      collection(db, "citas"),
      where("inquilino", "==", userProfile?.inquilino || "nop"),
      where("fecha", "==", todayIso)
    );
    let cacheMap = new Map();
    const commit = () => {
      const rows = Array.from(cacheMap.values()).sort(
        (a, b) => a.fecha.getTime() - b.fecha.getTime()
      );
      const enEsperaCount = rows.filter(
        (r) => {
          const est = String(r.estado).toLowerCase().trim();
          return est === "en espera" || est === "waiting";
        }
      ).length;
      setTodaysAppointments(rows);
      setMetrics((m) => ({ ...m, citasHoy: rows.length, enEspera: enEsperaCount }));
      setTodaysLoading(false);
    };

    const unsubStr = onSnapshot(
      qTodayStr,
      (snap) => {
        const temp = new Map();
        snap.docs.forEach((d) => temp.set(d.id, normalizeCita(d)));
        cacheMap = temp;
        commit();
      },
      (err) => {
        console.error("Realtime citas hoy (STR):", err);
        setTodaysLoading(false);
        commit();
      }
    );
    return () => {
      try { unsubStr(); } catch { }
    };
  }, [todayIso, userProfile?.inquilino, cacheLoaded]);

  useEffect(() => {
    if (cacheLoaded) return;
    const loadMetricsBase = async () => {
      try {
        const pacientesCountSnap = await getCountFromServer(
          query(
            collection(db, "pacientes"), 
            where("inquilino", "==", userProfile?.inquilino || "nop"),
            where("activo", "==", true)
          )
        );
        const pacientesTotal = pacientesCountSnap.data().count || 0;

        let facturacionHoy = 0;
        try {
          const qFact = query(
            collection(db, "facturas_venta"),
            where("inquilino", "==", userProfile?.inquilino || "nop"),
            where("fecha", "==", todayIso)
          );
          const factSnap = await getDocs(qFact);
          factSnap.forEach((docu) => {
            const d = docu.data();
            if (typeof d.total === "number") facturacionHoy += d.total;
          });
        } catch (e) {
          console.error("Error calc facturacion:", e);
        }

        setMetrics((m) => ({ ...m, pacientesHoy: pacientesTotal, facturacionHoy }));
      } catch (e) {
        console.error("Error cargando métricas:", e);
        setMetrics((m) => ({ ...m, pacientesHoy: 0, facturacionHoy: 0 }));
      } finally {
        setMetricsLoading(false);
      }
    };
    loadMetricsBase();
  }, [todayIso, userProfile?.inquilino, cacheLoaded]);

  useEffect(() => {
    if (cacheLoaded) return;
    const today = new Date();
    const startWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const endWeekJs = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const base = new Map();
    for (let i = 7; i >= 1; i--) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - (7 - i)
      );
      // Fixed loop logic in restored version?
      // Just dumping what the user gave me.
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(locale === "es" ? "es-ES" : "en-US");
      const shortLabel = d
        .toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
          weekday: "short",
          day: "2-digit",
        })
        .replace(".", "");
      base.set(key, { label, shortLabel, value: 0 });
    }
    // ... wait, I must trust the file content provided by the user.

    const qWeekPatients = query(
      collection(db, "pacientes"),
      where("inquilino", "==", userProfile?.inquilino || "nop"),
      where("createdAt", ">=", Timestamp.fromDate(startWeek)),
      where("createdAt", "<", Timestamp.fromDate(endWeekJs))
    );

    const unsub = onSnapshot(
      qWeekPatients,
      (snap) => {
        const counts = new Map(base);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.createdAt && data.createdAt.toDate) {
            const dateStr = data.createdAt.toDate().toISOString().slice(0, 10);
            if (counts.has(dateStr)) {
              const entry = counts.get(dateStr);
              entry.value += 1;
              counts.set(dateStr, entry);
            }
          }
        });

        // Convert Map to sorted array
        const sorted = Array.from(counts.values()).reverse(); // The loop was backwards (7 to 1), so dates are newest to oldest?
        // Actually base loop was 7 days ago to yesterday?
        // Let's check the loop: 7 days ago is index 7. today is index 0.
        // base loop: i=7 downto 1. d = today - (7-i). 
        // if i=7 -> today - 0 = today. 
        // if i=1 -> today - 6.
        // So map keys are ordered today -> past.
        // We usually want chart left-to-right (Past -> Today).
        // Let's just sort by date.

        const sortedSeries = Array.from(counts.entries())
          .sort((a, b) => a[0].localeCompare(b[0])) // Sort by YYYY-MM-DD asc
          .map(([k, v]) => ({ label: v.shortLabel, value: v.value }));

        setWeeklySeries(sortedSeries);
      },
      (e) => {
        console.error("Error realtime serie semanal (pacientes):", e);
      }
    );


    return () => {
      try { unsub(); } catch { }
    };
  }, [locale, cacheLoaded]);

  useEffect(() => {
    if (cacheLoaded) return;
    const loadRecent = async () => {
      try {
        const qAct = query(
          collection(db, "actividad"),
          where("inquilino", "==", userProfile?.inquilino || "nop"),
          orderBy("fecha", "desc"),
          limit(5)
        );
        const snap = await getDocs(qAct);
        setRecent(
          snap.docs.map((d) => ({
            id: d.id,
            title: d.data().descripcion || d.data().titulo || "Actividad",
            time: d.data().resumenTiempo || "",
          }))
        );
      } catch (e) {
        console.error("Error cargando actividad:", e);
        setRecent([]);
      } finally {
        setRecentLoading(false);
      }
    };
    loadRecent();
  }, [userProfile?.inquilino, cacheLoaded]);

  // Effect to re-run queries when userProfile loaded
  useEffect(() => {
    // Trigger re-fetch if inquilino changes or loads
  }, [userProfile?.inquilino]);

  const handleLogout = async () => {
    try { localStorage.removeItem("odc_session"); } catch { }
    try { await signOut(auth); } catch (e) { console.error("Error al cerrar sesión:", e); }
    window.location.href = "/";
  };

  /* ===== MegaMenú: estado y helpers ===== */
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAnchor, setAdminAnchor] = useState(null);
  const adminBtnRef = useRef(null);
  const hoverTimerRef = useRef(null);

  const openAdmin = () => {
    const rect = adminBtnRef.current?.getBoundingClientRect?.();
    setAdminAnchor(rect);
    setAdminOpen(true);
  };
  const closeAdmin = () => {
    setAdminOpen(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  /* =================== 🔁 Sincroniza URL → vista (arreglado) =================== */
  useEffect(() => {
    const path = location.pathname.toLowerCase();

    // ✅ 1) Prioridad absoluta: todo lo que sea /config/* lo maneja ConfigRouter
    if (path.includes("/config")) {
      setActiveModule("Config");
      return;
    }

    // 2) Detecciones por módulos
    const isPacPlanes = /\/pacientes\/[^/]+\/planes(\/|$)/.test(path); // SOLO planes dentro de pacientes
    const isPac = path.includes("/pacientes") || isPacPlanes;
    const isCaja = path.includes("/caja");
    const isAg = path.includes("/agenda");
    const isFact = path.includes("/facturacion");
    const isInv = path.includes("/inventario");
    const isOdo = path.includes("/odontograma");
    const isRep = path.includes("/reportes");
    const isFin = path.includes("/financiero"); // NUEVO
    const isAdm = path.includes("/administracion"); // NUEVO

    if (isPac) setActiveModule("Pacientes");
    else if (isFin) setActiveModule("Financiero");
    else if (isAdm) setActiveModule("Administración");
    else if (isCaja) setActiveModule("Caja");
    else if (isAg) setActiveModule("Agenda");
    else if (isInv) setActiveModule("Inventario");
    else if (isOdo) setActiveModule("Odontograma");
    else if (isRep) setActiveModule("Reportes");
    else setActiveModule("Inicio");

    // Facturación: además de marcar el módulo, ajustamos la subvista
    if (isFact) {
      setActiveModule("Facturación");
      if (path.includes("/pagos")) setFactView("pagos");
      else if (path.includes("/facturas")) setFactView("fv");
      else if (path.includes("/recibo")) setFactView("recibo");
      else if (path.includes("/saldo")) setFactView("saldo");
      else if (path.includes("/nc")) setFactView("nc");
      else if (path.includes("/nd")) setFactView("nd");
      else if (path.includes("/liq")) setFactView("liq");
      else if (path.includes("/tras")) setFactView("tras");
      else if (path.includes("/oc")) setFactView("oc");
      else if (path.includes("/fc")) setFactView("fc");
      else setFactView("recibo");
    }
  }, [location.pathname]);

  /* =================== ✅ Rutas absolutas y helper go =================== */
  const basePath = useMemo(() => {
    const segs = location.pathname.split("/").filter(Boolean);
    // Find any segment that marks the root of a dashboard (dashboard, superadmin, dashboard_*)
    const dashIdx = segs.findIndex((s) =>
      s === "dashboard" || s === "superadmin" || s.startsWith("dashboard_")
    );
    return dashIdx >= 0 ? `/${segs.slice(0, dashIdx + 1).join("/")}` : "";
  }, [location.pathname]);

  const go = (segment = "") => {
    const clean = String(segment).replace(/^\/+|\/+$/g, "");
    const target = clean ? `${basePath}/${clean}` : basePath || "/";
    const same = location.pathname.toLowerCase() === target.toLowerCase();
    navigate(target, { replace: same });
  };

  // 🛡️ SECURITY GUARD: KICK SUPERADMIN OUT OF CLINICAL DASHBOARD
  useEffect(() => {
    const currentRol = (userProfile?.rol || "").trim().toLowerCase();
    if (currentRol === "superadmin") {
      console.warn("Dashboard - Superadmin detectado en zona clínica. Redirigiendo a /superadmin.");
      navigate("/superadmin", { replace: true });
    }
  }, [userProfile?.rol, navigate]);

  // 🛡️ SECURITY GUARD: PREVENT USERS FROM ACCESSING RESTRICTED MODULES
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/agenda") && !can("Agenda", "Agenda", "consultar")) {
      console.warn("Dashboard - Acceso denegado a Agenda. Redirigiendo...");
      navigate(basePath || "/dashboard", { replace: true });
    } else if (path.includes("/pacientes") && !can("Pacientes", "Paciente", "consultar")) {
      console.warn("Dashboard - Acceso denegado a Pacientes. Redirigiendo...");
      navigate(basePath || "/dashboard", { replace: true });
    } else if (path.includes("/caja") && !can("Caja", "Caja", "consultar")) {
      console.warn("Dashboard - Acceso denegado a Caja. Redirigiendo...");
      navigate(basePath || "/dashboard", { replace: true });
    } else if (path.includes("/administracion") && !can("Administración", "Gestion Administración", "consultar")) {
      console.warn("Dashboard - Acceso denegado a Administración. Redirigiendo...");
      navigate(basePath || "/dashboard", { replace: true });
    } else if (path.includes("/reportes") && !can("Reportes", "Gestion Reportes", "consultar")) {
      console.warn("Dashboard - Acceso denegado a Reportes. Redirigiendo...");
      navigate(basePath || "/dashboard", { replace: true });
    } else if (path.includes("/config") && !can("Configuración", "Gestion Configuración", "consultar")) {
      console.warn("Dashboard - Acceso denegado a Configuración. Redirigiendo...");
      navigate(basePath || "/dashboard", { replace: true });
    }
  }, [userProfile, location.pathname, navigate, basePath, can]);

  /* ===== Contenido por módulo (controlado por activeModule) ===== */
  const renderModuleContent = () => {
    switch (activeModule) {
      case "Agenda":
        return <Agenda />;
      case "Pacientes":
        return (
          <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
            <Pacientes />
          </Suspense>
        );
      case "Administración":
      case "Administracion":
        return <AdministracionRouter />;
      case "Facturación":
      case "Financiero":
        return <FinancieroRouter />;
      case "Odontograma":
        return <Odontograma />;
      case "Reportes":
        return <Reportes />;
      case "Caja":
        return <Caja />; // Caja leerá los query params (cobro, patientId)
      case "Config":
      case "Configuración":
      case "Configuracion":
        // ⬇️ Si la URL es /config/:slug usamos el router; si no, la portada de config
        return <ConfigRouter />;

      case "Inicio":
      default:
        return null;
    }
  };

  return (
    <DashboardLayout basePath={basePath}>
      <a href="#oc-main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-white focus:text-blue-600 focus:z-50">Saltar al contenido</a>

      {/* Si NO es Inicio, renderiza el módulo */}
      {activeModule !== "Inicio" && (
        <div className="h-full w-full">
          <ErrorBoundary>
            {renderModuleContent()}
          </ErrorBoundary>
        </div>
      )}

      {/* Inicio (portada) */}
      {activeModule === "Inicio" && (
          <Overview
            t={t}
            companyName={companyName}
            companyLogo={companyLogo}
            softwareLogo={logo} // PASSING SOFTWARE LOGO
            userName={userName}
            role={role}
            darkMode={darkMode}
            weeklySeries={weeklySeries}
            weekRangeLabel={weekRangeLabel}
            todaysAppointments={todaysAppointments}
            todaysLoading={todaysLoading}
            metrics={metrics}
            metricsLoading={metricsLoading}
            recent={recent}
            recentLoading={recentLoading}
            onGoAgenda={() => setActiveModule("Agenda")}
            isDoc={isDoc}
            currentDoctorId={currentDoctorId}
            basePath={basePath}
          />
        )}
    </DashboardLayout>
  );
}
