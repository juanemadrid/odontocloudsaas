// src/modules/caja/Caja.jsx
// ============================================================
// 🏦 Módulo de Caja - OdontoCloud
// Conectado en tiempo real con Firebase, pacientes y facturas.
// Sin índices compuestos (sort client-side).
// ============================================================
import React, { useState, useEffect } from "react";
import {
  FiDollarSign, FiPlus, FiCheckCircle, FiLock,
  FiUser, FiBriefcase, FiSearch,
  FiEye, FiXSquare
} from "react-icons/fi";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import AbrirCajaModal from "./components/AbrirCajaModal";
import CajaDetalleModal from "./components/CajaDetalleModal";
import CajaDetalleView from "./components/CajaDetalleView";
import CerrarCajaModal from "./components/CerrarCajaModal";
import MovimientoModal from "./components/MovimientoModal";
import BancosView from "./components/BancosView";

/* ─── Helpers ─── */
const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return "—"; }
};

/* ─── Sidebar items ─── */
const MENU_ITEMS = [
  { id: "abrir", label: "Abrir caja", isAction: true },
  { id: "abiertas", label: "Cajas abiertas" },
  { id: "cerradas", label: "Cajas cerradas" },
  { id: "mi-caja", label: "Mi caja" },
  { id: "bancos", label: "Bancos" },
];

