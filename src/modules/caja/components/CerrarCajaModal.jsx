import React, { useState, useEffect } from "react";
import supabase from "../../../lib/supabaseClient";
import { getConfigSection, saveConfigSection, getConfigItems } from "../../../services/configPersistenceService";
import { bankNames, buildClosingTransfers, saveTransfers } from "../../../services/bankTransferService";
import { FiX, FiLock, FiAlertTriangle, FiCheckCircle, FiTrendingUp, FiTrendingDown, FiPlus, FiMinus, FiRepeat } from "react-icons/fi";

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

  // Traslados a banco (1:1 con OralDrive)
  const [bancosList, setBancosList] = useState([]);
  const [destinosTraslado, setDestinosTraslado] = useState([]);
  const [baseProxima, setBaseProxima] = useState("0");
  const [baseProximaDisplay, setBaseProximaDisplay] = useState("0");
  
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Real-time movimientos
  useEffect(() => {
    const fetchMovs = async () => {
      setLoadingMov(true);
      const { data } = await supabase
        .from("movimientos_caja")
        .select("*")
        .eq("caja_id", caja.id)
        .order("created_at", { ascending: false });
      setMovimientos(data || []);
      setLoadingMov(false);
    };
    fetchMovs();
  }, [caja.id]);

  useEffect(() => {
    if (!inquilino) return;
    const fetchBancos = async () => {
      try {
        const list = await getConfigItems(inquilino, "bancos", "bancos");
        setBancosList(bankNames(list));
      } catch (_) {}
    };
    fetchBancos();
  }, [inquilino]);

  // Calculated values
  const totalIngresos = movimientos.filter(m => m.tipo === "ingreso" && (m.estado || "").toLowerCase() !== "anulado" && !m.anulado).reduce((s, m) => s + (m.monto || 0), 0);
  const totalEgresos = movimientos.filter(m => m.tipo === "egreso" && (m.estado || "").toLowerCase() !== "anulado" && !m.anulado).reduce((s, m) => s + (m.monto || 0), 0);
  const saldoTeorico = (caja.baseInicial || 0) + totalIngresos - totalEgresos;

  // Split cash vs banks expected balances (calculo exacto)
  const getMetodo = (m) => String(m.metodo_pago || m.metodoPago || "").trim();
  const isEfectivo = (m) => {
    const met = getMetodo(m).toLowerCase();
    return met === "efectivo" || met === "";
  };

  const totalIngresosEfectivo = movimientos
    .filter(m => m.tipo === "ingreso" && isEfectivo(m) && (m.estado || "").toLowerCase() !== "anulado" && !m.anulado)
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const totalEgresosEfectivo = movimientos
    .filter(m => m.tipo === "egreso" && isEfectivo(m) && (m.estado || "").toLowerCase() !== "anulado" && !m.anulado)
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const efectivoEsperado = (Number(caja.baseInicial) || 0) + totalIngresosEfectivo - totalEgresosEfectivo;

  const totalIngresosOtros = movimientos
    .filter(m => m.tipo === "ingreso" && !isEfectivo(m) && (m.estado || "").toLowerCase() !== "anulado" && !m.anulado)
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const totalEgresosOtros = movimientos
    .filter(m => m.tipo === "egreso" && !isEfectivo(m) && (m.estado || "").toLowerCase() !== "anulado" && !m.anulado)
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const otrosEsperado = totalIngresosOtros - totalEgresosOtros;

  const conteoEfNum = parseFloat(String(conteoEfectivo).replace(/[^0-9]/g, "")) || 0;
  const conteoOtrosNum = parseFloat(String(conteoOtros).replace(/[^0-9]/g, "")) || 0;
  const conteoTotal = conteoEfNum + conteoOtrosNum;
  const diferencia = conteoTotal - saldoTeorico;

  const handleAddDestino = () => {
    setDestinosTraslado(prev => [
      ...prev,
      {
        banco: bancosList[0] || "",
        valor: 0,
        valorDisplay: "",
        medio: "Efectivo"
      }
    ]);
  };

  const handleRemoveDestino = (idx) => {
    setDestinosTraslado(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateDestino = (idx, field, val) => {
    setDestinosTraslado(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleCerrar = async () => {
    if (!confirmed) { setError("Confirma que has realizado el conteo físico."); return; }
    // Nombre real de quien cierra (antes podía quedar "Usuario" o el correo).
    const cerradoPor = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.displayName || userProfile?.email || "Usuario";
    // Traslados a bancos: se validan ANTES de cerrar (banco, valor y que no supere lo contado).
    const ahora = new Date();
    let traslados = [];
    try {
      traslados = buildClosingTransfers({ caja, destinos: destinosTraslado, contado: conteoTotal, usuario: cerradoPor, now: ahora });
    } catch (vErr) {
      setError(vErr.message);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fechaCierreIso = ahora.toISOString();
      const updatedCajaObj = {
        ...caja,
        estado: "cerrada",
        fechaCierre: fechaCierreIso,
        fecha_cierre: fechaCierreIso,
        conteoEfectivo: conteoEfNum,
        conteoOtros: conteoOtrosNum,
        conteoTotal,
        saldoTeorico,
        diferencia,
        totalIngresos,
        total_ingresos: totalIngresos,
        totalEgresos,
        total_egresos: totalEgresos,
        observacionCierre: observacion.trim(),
        cierradoPor: cerradoPor,
        cerradoPor: cerradoPor,
        cierradoPorId: userProfile?.uid || userProfile?.id || "",
        trasladosCierre: traslados.map(t => ({ id: t.id, destino: t.destino, monto: t.monto, medio: t.medio, referencia: t.referencia, fecha: t.fecha })),
        updated_at: fechaCierreIso
      };

      try {
        const dbPayload = {
          estado: "cerrada",
          fecha_cierre: fechaCierreIso,
          updated_at: fechaCierreIso
        };
        if (observacion.trim()) {
          dbPayload.notas = observacion.trim();
        }
        await supabase
          .from("cajas")
          .update(dbPayload)
          .eq("id", caja.id);
      } catch (e) {
        console.warn("Error actualizando estado en tabla cajas:", e);
      }

      // Sincronizar en website_config
      try {
        const currentList = await getConfigSection(inquilino, "cajas", []);
        const updatedList = currentList.map(item => item.id === caja.id ? updatedCajaObj : item);
        await saveConfigSection(inquilino, "cajas", updatedList);
      } catch (e) {}

      // Registrar los traslados a bancos donde los leen Traslados, Caja → Bancos y Reportes.
      if (traslados.length) {
        try {
          await saveTransfers(inquilino, traslados);
        } catch (tErr) {
          console.error("Error registrando traslados del cierre:", tErr);
          setError("La caja se cerró, pero el traslado a banco no se pudo registrar. Regístrelo en Administración → Facturación → Traslados.");
          return;
        }
      }

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

          {/* Base próxima apertura Efectivo (OralDrive style) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Base próxima apertura Efectivo</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">$</span>
              <input
                type="text"
                placeholder="0"
                value={baseProximaDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setBaseProxima(raw);
                  setBaseProximaDisplay(raw ? fmtPure(raw) : "");
                }}
                className="w-full h-9 pl-7 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Traslado a Bancos / Cajas (OralDrive 1:1) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-700 block">Seleccione bancos o caja a donde desea ingresar el dinero de la caja</span>
                <span className="text-[10px] text-slate-400">Traslada el saldo contado hacia la cuenta bancaria de la clínica</span>
              </div>
              <button
                type="button"
                onClick={handleAddDestino}
                className="px-2.5 py-1 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <FiPlus size={12} /> Adicionar banco
              </button>
            </div>

            {destinosTraslado.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-200">
                {destinosTraslado.map((dest, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    <select
                      value={dest.banco}
                      onChange={(e) => handleUpdateDestino(idx, "banco", e.target.value)}
                      className="flex-1 h-8 px-2 text-[11px] border border-slate-200 rounded text-slate-700 outline-none focus:border-blue-500 bg-white"
                    >
                      {bancosList.map((b, bi) => (
                        <option key={bi} value={b}>{b}</option>
                      ))}
                    </select>

                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold">$</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={dest.valorDisplay}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          handleUpdateDestino(idx, "valor", Number(raw || 0));
                          handleUpdateDestino(idx, "valorDisplay", raw ? fmtPure(raw) : "");
                        }}
                        className="w-full h-8 pl-5 pr-2 text-[11px] font-bold border border-slate-200 rounded text-slate-800 outline-none focus:border-blue-500 font-mono text-right"
                      />
                    </div>

                    <select
                      value={dest.medio}
                      onChange={(e) => handleUpdateDestino(idx, "medio", e.target.value)}
                      className="w-28 h-8 px-2 text-[11px] border border-slate-200 rounded text-slate-700 outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Nequi/Daviplata">Nequi/Daviplata</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveDestino(idx)}
                      className="w-7 h-7 flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-xs cursor-pointer border border-rose-200 transition-colors"
                      title="Eliminar destino"
                    >
                      <FiMinus size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
