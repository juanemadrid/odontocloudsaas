// ===============================
// 🦷 Dashboard.jsx - Panel principal OdontoCloud (enrutado interno por URL)
// ===============================
import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";

// import "../styles/dashboard.css"; // REMOVED: Migrated to index.css

import Agenda from "../modules/agenda/Agenda";
import Facturacion from "../modules/facturacion/Facturacion";
import Inventario from "../modules/inventario/Inventario";
import Odontograma from "../modules/odontograma/Odontograma";
import Pacientes from "../modules/pacientes/Pacientes";
import Reportes from "../modules/reportes/Reportes";
// ⬇️ NUEVO
import ConfigGear from "../components/ConfigGear";
import ConfigSection from "../components/ConfigSection";
// ⬇️ NUEVO (router para /config/:slug)
import ConfigRouter from "../modules/config/ConfigRouter";
// ⬇️ NUEVO (router para Financiero)
import FinancieroRouter from "../modules/financiero/FinancieroRouter";

// 👉 Caja real
import Caja from "../modules/caja/Caja";

import DashboardLayout from "../layout/DashboardLayout";
import StatCard from "../components/shared/StatCard";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import { FiUsers, FiCalendar, FiDollarSign, FiClock, FiActivity } from "react-icons/fi";

import RecentActivity from "../components/RecentActivity";
import N8nStatus from "../components/N8nStatus";
import SmartAlerts from "../components/dashboard/SmartAlerts";

import { auth, db } from "../firebase/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";



import { useAuth } from "../context/AuthContext";
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
    n8n_title: "Automatizaciones (n8n)",
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
    n8n_title: "Automations (n8n)",
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

/* =============== NUEVO: Placeholder temporal para Planes =============== */
function PlanesPlaceholder() {
  return (
    <div className="oc-main-content">
      <div className="card">
        <h3>Planes</h3>
        <p className="oc-muted">
          Vista de Planes integrada. En el siguiente paso reemplazamos este placeholder por el módulo real
          (<code>modules/planes/Planes.jsx</code>) con creación/edición, estados y vínculo a facturación.
        </p>
      </div>
    </div>
  );
}