/* ─── Main Component ─── */
export default function Caja() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";
  const userId = userProfile?.uid || "";
  const userName = userProfile?.nombre || userProfile?.email || "Usuario";

  const [activeMenu, setActiveMenu] = useState("abiertas");
  const [allCajas, setAllCajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [selectedCaja, setSelectedCaja] = useState(null);
  const [showDetalle, setShowDetalle] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const [showMovimiento, setShowMovimiento] = useState(false);

  // Reset desde sidebar externo
  useEffect(() => {
    const handleReset = () => {
      setActiveMenu("abiertas");
      setSearch("");
      setShowAbrirModal(false);
      setSelectedCaja(null);
      setShowDetalle(false);
      setShowCerrar(false);
      setShowMovimiento(false);
    };
    window.addEventListener("reset-module-caja", handleReset);
    return () => window.removeEventListener("reset-module-caja", handleReset);
  }, []);

  /* ─── Load ALL cajas in real-time ─── */
  useEffect(() => {
    if (!inquilino) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, "cajas"), where("inquilino", "==", inquilino));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fechaApertura?.seconds || 0) - (a.fechaApertura?.seconds || 0));
        setAllCajas(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando cajas:", err);
        setAllCajas([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [inquilino]);

  /* ─── Filter by active menu ─── */
  const cajasFiltradas = (() => {
    let list = allCajas;
    if (activeMenu === "abiertas") list = allCajas.filter(c => c.estado === "abierta");
    else if (activeMenu === "cerradas") list = allCajas.filter(c => c.estado === "cerrada");
    else if (activeMenu === "mi-caja") list = allCajas.filter(c => c.usuarioId === userId || c.usuarioNombre === userName);
    else if (activeMenu === "bancos") list = allCajas.filter(c => (c.tipo || "").toLowerCase() === "banco");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.usuarioNombre || "").toLowerCase().includes(q) ||
        (c.nombre || "").toLowerCase().includes(q) ||
        (c.tipo || "").toLowerCase().includes(q)
      );
    }
    return list;
  })();

  /* ─── Handlers ─── */
  const handleMenuClick = (id) => {
    setShowDetalle(false);
    setSelectedCaja(null);
    if (id === "abrir") { setShowAbrirModal(true); return; }
    setActiveMenu(id);
    setSearch("");
  };

  const pageTitle = {
    abiertas: "Cajas Abiertas",
    cerradas: "Cajas Cerradas",
    "mi-caja": "Mi Caja",
    bancos: "Bancos",
  }[activeMenu] || "Cajas";

  /* ─── TABLE COLUMNS ─── */
  const TABLE_COLS = [
    { label: "Caja", w: "auto" },
    { label: "Fecha apertura", w: 170 },
    { label: "Base actual", w: 130 },
    { label: "Saldo inicial", w: 130 },
    { label: "Saldo actual", w: 130 },
    { label: "Acciones", w: 110 },
  ];

  return (
    <div className="flex bg-white h-[calc(100vh-60px)] overflow-hidden">

      {/* ─── SIDEBAR ─── */}
      <aside className="no-print w-[190px] shrink-0 border-r border-slate-200 flex flex-col pt-5 pb-6 bg-white">
        {/* Label */}
        <div className="px-5 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
          Menú
        </div>

        {/* Abrir caja — acción primaria */}
        <div className="px-3 pb-3">
          <button
            onClick={() => handleMenuClick("abrir")}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-[12px] font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0"
          >
            <FiPlus size={15} />
            <span>Abrir Caja</span>
          </button>
        </div>

        {/* Divisor */}
        <div className="mx-3 border-t border-slate-100 mb-3" />

        {/* Nav items */}
        <nav className="flex flex-col px-3 gap-0.5">
          {MENU_ITEMS.filter(i => !i.isAction).map((item) => {
            const isActive = !showDetalle && activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`w-full text-left relative px-4 py-2 text-[13px] rounded transition-colors bg-transparent border-0 cursor-pointer ${
                  isActive
                    ? "font-semibold text-slate-900 bg-slate-100"
                    : "font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r" />
                )}
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">

        {showDetalle && selectedCaja ? (
          /* ─── VISTA DETALLE DE CAJA (OralDrive Style) ─── */
          <CajaDetalleView
            caja={selectedCaja}
            userProfile={userProfile}
            onBack={() => { setShowDetalle(false); setSelectedCaja(null); }}
          />
        ) : (
          <>
            {/* Page header with breadcrumb */}
            <div className="px-8 pt-5 pb-4 shrink-0 bg-white border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-1">
                <span>🏠</span>
                <span className="text-slate-300">&rsaquo;</span>
                <span className="text-slate-500">Caja</span>
              </div>
              <h1 className="text-[20px] font-bold text-slate-800">{pageTitle}</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-5">
              {activeMenu === "bancos" ? (
                <BancosView inquilino={inquilino} userProfile={userProfile} />
              ) : (
            <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-0">

              {/* Toolbar */}
              <div className="px-5 py-3 flex items-center justify-end gap-2 border-b border-slate-100 shrink-0 bg-white">
                {/* Export button */}
                <button
                  title="Exportar"
                  className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:text-slate-600 hover:border-slate-300 bg-white transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                {/* Search */}
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded border border-slate-200 text-[12px] outline-none w-[180px] bg-white text-slate-700 focus:border-blue-400 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-[13px]">Cargando cajas...</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        {TABLE_COLS.map((h) => (
                          <th
                            key={h.label}
                            style={{ width: h.w }}
                            className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 bg-white border-b border-slate-200 sticky top-0"
                          >
                            <div>{h.label}</div>
                            {h.label !== "Acciones" && (
                              <div className="mt-0.5">
                                <FiSearch size={10} className="text-slate-300" />
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cajasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={TABLE_COLS.length} className="p-16 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <FiBriefcase size={36} className="text-slate-200 mb-3" />
                              <p className="text-[13px] font-medium text-slate-500">No hay cajas registradas</p>
                              <p className="text-[12px] text-slate-400 mt-1">
                                Usa "Abrir caja" en el menú lateral para comenzar.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        cajasFiltradas.map((caja) => (
                          <tr
                            key={caja.id}
                            className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                          >
                            {/* Caja */}
                            <td className="px-4 py-3 align-middle">
                              <div className="font-medium text-slate-800">
                                {caja.usuarioNombre || caja.nombre || "—"}
                              </div>
                              {caja.nombre && caja.usuarioNombre && caja.nombre !== caja.usuarioNombre && (
                                <div className="text-[11px] text-slate-400 mt-0.5">{caja.nombre}</div>
                              )}
                            </td>
                            {/* Fecha apertura */}
                            <td className="px-4 py-3 align-middle text-slate-600 whitespace-nowrap">
                              {fmtDate(caja.fechaApertura)}
                            </td>
                            {/* Base actual */}
                            <td className="px-4 py-3 align-middle text-slate-600">
                              {fmt(caja.totalIngresos || 0)}
                            </td>
                            {/* Saldo inicial */}
                            <td className="px-4 py-3 align-middle text-slate-600">
                              {fmt(caja.baseInicial || 0)}
                            </td>
                            {/* Saldo actual */}
                            <td className="px-4 py-3 align-middle font-semibold text-slate-800">
                              {fmt(caja.saldoActual || 0)}
                            </td>
                            {/* Acciones */}
                            <td className="px-4 py-3 align-middle">
                              <div className="flex items-center gap-1.5">
                                {/* Ver detalle - azul */}
                                <button
                                  onClick={() => { setSelectedCaja(caja); setShowDetalle(true); }}
                                  title="Ver movimientos"
                                  className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                >
                                  <FiEye size={13} />
                                </button>
                                {/* Cerrar caja - rojo */}
                                {caja.estado === "abierta" && (
                                  <button
                                    onClick={() => { setSelectedCaja(caja); setShowCerrar(true); }}
                                    title="Cerrar caja"
                                    className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                  >
                                    <FiXSquare size={13} />
                                  </button>
                                )}
                                {/* Movimiento - verde */}
                                {caja.estado === "abierta" && (
                                  <button
                                    onClick={() => { setSelectedCaja(caja); setShowMovimiento(true); }}
                                    title="Registrar movimiento"
                                    className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                  >
                                    <FiDollarSign size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
        </>
        )}
      </div>

      {/* ─── MODALS ─── */}
      {showAbrirModal && (
        <AbrirCajaModal
          inquilino={inquilino}
          userProfile={userProfile}
          onClose={() => setShowAbrirModal(false)}
          onSuccess={() => { setShowAbrirModal(false); setActiveMenu("abiertas"); }}
        />
      )}

      {showCerrar && selectedCaja && (
        <CerrarCajaModal
          caja={selectedCaja}
          inquilino={inquilino}
          userProfile={userProfile}
          onClose={() => { setShowCerrar(false); setSelectedCaja(null); }}
          onSuccess={() => { setShowCerrar(false); setSelectedCaja(null); }}
        />
      )}

      {showMovimiento && selectedCaja && (
        <MovimientoModal
          caja={selectedCaja}
          inquilino={inquilino}
          userProfile={userProfile}
          onClose={() => { setShowMovimiento(false); setSelectedCaja(null); }}
          onSuccess={() => { setShowMovimiento(false); setSelectedCaja(null); }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
      `}</style>
    </div>
  );
}
