import React, { useState } from "react";
import supabase from "../../../lib/supabaseClient";
import { FiUser, FiX, FiCheck, FiLayout, FiBriefcase } from "react-icons/fi";

const fmtPure = (n) => new Intl.NumberFormat("es-CO").format(n);

export default function AbrirCajaModal({ inquilino, userProfile, onClose, onSuccess }) {
  const [form, setForm] = useState({
    userId: userProfile?.uid || "",
    userName: userProfile?.nombre || userProfile?.email || "Usuario",
    nombreCaja: "Caja Principal",
    baseActual: 0,
    ajustarBase: "",
    ajustarBaseDisplay: "",
    observacion: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.userId) {
      setError("No se detectó un usuario válido en la sesión.");
      return;
    }
    if (!form.nombreCaja.trim()) {
      setError("Indica un nombre o identificador para este punto de venta.");
      return;
    }
    
    setSaving(true);
    setError("");

    try {
      const inq = inquilino || userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId || userProfile?.tenant?.inquilino || userProfile?.tenant?.id || "";
      const uId = form.userId || userProfile?.uid || userProfile?.id || "";

      // 1. Validar si ya existe una caja abierta para este usuario
      let openCajas = [];
      try {
        const { data: snap } = await supabase
          .from("cajas")
          .select("*")
          .eq("tenant_id", inq)
          .eq("estado", "abierta");
        if (snap && snap.length > 0) {
          openCajas = snap.filter(c => (c.usuario_id || c.usuarioId) === uId);
        }
      } catch (e) {}

      if (openCajas.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inq)
          .maybeSingle();
        const cfgCajas = cfgRow?.config?.cajas || [];
        openCajas = cfgCajas.filter(c => (c.estado || "").toLowerCase() === "abierta" && (c.usuario_id || c.usuarioId) === uId);
      }

      if (openCajas.length > 0) {
        setError("Ya tienes una caja abierta. Debes cerrar la anterior antes de abrir una nueva.");
        setSaving(false);
        return;
      }

      const base = parseFloat(String(form.ajustarBase).replace(/[^0-9]/g, "")) || 0;
      const cajaId = crypto.randomUUID ? crypto.randomUUID() : `caja_${Date.now()}`;
      const fechaIso = new Date().toISOString();

      const cajaObj = {
        id: cajaId,
        tenant_id: inq,
        nombre: form.nombreCaja.trim(),
        tipo: "efectivo",
        base_inicial: base,
        saldo_inicial: base,
        saldo_actual: base,
        total_ingresos: 0,
        total_egresos: 0,
        estado: "abierta",
        observacion: form.observacion.trim(),
        usuario_id: uId,
        usuario_nombre: form.userName,
        fecha_apertura: fechaIso,
        created_at: fechaIso,
        baseInicial: base,
        saldoInicial: base,
        saldoActual: base,
        usuarioId: uId,
        usuarioNombre: form.userName,
        fechaApertura: fechaIso
      };

      const dbPayload = {
        id: cajaId,
        tenant_id: inq,
        estado: "abierta",
        usuario_id: uId,
        fecha_apertura: fechaIso,
        created_at: fechaIso
      };

      try {
        await supabase.from("cajas").insert([dbPayload]);
      } catch (e) {}

      // Sincronizar en website_config
      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();

        const currentConfig = cfgRow?.config || {};
        const currentList = Array.isArray(currentConfig.cajas) ? currentConfig.cajas : [];
        const updatedList = [cajaObj, ...currentList.filter(c => c.id !== cajaId)];

        await supabase.from("website_config").upsert(
          { tenant_id: inquilino, config: { ...currentConfig, cajas: updatedList } },
          { onConflict: "tenant_id" }
        );
      } catch (e) {}

      onSuccess?.();
    } catch (err) {
      console.error("Error abriendo caja:", err);
      setError("No se pudo abrir la caja. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FiBriefcase size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Abrir Caja</h3>
              <p className="text-[11px] text-slate-500 font-medium">Iniciar nuevo turno u operación de punto de venta</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-left">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* User & Box Identity */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Usuario Responsable
              </label>
              <div className="w-full h-9 px-3 flex items-center bg-blue-50/60 border border-blue-100 rounded-lg text-xs font-semibold text-blue-800 relative justify-between">
                <div className="flex items-center gap-2">
                  <FiUser className="text-blue-500" size={14} />
                  <span>{form.userName}</span>
                </div>
                <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">Sesión</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Nombre de Caja / Punto de Venta <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <FiLayout className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Ej: Recepción, Caja Principal..."
                  value={form.nombreCaja}
                  onChange={(e) => setForm({ ...form, nombreCaja: e.target.value })}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Base actual */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Base Actual
              </label>
              <div className="h-9 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 font-mono">
                $ 0
              </div>
            </div>

            {/* Ajustar base */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Ajustar Base Inicial <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                <input
                  type="text"
                  placeholder="0"
                  value={form.ajustarBaseDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setForm({ 
                      ...form, 
                      ajustarBase: raw, 
                      ajustarBaseDisplay: raw ? fmtPure(raw) : "" 
                    });
                  }}
                  className="w-full h-9 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Observaciones del Turno
            </label>
            <textarea
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              rows={2}
              placeholder="Ej: Inicio de jornada, turno tarde..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white border border-slate-200 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-[#8cc33f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border-0 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiCheck size={15} />
                  <span>Abrir Caja</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

