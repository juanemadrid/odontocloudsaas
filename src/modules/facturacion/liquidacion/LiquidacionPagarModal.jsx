import React, { useState, useEffect } from "react";
import { FiX, FiCreditCard, FiCheckCircle } from "react-icons/fi";
import { getConfigSection } from "../../../services/configPersistenceService";
import supabase from "../../../lib/supabaseClient";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function LiquidacionPagarModal({ liquidacion, tenantId, onClose, onConfirm, loading }) {
  const [origenes, setOrigenes] = useState([]);
  const [origenId, setOrigenId] = useState("");
  const [medioPago, setMedioPago] = useState("Transferencia");

  useEffect(() => {
    const loadBanks = async () => {
      if (!tenantId) return;
      try {
        const [cfgBancos, cfgCajas, cajaRows] = await Promise.all([
          getConfigSection(tenantId, "bancos", []).catch(() => []),
          getConfigSection(tenantId, "cajas", []).catch(() => []),
          supabase.from("cajas").select("*").eq("tenant_id", tenantId).eq("estado", "abierta")
            .then(({ data, error }) => error ? [] : (data || [])).catch(() => []),
        ]);
        const mergedCajas = new Map();
        [...(Array.isArray(cfgCajas) ? cfgCajas : []), ...cajaRows].forEach((c) => {
          if (c?.id) mergedCajas.set(String(c.id), { ...(mergedCajas.get(String(c.id)) || {}), ...c });
        });
        const cajasAbiertas = [...mergedCajas.values()].filter((c) =>
          String(c.estado || "").toLowerCase() === "abierta" && !c.fecha_cierre && !c.fechaCierre
        );
        const cajas = cajasAbiertas.map((c) => {
          const nombre = c.nombre || c.usuario_nombre || c.usuarioNombre || "Caja abierta";
          return { id: `caja:${c.id}`, tipo: "caja", cajaId: c.id, bancoCaja: nombre, label: `Caja - ${nombre}` };
        });
        const bancos = (Array.isArray(cfgBancos) ? cfgBancos : [])
          .map((b) => typeof b === "string" ? b : (b.nombre || b.nombreBanco || b.banco))
          .filter(Boolean)
          .map((nombre) => ({ id: `banco:${nombre}`, tipo: "banco", cajaId: null, bancoCaja: nombre, label: nombre }));
        const fallbackBancos = bancos.length ? bancos : ["Bancolombia", "Davivienda", "BBVA"]
          .map((nombre) => ({ id: `banco:${nombre}`, tipo: "banco", cajaId: null, bancoCaja: nombre, label: nombre }));
        const options = [...cajas, ...fallbackBancos];
        setOrigenes(options);
        setOrigenId(options[0]?.id || "");
      } catch (_) {}
    };
    loadBanks();
  }, [tenantId]);

  if (!liquidacion) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
              <FiCreditCard size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                Pagar Liquidación
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Generar comprobante de egreso y pago médico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block">Doctor / Profesional</span>
              <strong className="text-sm font-black text-slate-800">{liquidacion.profesionalNombre}</strong>
              <span className="text-xs text-slate-400 block mt-0.5">Período: {liquidacion.fechaInicio} al {liquidacion.fechaFin}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block">Total a Pagar</span>
              <strong className="text-xl font-black text-purple-700">{fmt(liquidacion.totalPagar)}</strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">
              Caja o Banco de Origen *
            </label>
            <select
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              className="w-full h-11 px-4 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {origenes.map((origen) => (
                <option key={origen.id} value={origen.id}>{origen.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">
              Medio de Pago *
            </label>
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              className="w-full h-11 px-4 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="Transferencia">Transferencia Bancaria</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Cheque">Cheque</option>
              <option value="Nequi">Nequi</option>
              <option value="Daviplata">Daviplata</option>
            </select>
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            💡 Al confirmar, el sistema generará el egreso y lo registrará automáticamente en la caja seleccionada; si eliges un banco, quedará asociado al banco. El estado pasará a <strong className="text-emerald-600">Pagada</strong>.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs font-black uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const origen = origenes.find((item) => item.id === origenId);
              if (origen) onConfirm({ bancoCaja: origen.bancoCaja, cajaId: origen.cajaId, medioPago });
            }}
            disabled={loading || !origenId}
            className="h-10 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Confirmar y Pagar"}
          </button>
        </div>

      </div>
    </div>
  );
}
