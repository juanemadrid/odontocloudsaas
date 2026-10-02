// src/modules/administracion/components/ResetContabilidadModal.jsx
import React, { useState } from "react";
import { FiAlertTriangle, FiTrash2, FiX, FiCheckCircle } from "react-icons/fi";
import { purgeTestAccountingData } from "../../../services/accountingPurgeService";
import { toast } from "sonner";

export default function ResetContabilidadModal({ isOpen, onClose, tenantId, clinicName }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await purgeTestAccountingData(tenantId);
      toast.success("¡Datos contables de prueba eliminados con éxito! La clínica ha quedado en ceros.");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error("Error al reiniciar contabilidad:", err);
      toast.error("Ocurrió un error al limpiar los registros contables.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn font-sans">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 text-2xl">
            <FiAlertTriangle />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-slate-800 leading-snug">
              Limpiar Información Contable de Prueba
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Clínica: <span className="font-bold text-slate-700">{clinicName || "Clínica Dental Sincelejo"}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body info */}
        <div className="px-6 py-3 text-xs text-slate-600 space-y-3">
          <p className="leading-relaxed">
            Esta acción eliminará de forma segura los <strong>movimientos contables de prueba</strong> registrados para dejar la clínica en blanco para su operación real:
          </p>
          <ul className="space-y-1.5 pl-2">
            <li className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Todos los <strong>Recibos de Caja</strong></span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Todos los <strong>Pagos a Proveedores y Egresos</strong></span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Historial de pagos y abonos de pacientes</span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Saldos a favor (vuelven a $0)</span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Movimientos de caja (los saldos vuelven a su base inicial)</span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Contadores de consecutivos reiniciados desde el <strong>1</strong></span>
            </li>
          </ul>

          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-start gap-2.5">
            <FiCheckCircle className="shrink-0 mt-0.5 text-emerald-600" size={15} />
            <span className="text-[11px] leading-tight">
              <strong>100% Seguro:</strong> NO se borrarán pacientes, ni odontogramas, ni historias clínicas, ni doctores, ni configuraciones del sistema.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer border-0 bg-transparent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Limpiando datos...</span>
              </>
            ) : (
              <>
                <FiTrash2 size={14} />
                <span>Sí, reiniciar contabilidad</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
