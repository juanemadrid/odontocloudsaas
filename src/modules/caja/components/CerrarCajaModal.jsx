import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { FiX, FiLock, FiAlertTriangle, FiCheckCircle, FiTrendingUp, FiTrendingDown } from "react-icons/fi";

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

export default function CerrarCajaModal({ caja, inquilino, userProfile, onClose, onSuccess }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMov, setLoadingMov] = useState(true);
  
  // Conteo form
  const [conteoEfectivo, setConteoEfectivo] = useState("");
  const [conteoEfectivoDisplay, setConteoEfectivoDisplay] = useState("");
  const [conteoOtros, setConteoOtros] = useState("");
  const [conteoOtrosDisplay, setConteoOtrosDisplay] = useState("");
  
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Real-time movimientos
  useEffect(() => {
    const q = query(
      collection(db, "cajas", caja.id, "movimientos"),
      orderBy("fecha", "desc")
    );
    setLoadingMov(true);
    const unsub = onSnapshot(q, snap => {
      setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingMov(false);
    }, () => setLoadingMov(false));
    return () => unsub();
  }, [caja.id]);

  // Calculated values
  const totalIngresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s, m) => s + (m.monto || 0), 0);
  const totalEgresos = movimientos.filter(m => m.tipo === "egreso").reduce((s, m) => s + (m.monto || 0), 0);
  const saldoTeorico = (caja.baseInicial || 0) + totalIngresos - totalEgresos;

  // Split cash vs banks expected balances
  const totalIngresosEfectivo = movimientos
    .filter(m => m.tipo === "ingreso" && (m.metodoPago === "Efectivo" || !m.metodoPago))
    .reduce((s, m) => s + (m.monto || 0), 0);
  const totalEgresosEfectivo = movimientos
    .filter(m => m.tipo === "egreso" && (m.metodoPago === "Efectivo" || !m.metodoPago))
    .reduce((s, m) => s + (m.monto || 0), 0);
  const efectivoEsperado = (caja.baseInicial || 0) + totalIngresosEfectivo - totalEgresosEfectivo;

  const totalIngresosOtros = movimientos
    .filter(m => m.tipo === "ingreso" && m.metodoPago && m.metodoPago !== "Efectivo")
    .reduce((s, m) => s + (m.monto || 0), 0);
  const totalEgresosOtros = movimientos
    .filter(m => m.tipo === "egreso" && m.metodoPago && m.metodoPago !== "Efectivo")
    .reduce((s, m) => s + (m.monto || 0), 0);
  const otrosEsperado = totalIngresosOtros - totalEgresosOtros;

  const conteoEfNum = parseFloat(String(conteoEfectivo).replace(/[^0-9]/g, "")) || 0;
  const conteoOtrosNum = parseFloat(String(conteoOtros).replace(/[^0-9]/g, "")) || 0;
  const conteoTotal = conteoEfNum + conteoOtrosNum;
  const diferencia = conteoTotal - saldoTeorico;

  const handleCerrar = async () => {
    if (!confirmed) { setError("Confirma que has realizado el conteo físico."); return; }
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "cajas", caja.id), {
        estado: "cerrada",
        fechaCierre: serverTimestamp(),
        conteoEfectivo: conteoEfNum,
        conteoOtros: conteoOtrosNum,
        conteoTotal,
        saldoTeorico,
        diferencia,
        totalIngresos,
        totalEgresos,
        observacionCierre: observacion.trim(),
        cierradoPor: userProfile?.nombre || userProfile?.email || "Usuario",
        cierradoPorId: userProfile?.uid || "",
      });
      onSuccess?.();
    } catch (err) {
      console.error("Error cerrando caja:", err);
      setError("No se pudo cerrar la caja. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <FiLock size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Cierre de Caja</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {caja.usuarioNombre || caja.nombre} · {fmtDate(caja.fechaApertura)}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-left">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700 text-[12px] font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
            <FiAlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <p className="text-[12px] font-medium text-amber-800 leading-snug">
              Al cerrar la caja ya no se podrán registrar más movimientos en este turno.
            </p>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              { label: "Base Inicial", val: fmt(caja.baseInicial || 0), color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
              { label: "Ingresos", val: fmt(totalIngresos), color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Egresos", val: fmt(totalEgresos), color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
              { label: "Saldo Teórico", val: fmt(saldoTeorico), color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-lg p-2.5 border`}>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{k.label}</div>
                <div className={`text-[13px] font-bold truncate ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Desglose por medios de pago */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Efectivo Esperado</span>
              <span className="text-slate-800 font-bold text-[13px] font-mono">{fmt(efectivoEsperado)}</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Bancos / Transferencias</span>
              <span className="text-blue-700 font-bold text-[13px] font-mono">{fmt(otrosEsperado)}</span>
            </div>
          </div>

          {/* Verification Section */}
          <div className="space-y-2">
             <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Cuadre Físico de Dinero</h4>
             <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="text-[11px] font-bold text-slate-600 block mb-1">Efectivo Contado (COP) *</label>
                   <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">$</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={conteoEfectivoDisplay}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setConteoEfectivo(raw);
                          setConteoEfectivoDisplay(raw ? fmtPure(raw) : "");
                        }}
                        className="w-full h-9 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors font-mono"
                        required
                      />
                   </div>
                </div>

                <div>
                   <label className="text-[11px] font-bold text-slate-600 block mb-1">Otros Medios (Transf., etc.)</label>
                   <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">$</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={conteoOtrosDisplay}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setConteoOtros(raw);
                          setConteoOtrosDisplay(raw ? fmtPure(raw) : "");
                        }}
                        className="w-full h-9 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors font-mono"
                        required
                      />
                   </div>
                </div>
             </div>
          </div>

          {/* Difference Result Card */}
          {(conteoEfectivo || conteoOtros) && (
            <div className={`p-3.5 rounded-lg border flex items-center justify-between gap-3
              ${diferencia === 0 ? 'bg-emerald-50 border-emerald-200' : diferencia > 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0
                  ${diferencia === 0 ? 'bg-emerald-500 text-white' : diferencia > 0 ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white'}`}
                >
                  {diferencia === 0 ? <FiCheckCircle /> : diferencia > 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diferencia Final</div>
                  <div className={`text-[15px] font-extrabold ${diferencia === 0 ? 'text-emerald-700' : diferencia > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                     {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Contado</div>
                 <div className="text-[14px] font-bold text-slate-800">{fmt(conteoTotal)}</div>
              </div>
            </div>
          )}

          {/* Observación */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Observaciones / Novedades</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              placeholder="Notas sobre el cierre, faltantes, sobrantes..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Confirmation */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
            ${confirmed ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}
          >
             <input 
               type="checkbox" 
               className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" 
               checked={confirmed}
               onChange={e => setConfirmed(e.target.checked)}
             />
             <span className={`text-[12px] font-medium ${confirmed ? 'text-emerald-800 font-semibold' : 'text-slate-600'}`}>
                Declaro que he realizado el conteo físico detallado y los valores son correctos.
             </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-[12px] text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleCerrar}
            disabled={saving || !confirmed}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FiLock size={14} />
                <span>Cerrar Caja Definitivamente</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