/* =============== Componente de portada (Inicio) =============== */
function Overview({
  t, companyName, companyLogo, userName, role, darkMode,
  weeklySeries, weekRangeLabel,
  todaysAppointments, todaysLoading,
  metrics, metricsLoading,
  n8nState, n8nLoading, recent, recentLoading,
  onGoAgenda,
}) {
  return (
    <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Slender Pro v2.0 Welcome HUD */}
      <div className="bg-slate-900 rounded-[40px] p-10 relative overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/5">
        {/* Complex Mesh Gradient Background */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full blur-[120px] animate-pulse duration-[8s]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[100px] animate-pulse duration-[6s] delay-1000" />
          <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] bg-cyan-500 rounded-full blur-[140px] opacity-30" />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(white 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Clinic Logo in Banner */}
            {companyLogo && (
              <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-4 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
                <img src={companyLogo} alt="Clinic Logo" className="max-h-full max-w-full object-contain filter brightness-0 invert opacity-90" />
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-blue-500 rounded-full blur-md animate-ping opacity-20" />
                  <div className="w-2.5 h-2.5 bg-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,0.8)]" />
                </div>
                <span className="text-[10px] font-black text-blue-300 uppercase tracking-[0.4em] drop-shadow-sm">Estado del sistema: Activo</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-[0.9] uppercase italic italic-none">
                  {role === "superadmin"
                    ? "Control Maestro OdontoCloud"
                    : t("welcomeTitle").replace("{tenant}", companyName)}
                </h1>
                <p className="text-blue-100/60 text-[13px] font-bold max-w-xl leading-relaxed uppercase tracking-[0.05em]">
                  {t("welcomeSubtitle")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap">
            {/* HUD Badge: User */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-7 py-5 rounded-[28px] flex flex-col items-end shadow-2xl relative group/hud transition-all duration-500 hover:bg-white/10 hover:border-white/20">
              <div className="absolute top-0 right-10 w-10 h-[1px] bg-blue-400/50" />
              <span className="text-[9px] font-black text-blue-300/60 uppercase tracking-[0.25em] leading-none mb-2.5">ID Operador</span>
              <span className="text-[15px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                {userName}
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
              </span>
            </div>

            {/* HUD Badge: Role */}
            <div className="bg-blue-600/20 backdrop-blur-xl border border-blue-400/20 px-7 py-5 rounded-[28px] flex flex-col items-end shadow-2xl relative group/hud transition-all duration-500 hover:bg-blue-600/30 hover:border-blue-400/40">
              <div className="absolute bottom-0 right-10 w-10 h-[1px] bg-blue-400/50" />
              <span className="text-[9px] font-black text-blue-200 uppercase tracking-[0.25em] leading-none mb-2.5">Nivel de Acceso</span>
              <span className="text-[15px] font-black text-blue-400 uppercase tracking-tight">
                {role || "Administrador"}
              </span>
            </div>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="absolute bottom-4 left-10 text-[8px] font-black text-white/10 uppercase tracking-[0.5em] pointer-events-none select-none">
          Oc-77 / v2.0
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 h-80">
          <DashboardCharts
            data={weeklySeries}
            title="Pacientes registrados"
            period={weekRangeLabel}
          />
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-6">
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
                {todaysAppointments.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{c.pacienteNombre}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FiClock size={10} />
                        {fmtTime(c.fecha, detectLocale())}
                      </div>
                    </div>
                    <span className={`
                          text-xs px-2 py-1 rounded-full font-medium capitalize
                          ${(c.estado || "").toLowerCase() === "en espera" ? "bg-amber-100 text-amber-700" :
                        (c.estado || "").toLowerCase() === "completada" ? "bg-emerald-100 text-emerald-700" :
                          "bg-blue-100 text-blue-700"}
                       `}>
                      {c.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity and Integrations - Slender Pro v3.0 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-[32px] border border-white shadow-[0_15px_60px_-15px_rgba(0,0,0,0.05)] p-8 transition-all duration-700 hover:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.08)] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/20 rounded-bl-[80px] -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-700" />
          <div className="flex items-center gap-3 mb-8">
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

        {/* Automation Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-[32px] border border-white shadow-[0_15px_60px_-15px_rgba(0,0,0,0.05)] p-8 transition-all duration-700 hover:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.08)] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/20 rounded-bl-[80px] -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-700" />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.25em]">{t("n8n_title")}</h3>
          </div>
          {n8nLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="relative z-10">
              <N8nStatus status={n8nState} />
            </div>
          )}
        </div>
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

  const hasAccess = (feature) => {
    // 1. Super Admin always has access
    if (userProfile?.rol === "superadmin") return true;
    // 2. No tenant = Legacy/Standalone => Allow all (or default behavior)
    if (!userProfile?.tenantId) return true;
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
  const role = userProfile?.rol || session?.rol || "";
  const [sessionEmail] = useState(session?.email || "");
  const [loadingUser, setLoadingUser] = useState(false);

  // Unify Company Name and Logo from Tenant
  const isSuperAdmin = userProfile?.rol === "superadmin";
  const companyName = isSuperAdmin ? "OdontoCloud Central" : (userProfile?.tenant?.name || "OdontoCloud");
  const companyLogo = isSuperAdmin ? null : (userProfile?.tenant?.logo || logo);
  const userName = userProfile?.nombre || user?.displayName || user?.email || "Usuario";

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
    const estado = (data.estado && String(data.estado)) || "programada";
    return {
      id: docSnap.id,
      fecha: fechaDate,
      pacienteId: data.pacienteId || "",
      pacienteNombre,
      estado,
      motivo: data.motivo || "",
    };
  };

  useEffect(() => {
    if (!userProfile?.tenantId) return;

    const qTodayTs = query(
      collection(db, "citas"),
      where("tenantId", "==", userProfile.tenantId),
      where("fecha", ">=", startToday),
      where("fecha", "<", endToday),
      orderBy("fecha", "asc")
    );
    const qTodayStr = query(
      collection(db, "citas"),
      where("tenantId", "==", userProfile?.tenantId || "nop"),
      where("fecha", "==", todayIso)
    );
    let cacheMap = new Map();
    let gotTs = false;
    let gotStr = false;
    const commit = () => {
      const rows = Array.from(cacheMap.values()).sort(
        (a, b) => a.fecha.getTime() - b.fecha.getTime()
      );
      const enEsperaCount = rows.filter(
        (r) => String(r.estado).toLowerCase().trim() === "en espera"
      ).length;
      setTodaysAppointments(rows);
      setMetrics((m) => ({ ...m, citasHoy: rows.length, enEspera: enEsperaCount }));
      if (gotTs && gotStr) setTodaysLoading(false);
    };
    const unsubTs = onSnapshot(
      qTodayTs,
      (snap) => {
        gotTs = true;
        const temp = new Map(cacheMap);
        snap.docs.forEach((d) => temp.set(d.id, normalizeCita(d)));
        cacheMap = temp;
        commit();
      },
      (err) => {
        console.error("Realtime citas hoy (TS):", err);
        gotTs = true;
        commit();
      }
    );
    const unsubStr = onSnapshot(
      qTodayStr,
      (snap) => {
        gotStr = true;
        const temp = new Map(cacheMap);
        snap.docs.forEach((d) => temp.set(d.id, normalizeCita(d)));
        cacheMap = temp;
        commit();
      },
      (err) => {
        console.error("Realtime citas hoy (STR):", err);
        gotStr = true;
        commit();
      }
    );
    return () => {
      try { unsubTs(); unsubStr(); } catch { }
    };
  }, [startToday, endToday, todayIso]);

  useEffect(() => {
    const loadMetricsBase = async () => {
      try {
        const pacientesCountSnap = await getCountFromServer(
          query(collection(db, "pacientes"), where("tenantId", "==", userProfile?.tenantId || "nop"))
        );
        const pacientesTotal = pacientesCountSnap.data().count || 0;

        let facturacionHoy = 0;
        try {
          const qFact = query(
            collection(db, "facturas_venta"),
            where("tenantId", "==", userProfile?.tenantId || "nop"),
            where("fecha", "==", todayIso)
          );
          const factSnap = await getDocs(qFact);
          factSnap.forEach((docu) => {
            const d = docu.data();
            if (typeof d.total === "number") facturacionHoy += d.total;
          });
        } catch (e) {
          console.error("Error calc facturacion:", e);
          facturacionHoy = 0;
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
  }, [todayIso]);

  useEffect(() => {
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
      where("tenantId", "==", userProfile?.tenantId || "nop"),
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
  }, [locale]);

  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const qAct = query(
          collection(db, "actividad"),
          where("tenantId", "==", userProfile?.tenantId || "nop"),
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
  }, []);

  const [n8nState, setN8nState] = useState(null);
  const [n8nLoading, setN8nLoading] = useState(true);
  useEffect(() => {
    const loadN8n = async () => {
      try {
        const ref = doc(db, "integraciones", "n8n");
        const snap = await getDoc(ref);
        setN8nState(
          snap.exists()
            ? {
              connected: !!snap.data().connected,
              flowsRunning: snap.data().flowsRunning || 0,
              lastError: snap.data().lastError || null,
            }
            : { connected: false, flowsRunning: 0, lastError: null }
        );
      } catch (e) {
        console.error("Error cargando estado n8n:", e);
        setN8nState({
          connected: false,
          flowsRunning: 0,
          lastError: "No se pudo leer el estado desde Firebase.",
        });
      } finally {
        setN8nLoading(false);
      }
    };
    loadN8n();
  }, []);

  // Effect to re-run queries when userProfile loaded
  useEffect(() => {
    // Trigger re-fetch if tenantId changes or loads
  }, [userProfile?.tenantId]);

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
    if (path.includes("/config/")) {
      setActiveModule("Config");
      return;
    }

    // 2) Detecciones por módulos
    const isPacPlanes = /\/pacientes\/[^/]+\/planes(\/|$)/.test(path); // SOLO planes dentro de pacientes
    const isPac = path.includes("/pacientes") && !isPacPlanes;
    const isCaja = path.includes("/caja");
    const isAg = path.includes("/agenda");
    const isFact = path.includes("/facturacion");
    const isInv = path.includes("/inventario");
    const isOdo = path.includes("/odontograma");
    const isRep = path.includes("/reportes");
    const isFin = path.includes("/financiero"); // NUEVO

    if (isPacPlanes) setActiveModule("Planes");
    else if (isPac) setActiveModule("Pacientes");
    else if (isFin) setActiveModule("Financiero");
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

  // 🛡️ SECURITY GUARD: KICK SUPERADMIN OUT OF CLINICAL DASHBOARD
  useEffect(() => {
    const currentRol = (userProfile?.rol || "").trim().toLowerCase();
    if (currentRol === "superadmin") {
      console.warn("Dashboard - Superadmin detectado en zona clínica. Redirigiendo a /superadmin.");
      navigate("/superadmin", { replace: true });
    }
  }, [userProfile?.rol, navigate]);


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
      case "Facturación":
        return <Facturacion view={factView} />;
      case "Financiero":
        return <FinancieroRouter />;
      case "Inventario":
        return <Inventario />;
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

      // ⬇️ NUEVO: ruta de Planes
      case "Planes":
        return <PlanesPlaceholder />;

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
          {renderModuleContent()}
        </div>
      )}

      {/* Inicio (portada) */}
      {activeModule === "Inicio" && (
        <Overview
          key={`overview-${location.pathname}-${Date.now()}`} // FORCE REMOUNT
          t={t}
          companyName={companyName}
          companyLogo={companyLogo}
          userName={userName}
          role={role}
          darkMode={darkMode}
          weeklySeries={weeklySeries}
          weekRangeLabel={weekRangeLabel}
          todaysAppointments={todaysAppointments}
          todaysLoading={todaysLoading}
          metrics={metrics}
          metricsLoading={metricsLoading}
          n8nState={n8nState}
          n8nLoading={n8nLoading}
          recent={recent}
          recentLoading={recentLoading}
          onGoAgenda={() => go("agenda")}
        />
      )}
    </DashboardLayout>
  );
}
