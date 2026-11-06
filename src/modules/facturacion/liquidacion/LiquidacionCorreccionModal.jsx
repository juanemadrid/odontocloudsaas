import React, { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiX } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { getConfigSection } from "../../../services/configPersistenceService";

const fmt = (value) => Number(value || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function LiquidacionCorreccionModal({ liquidacion, tenantId, onClose, onConfirm, loading }) {
  const [cajas, setCajas] = useState([]);
  const [cajaId, setCajaId] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [motivo, setMotivo] = useState("Procedimiento marcado como realizado por error; no fue ejecutado.");

  useEffect(() => {
    let active = true;
    const loadCajas = async () => {
      try {
        const [cfg, result] = await Promise.all([
          getConfigSection(tenantId, "cajas", []).catch(() => []),
          supabase.from("cajas").select("*").eq("tenant_id", tenantId).eq("estado", "abierta"),
        ]);
        const map = new Map();
        [...(Array.isArray(cfg) ? cfg : []), ...(result.data || [])].forEach((c) => {
          if (c?.id) map.set(String(c.id), { ...(map.get(String(c.id)) || {}), ...c });
        });
        const opened = [...map.values()].filter((c) => String(c.estado || "").toLowerCase() === "abierta" && !c.fecha_cierre && !c.fechaCierre);
        if (active) {
          setCajas(opened);
          const preferred = liquidacion.cajaId || liquidacion.caja_id || opened[0]?.id;
          setCajaId(preferred ? String(preferred) : "");
        }
      } catch (_) {
        if (active) setCajas([]);
      }
    };
    loadCajas();
    return () => { active = false; };
  }, [tenantId, liquidacion.id]);

  const selectedItem = (liquidacion.items || []).find((item, index) => String(item.key || item.id || index) === String(itemKey));
  const removedCommission = selectedItem
    ? Number(selectedItem.valorAPagar ?? Math.round(Number(selectedItem.valorPrestacion || selectedItem.valorRecaudado || 0) * Number(selectedItem.porcentaje || liquidacion.comisionPorcentaje || 0) / 100))
    : 0;
  const nuevoNeto = useMemo(() => Math.max(0, Number(liquidacion.totalPagar || 0) - removedCommission), [liquidacion.totalPagar, removedCommission]);

  if (!liquidacion) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-800">Corrección interna de liquidación</h3>
            <p className="text-xs text-slate-500">Se conservará el consecutivo y el vínculo con el egreso.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><FiX /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex gap-2">
            <FiAlertTriangle className="shrink-0 mt-0.5" />
            <span>Selecciona únicamente el procedimiento que no se realizó. El egreso y el movimiento de caja se ajustarán al nuevo neto pagado.</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(liquidacion.items || []).map((item, index) => {
              const key = String(item.key || item.id || index);
              const amount = Number(item.valorAPagar ?? Math.round(Number(item.valorPrestacion || item.valorRecaudado || 0) * Number(item.porcentaje || liquidacion.comisionPorcentaje || 0) / 100));
              return (
                <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${itemKey === key ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="item-correccion" checked={itemKey === key} onChange={() => setItemKey(key)} className="mt-1 accent-rose-600" />
                  <span className="flex-1 text-xs">
                    <strong className="block text-slate-800">{item.pacienteNombre || "Paciente"} · {item.prestacion || "Procedimiento"}</strong>
                    <span className="text-slate-500">Procedimiento {fmt(item.valorPrestacion || item.valorRecaudado)} · Comisión {fmt(amount)}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Caja que entregó el pago</label>
            <select value={cajaId} onChange={(e) => setCajaId(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs" disabled={cajas.length === 0}>
              {cajas.length === 0 ? <option value="">No hay una caja abierta para asociar el movimiento</option> : cajas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre || c.usuario_nombre || c.usuarioNombre || "Caja abierta"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Motivo de la corrección</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="w-full p-2.5 rounded-lg border border-slate-200 text-xs" />
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex justify-between text-xs">
            <span>Valor actual {fmt(liquidacion.totalPagar)} → valor corregido <strong className="text-emerald-700">{fmt(nuevoNeto)}</strong></span>
            <span>Reducción {fmt(removedCommission)}</span>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold">Cancelar</button>
          <button onClick={() => onConfirm({ itemKey, cajaId, motivo })} disabled={loading || !selectedItem || !cajaId || !motivo.trim()} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
            <FiCheckCircle /> {loading ? "Guardando…" : "Confirmar corrección"}
          </button>
        </div>
      </div>
    </div>
  );
}
