import React, { useState } from "react";
import { db } from "../../../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
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
      // 1. Validar si ya existe una caja abierta para este usuario
      const q = query(
        collection(db, "cajas"),
        where("inquilino", "==", inquilino),
        where("usuarioId", "==", form.userId),
        where("estado", "==", "abierta")
      );
      
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setError("Ya tienes una caja abierta. Debes cerrar la anterior antes de abrir una nueva.");
        setSaving(false);
        return;
      }

      const base = parseFloat(String(form.ajustarBase).replace(/[^0-9]/g, "")) || 0;

      await addDoc(collection(db, "cajas"), {
        inquilino,
        nombre: form.nombreCaja.trim(),
        tipo: "efectivo",
        baseInicial: base,
        saldoInicial: base,
        saldoActual: base,
        estado: "abierta",
        esCierreSimulado: false,
        observacion: form.observacion.trim(),
        usuarioId: form.userId,
        usuarioNombre: form.userName,
        fechaApertura: serverTimestamp(),
        movimientos: [],
      });
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
        className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FiBriefcase size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Abrir Caja</h3>
              <p className="text-[11px] text-slate-500 font-medium">Iniciar nuevo turno operativo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-left">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2 text-rose-700 text-[12px] font-medium">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* User & Box Identity */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Usuario responsable
              </label>
              <div className="w-full h-9 px-3 flex items-center bg-blue-50/60 border border-blue-100 rounded-lg text-[12px] font-semibold text-blue-800 relative justify-between">
                <div className="flex items-center gap-2">
                  <FiUser className="text-blue-500" size={14} />
                  <span>{form.userName}</span>
                </div>
                <span className="text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">Sesión</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Identificador del Punto de Venta *
              </label>
              <div className="relative">
                <FiLayout className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Ej: Recepción, Punto Principal..."
                  value={form.nombreCaja}
                  onChange={(e) => setForm({ ...form, nombreCaja: e.target.value })}
                  className="w-full h-9 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Base actual */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Base actual
              </label>
              <div className="h-9 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500">
                $ 0
              </div>
            </div>

            {/* Ajustar base */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Ajustar base inicial *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">$</span>
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
                  className="w-full h-9 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Observaciones del turno
            </label>
            <textarea
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              rows={2}
              placeholder="Ej: Inicio de jornada, turno tarde..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-[12px] text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

