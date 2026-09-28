import React from "react";
import { FiX, FiPrinter, FiCheckCircle, FiClock, FiFileText, FiUser, FiCalendar, FiDollarSign } from "react-icons/fi";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
};

export default function LiquidacionViewerModal({ liquidacion, onClose, onPagar, onAnular }) {
  if (!liquidacion) return null;

  const handlePrint = () => {
    window.print();
  };

  const isGenerada = liquidacion.estado === "Generada" || liquidacion.estado === "Pendiente";
  const isPagada = liquidacion.estado === "Pagada" || liquidacion.estado === "Pagado";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
              isPagada ? "bg-emerald-600 shadow-emerald-200" : "bg-purple-600 shadow-purple-200"
            }`}>
              <FiFileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                  Liquidación de Honorarios #{liquidacion.id?.slice(-6) || "000"}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isPagada ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-purple-50 text-purple-700 border border-purple-100"
                }`}>
                  {liquidacion.estado}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Profesional: <strong className="text-slate-700">{liquidacion.profesionalNombre}</strong> | Período: {liquidacion.fechaInicio} al {liquidacion.fechaFin}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="h-9 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Imprimir"
            >
              <FiPrinter size={14} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Content scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar print:p-0">
          
          {/* Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Procedimientos</span>
              <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{fmt(liquidacion.totalRecaudado || liquidacion.totalItemsValor)}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Comisión (%)</span>
              <span className="text-sm font-black text-purple-600 font-mono mt-0.5 block">
                {liquidacion.comisionPorcentaje ? `${liquidacion.comisionPorcentaje}%` : "Personalizada"} ({fmt(liquidacion.comisionesTotal)})
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gastos / Bonos / Deduc.</span>
              <span className="text-xs font-bold text-slate-600 mt-1 block">
                -{fmt(liquidacion.totalGastos)} / +{fmt(liquidacion.totalBonificaciones)} / -{fmt(liquidacion.totalDeducciones)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Neto Pagado</span>
              <span className="text-base font-black text-emerald-600 font-mono mt-0.5 block">{fmt(liquidacion.totalPagar)}</span>
            </div>
          </div>

          {/* Table of Liquidated Items */}
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
              Ítems Clínicos Realizados ({liquidacion.items?.length || 0})
            </h4>
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Procedimiento / Ítem</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4 text-center">Fecha Realizado</th>
                    <th className="py-3 px-4 text-right">Valor Ítem</th>
                    <th className="py-3 px-4 text-center">Tipo</th>
                    <th className="py-3 px-4 text-right">A Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(liquidacion.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30">
                      <td className="py-2.5 px-4 font-black text-slate-700">{it.pacienteNombre || "Paciente"}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-600">{it.prestacion || "Procedimiento"}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{it.planTitulo || "—"}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500 font-medium">{formatDate(it.fechaRealizado)}</td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-700">{fmt(it.valorPrestacion || it.valorRecaudado)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                          it.tipoLiquidacion === "fijo" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-purple-50 text-purple-600 border border-purple-100"
                        }`}>
                          {it.tipoLiquidacion === "fijo" ? "Valor Fijo" : `${it.porcentaje || liquidacion.comisionPorcentaje}%`}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">{fmt(it.valorAPagar)}</td>
                    </tr>
                  ))}
                  {(!liquidacion.items || liquidacion.items.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No hay detalle individual registrado para esta liquidación histórica.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Adjustments: Gastos, Bonificaciones, Deducciones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Gastos (Laboratorio u otros) */}
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gastos / Laboratorio</span>
              {(liquidacion.gastos || []).length === 0 ? (
                <p className="text-[11px] font-medium text-slate-400 italic">Sin gastos registrados.</p>
              ) : (
                <div className="space-y-1.5">
                  {liquidacion.gastos.map((g, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">{g.desc}</span>
                      <span className="text-rose-600 font-black font-mono">-{fmt(g.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bonificaciones */}
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bonificaciones</span>
              {(liquidacion.bonificaciones || []).length === 0 ? (
                <p className="text-[11px] font-medium text-slate-400 italic">Sin bonificaciones.</p>
              ) : (
                <div className="space-y-1.5">
                  {liquidacion.bonificaciones.map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">{b.desc}</span>
                      <span className="text-emerald-600 font-black font-mono">+{fmt(b.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deducciones */}
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Deducciones</span>
              {(liquidacion.deducciones || []).length === 0 ? (
                <p className="text-[11px] font-medium text-slate-400 italic">Sin deducciones.</p>
              ) : (
                <div className="space-y-1.5">
                  {liquidacion.deducciones.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">{d.desc}</span>
                      <span className="text-rose-600 font-black font-mono">-{fmt(d.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Payment Info if paid */}
          {isPagada && (
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <FiCheckCircle className="text-emerald-600" size={16} />
                <span>Liquidación pagada el {formatDate(liquidacion.fechaPago || liquidacion.created_at)}</span>
              </div>
              <div className="text-slate-500 font-medium">
                {liquidacion.pagoProveedorId && (
                  <span>Egreso Asociado: <strong className="text-slate-700 font-mono">#{liquidacion.pagoProveedorId}</strong></span>
                )}
                {liquidacion.pagadoPor && (
                  <span className="ml-3">Registrado por: <strong>{liquidacion.pagadoPor}</strong></span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-black uppercase tracking-wider transition-all"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-3">
            {isGenerada && onAnular && (
              <button
                onClick={() => onAnular(liquidacion)}
                className="h-10 px-5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-wider transition-all"
              >
                Anular Liquidación
              </button>
            )}

            {isGenerada && onPagar && (
              <button
                onClick={() => onPagar(liquidacion)}
                className="h-10 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
              >
                Pagar Liquidación
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
