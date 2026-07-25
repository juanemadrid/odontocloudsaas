import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { FiX, FiArrowUpCircle, FiArrowDownCircle, FiFilter, FiDollarSign, FiPlus } from "react-icons/fi";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  });

const fmtPure = (n) => new Intl.NumberFormat("es-CO").format(n);

const fmtDate = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-CO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
};

export default function CajaDetalleModal({ caja, onClose, onNuevoMovimiento }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterMetodo, setFilterMetodo] = useState("todos");

  // Real-time movimientos listener
  useEffect(() => {
    const q = query(
      collection(db, "cajas", caja.id, "movimientos"),
      orderBy("fecha", "desc")
    );

    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando movimientos:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [caja.id]);

  const totalIngresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((s, m) => s + (m.monto || 0), 0);

  const totalEgresos = movimientos
    .filter(m => m.tipo === "egreso")
    .reduce((s, m) => s + (m.monto || 0), 0);

  const metodosUnicos = ["todos", ...new Set(movimientos.map(m => m.metodoPago).filter(Boolean))];

  const movsFiltrados = movimientos.filter(m => {
    if (filterTipo !== "todos" && m.tipo !== filterTipo) return false;
    if (filterMetodo !== "todos" && m.metodoPago !== filterMetodo) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-white w-full max-w-[900px] rounded-[32px] shadow-[0_20px_70px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              Historial de <span className="text-blue-600">Movimientos</span>
            </h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {caja.usuarioNombre || caja.nombre} · Apertura: {fmtDate(caja.fechaApertura)}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* KPIs Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
            {[
              { label: "Saldo Actual", val: fmt(caja.saldoActual), color: "text-blue-600", bg: "bg-blue-50/30", icon: <FiDollarSign /> },
              { label: "Total Ingresos", val: fmt(totalIngresos), color: "text-emerald-600", bg: "bg-emerald-50/30", icon: <FiArrowUpCircle /> },
              { label: "Total Egresos", val: fmt(totalEgresos), color: "text-rose-600", bg: "bg-rose-50/30", icon: <FiArrowDownCircle /> },
            ].map((k, idx) => (
              <div key={idx} className={`p-6 flex items-center gap-4 ${k.bg}`}>
                 <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-xl bg-white shadow-sm border border-slate-100 ${k.color}`}>
                    {k.icon}
                 </div>
                 <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{k.label}</div>
                    <div className={`text-xl font-black ${k.color}`}>{k.val}</div>
                 </div>
              </div>
            ))}
        </div>

        {/* Toolbar / Filters */}
        <div className="px-8 py-4 bg-slate-50/30 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 shadow-sm transition-all focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10">
                  <FiFilter className="text-slate-400" size={14} />
                  <select 
                    value={filterTipo}
                    onChange={e => setFilterTipo(e.target.value)}
                    className="text-[12px] font-bold text-slate-600 outline-none bg-transparent cursor-pointer"
                  >
                    <option value="todos">Todos los flujos</option>
                    <option value="ingreso">Ingresos (+)</option>
                    <option value="egreso">Egresos (-)</option>
                  </select>
               </div>

               <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 shadow-sm transition-all focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10">
                  <select 
                    value={filterMetodo}
                    onChange={e => setFilterMetodo(e.target.value)}
                    className="text-[12px] font-bold text-slate-600 outline-none bg-transparent cursor-pointer"
                  >
                    {metodosUnicos.map(m => (
                      <option key={m} value={m}>{m === "todos" ? "Todos los métodos" : m}</option>
                    ))}
                  </select>
               </div>
            </div>

            {caja.estado === "abierta" && (
              <button 
                onClick={onNuevoMovimiento}
                className="h-10 px-5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <FiPlus size={16} /> Nuevo Movimiento
              </button>
            )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-white rounded-full animate-spin mb-4" />
                <div className="text-[13px] font-bold">Cargando movimientos...</div>
             </div>
          ) : movsFiltrados.length === 0 ? (
             <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                <div className="text-5xl mb-4 opacity-20">📋</div>
                <div className="text-[14px] font-bold">No se encontraron movimientos registrados</div>
                <p className="text-[12px] mt-1">Los movimientos aparecerán aquí conforme se registren.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100">
                    {["Fecha / Hora", "Concepto", "Paciente / Vínculo", "Método", "Monto"].map(h => (
                      <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/95 backdrop-blur-sm">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {movsFiltrados.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5 align-middle">
                         <div className="text-[12px] font-bold text-slate-700">{fmtDate(m.fecha).split(',')[0]}</div>
                         <div className="text-[10px] font-bold text-slate-400 mt-0.5">{fmtDate(m.fecha).split(',')[1]}</div>
                      </td>
                      <td className="px-8 py-5 align-middle">
                         <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${m.tipo === 'ingreso' ? 'bg-emerald-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} title={m.tipo} />
                            <div className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{m.concepto}</div>
                         </div>
                         {m.descripcion && <div className="text-[11px] text-slate-400 font-medium mt-1 truncate max-w-[200px]">{m.descripcion}</div>}
                      </td>
                      <td className="px-8 py-5 align-middle">
                          {m.pacienteNombre ? (
                            <div className="space-y-1">
                               <div className="text-[13px] font-bold text-blue-600 hover:underline cursor-pointer">{m.pacienteNombre}</div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {m.facturaNum ? `Doc: ${m.facturaNum}` : 'Pago Directo'}
                               </div>
                            </div>
                          ) : <span className="text-slate-300 font-bold text-[10px] tracking-widest">—</span>}
                      </td>
                      <td className="px-8 py-5 align-middle">
                         <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
                           {m.metodoPago}
                         </span>
                      </td>
                      <td className="px-8 py-5 align-middle">
                         <div className={`text-[15px] font-black ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {m.tipo === 'ingreso' ? '+' : '-'}{fmtPure(m.monto)}
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/20 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {movsFiltrados.length} Movimientos encontrados
          </div>
          <button 
             onClick={onClose}
             className="h-11 px-8 rounded-2xl border border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
}
