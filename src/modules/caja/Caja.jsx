// src/modules/caja/Caja.jsx
// ============================================================
// 🏦 Módulo de Caja - OdontoCloud
// Conectado en tiempo real con Supabase, pacientes y facturas.
// Sin índices compuestos (sort client-side).
// ============================================================
import React, { useState, useEffect } from "react";
import {
  FiDollarSign, FiPlus, FiCheckCircle, FiLock,
  FiUser, FiBriefcase, FiSearch,
  FiEye, FiXSquare
} from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

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
  const inquilino = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId || userProfile?.tenant?.inquilino || userProfile?.tenant?.id || "";
  const userId = userProfile?.uid || userProfile?.id || "";
  const userName = userProfile?.nombre || userProfile?.full_name || userProfile?.email || "Usuario";

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

  /* ─── Load ALL cajas ─── */
  const fetchCajas = React.useCallback(async () => {
    if (!inquilino) { setLoading(false); return; }
    setLoading(true);

    try {
      let list = [];
      try {
        const { data } = await supabase
          .from("cajas")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false });
        if (data && data.length > 0) list = data;
      } catch (e) {}

      let movsList = [];
      try {
        const { data: mData } = await supabase
          .from("movimientos_caja")
          .select("*")
          .eq("tenant_id", inquilino);
        if (mData) movsList = mData;
      } catch (e) {}

      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const cfgCajas = cfgRow?.config?.cajas || [];

      // Combinar cajas de DB y website_config con cálculo dinámico de saldos
      const mergedMap = new Map();
      [...list, ...cfgCajas].forEach(c => {
        if (c && c.id && !mergedMap.has(c.id)) {
          const cajaMovs = movsList.filter(m => m.caja_id === c.id || m.cajaId === c.id);
          const movIngresos = cajaMovs.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto || 0), 0);
          const movEgresos = cajaMovs.filter(m => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto || 0), 0);
          
          const totalIngresos = (Number(c.total_ingresos ?? c.totalIngresos ?? 0)) > 0 ? Number(c.total_ingresos ?? c.totalIngresos) : movIngresos;
          const totalEgresos = (Number(c.total_egresos ?? c.totalEgresos ?? 0)) > 0 ? Number(c.total_egresos ?? c.totalEgresos) : movEgresos;
          const baseInicial = Number(c.base_inicial ?? c.baseInicial ?? 0);
          const saldoCalculado = (Number(c.saldo_actual ?? c.saldoActual ?? 0)) > 0 ? Number(c.saldo_actual ?? c.saldoActual) : (baseInicial + totalIngresos - totalEgresos);

          mergedMap.set(c.id, {
            ...c,
            baseInicial,
            saldoInicial: c.saldo_inicial ?? c.saldoInicial ?? baseInicial,
            saldoActual: saldoCalculado,
            totalIngresos,
            totalEgresos,
            usuarioId: c.usuario_id ?? c.usuarioId ?? "",
            usuarioNombre: c.usuario_nombre ?? c.usuarioNombre ?? (c.nombre || "Usuario"),
            fechaApertura: c.fecha_apertura ?? c.fechaApertura ?? c.created_at
          });
        }
      });

      setAllCajas(Array.from(mergedMap.values()));
    } catch (e) {
      console.warn("Caja fetchCajas error:", e);
    } finally {
      setLoading(false);
    }
  }, [inquilino]);

  useEffect(() => {
    fetchCajas();

    if (!inquilino) return;

    const channel = supabase
      .channel(`cajas-${inquilino}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cajas', filter: `tenant_id=eq.${inquilino}` }, fetchCajas)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [inquilino, fetchCajas]);

  /* ─── Filter by active menu ─── */
  const cajasFiltradas = (() => {
    let list = allCajas;
    if (activeMenu === "abiertas") list = allCajas.filter(c => (c.estado || "").toLowerCase() === "abierta");
    else if (activeMenu === "cerradas") list = allCajas.filter(c => (c.estado || "").toLowerCase() === "cerrada");
    else if (activeMenu === "mi-caja") list = allCajas.filter(c => 
      c.usuarioId === userId || 
      c.usuario_id === userId || 
      c.usuarioId === userProfile?.id ||
      c.usuario_id === userProfile?.id ||
      (c.usuarioNombre || c.usuario_nombre || "").toLowerCase() === userName.toLowerCase()
    );
    else if (activeMenu === "bancos") list = allCajas.filter(c => (c.tipo || "").toLowerCase() === "banco");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.usuarioNombre || c.usuario_nombre || "").toLowerCase().includes(q) ||
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
            className="w-full bg-[#8cc33f] hover:bg-[#7db02b] text-white px-3 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 active:scale-95"
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
              ) : activeMenu === "mi-caja" ? (
                (() => {
                  const miCajaActiva = allCajas.find(c =>
                    (c.estado || "").toLowerCase() === "abierta" &&
                    (
                      c.usuarioId === userId || 
                      c.usuario_id === userId || 
                      c.usuarioId === userProfile?.id ||
                      c.usuario_id === userProfile?.id ||
                      (c.usuarioNombre || c.usuario_nombre || "").toLowerCase() === userName.toLowerCase()
                    )
                  ) || allCajas.find(c => (c.estado || "").toLowerCase() === "abierta");

                  if (miCajaActiva) {
                    return (
                      <CajaDetalleView
                        caja={miCajaActiva}
                        userProfile={userProfile}
                        onBack={() => setActiveMenu("abiertas")}
                      />
                    );
                  }

                  return (
                    <div className="flex-1 flex flex-col items-center justify-center p-16 bg-white rounded-md border border-slate-200 text-center m-6 shadow-sm">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                        <FiBriefcase size={28} />
                      </div>
                      <h2 className="text-lg font-bold text-slate-800">No tienes una caja abierta en este momento</h2>
                      <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
                        Abre una caja para comenzar a registrar recaudos de pacientes, abonos y gastos diarios.
                      </p>
                      <button
                        onClick={() => setShowAbrirModal(true)}
                        className="bg-[#8cc33f] hover:bg-[#7db02b] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer border-0 active:scale-95"
                      >
                        <FiPlus size={16} />
                        <span>Abrir Mi Caja</span>
                      </button>
                    </div>
                  );
                })()
              ) : (
            <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-0">

              {/* Toolbar */}
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
                <div className="text-[13px] font-bold text-slate-700">
                  {activeMenu === "cerradas" ? "Histórico de Cajas Cerradas" : "Listado de Cajas Abiertas"}
                </div>
                <div className="flex items-center gap-2">
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
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {activeMenu === "cerradas" ? (
                          <>
                            <th className="px-4 py-3 text-left">Caja</th>
                            <th className="px-4 py-3 text-left">Fecha apertura</th>
                            <th className="px-4 py-3 text-left">Fecha cierre</th>
                            <th className="px-4 py-3 text-left">Usuario cierra</th>
                            <th className="px-4 py-3 text-right">Ingresos</th>
                            <th className="px-4 py-3 text-right">Egresos</th>
                            <th className="px-4 py-3 text-right">Base Inicial</th>
                            <th className="px-4 py-3 text-right">Saldo</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 text-left">Caja</th>
                            <th className="px-4 py-3 text-left">Fecha apertura</th>
                            <th className="px-4 py-3 text-right">Base Inicial</th>
                            <th className="px-4 py-3 text-right">Ingresos</th>
                            <th className="px-4 py-3 text-right">Egresos</th>
                            <th className="px-4 py-3 text-right">Saldo actual</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cajasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={activeMenu === "cerradas" ? 9 : 7} className="p-16 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <FiBriefcase size={36} className="text-slate-200 mb-3" />
                              <p className="text-[13px] font-medium text-slate-500">
                                {activeMenu === "cerradas" ? "No hay cajas cerradas en el historial" : "No hay cajas abiertas registradas"}
                              </p>
                              {activeMenu === "abiertas" && (
                                <p className="text-[12px] text-slate-400 mt-1">
                                  Usa "Abrir caja" en el menú lateral para comenzar.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        cajasFiltradas.map((caja) => (
                          <tr
                            key={caja.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Caja */}
                            <td className="px-4 py-3.5 align-middle">
                              <div className="font-bold text-slate-800 uppercase">
                                {caja.usuarioNombre || caja.nombre || "—"}
                              </div>
                              {caja.nombre && caja.usuarioNombre && caja.nombre !== caja.usuarioNombre && (
                                <div className="text-[11px] text-slate-400 mt-0.5">{caja.nombre}</div>
                              )}
                            </td>

                            {/* Fecha apertura */}
                            <td className="px-4 py-3.5 align-middle text-slate-500 whitespace-nowrap">
                              {fmtDate(caja.fechaApertura || caja.created_at)}
                            </td>

                            {activeMenu === "cerradas" ? (
                              <>
                                {/* Fecha cierre */}
                                <td className="px-4 py-3.5 align-middle text-slate-500 whitespace-nowrap">
                                  {fmtDate(caja.fecha_cierre || caja.fechaCierre || caja.updated_at)}
                                </td>
                                {/* Usuario cierra */}
                                <td className="px-4 py-3.5 align-middle font-medium text-slate-700 uppercase">
                                  {caja.cierradoPor || caja.usuarioNombre || "—"}
                                </td>
                                {/* Ingresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-emerald-600">
                                  {fmt(caja.totalIngresos || 0)}
                                </td>
                                {/* Egresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-rose-600">
                                  {fmt(caja.totalEgresos || 0)}
                                </td>
                                {/* Base Inicial */}
                                <td className="px-4 py-3.5 align-middle text-right text-slate-600 font-medium">
                                  {fmt(caja.baseInicial || 0)}
                                </td>
                                {/* Saldo */}
                                <td className="px-4 py-3.5 align-middle text-right font-bold text-blue-600">
                                  {fmt(caja.saldoActual || 0)}
                                </td>
                              </>
                            ) : (
                              <>
                                {/* Base Inicial */}
                                <td className="px-4 py-3.5 align-middle text-right text-slate-600 font-medium">
                                  {fmt(caja.baseInicial || 0)}
                                </td>
                                {/* Ingresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-emerald-600">
                                  {fmt(caja.totalIngresos || 0)}
                                </td>
                                {/* Egresos */}
                                <td className="px-4 py-3.5 align-middle text-right font-semibold text-rose-600">
                                  {fmt(caja.totalEgresos || 0)}
                                </td>
                                {/* Saldo actual */}
                                <td className="px-4 py-3.5 align-middle text-right font-bold text-blue-600">
                                  {fmt(caja.saldoActual || 0)}
                                </td>
                              </>
                            )}

                            {/* Acciones */}
                            <td className="px-4 py-3.5 align-middle text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Ver detalle - azul */}
                                <button
                                  onClick={() => { setSelectedCaja(caja); setShowDetalle(true); }}
                                  title="Ver detalle de movimientos"
                                  className="w-7 h-7 rounded bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                >
                                  <FiEye size={13} />
                                </button>
                                {/* Cerrar caja - rojo */}
                                {caja.estado === "abierta" && (
                                  <button
                                    onClick={() => { setSelectedCaja(caja); setShowCerrar(true); }}
                                    title="Cerrar caja"
                                    className="w-7 h-7 rounded bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                  >
                                    <FiXSquare size={13} />
                                  </button>
                                )}
                                {/* Movimiento - verde */}
                                {caja.estado === "abierta" && (
                                  <button
                                    onClick={() => { setSelectedCaja(caja); setShowMovimiento(true); }}
                                    title="Registrar movimiento"
                                    className="w-7 h-7 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
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
          onSuccess={() => { setShowAbrirModal(false); setActiveMenu("abiertas"); fetchCajas(); }}
        />
      )}

      {showCerrar && selectedCaja && (
        <CerrarCajaModal
          caja={selectedCaja}
          inquilino={inquilino}
          userProfile={userProfile}
          onClose={() => { setShowCerrar(false); setSelectedCaja(null); }}
          onSuccess={() => { setShowCerrar(false); setSelectedCaja(null); fetchCajas(); }}
        />
      )}

      {showMovimiento && selectedCaja && (
        <MovimientoModal
          caja={selectedCaja}
          inquilino={inquilino}
          userProfile={userProfile}
          onClose={() => { setShowMovimiento(false); setSelectedCaja(null); }}
          onSuccess={() => { setShowMovimiento(false); setSelectedCaja(null); fetchCajas(); }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
      `}</style>
    </div>
  );
}
