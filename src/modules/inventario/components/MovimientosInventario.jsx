import React, { useState, useEffect } from "react";
import { FiSearch, FiCalendar, FiArrowUpRight, FiArrowDownLeft, FiSliders } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

export default function MovimientosInventario() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadLogs = async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      let list = [];
      try {
        const { data } = await supabase
          .from("registro_movimientos_inventario")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false });
        if (data && data.length > 0) list = data;
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.registro_movimientos_inventario || [];
      }

      setLogs(list);
    } catch (e) {
      console.error("Error loading movement logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [inquilino]);

  const filteredLogs = logs.filter(log => {
    const q = searchTerm.toLowerCase();
    return (
      (log.itemNombre || "").toLowerCase().includes(q) ||
      (log.tipo || "").toLowerCase().includes(q) ||
      (log.responsable || "").toLowerCase().includes(q) ||
      (log.notas || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
      {/* Header Search toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input 
            type="text" 
            placeholder="Buscar en el historial de movimientos..."
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={loadLogs}
          className="h-8 px-3.5 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          Actualizar
        </button>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Concepto / Insumo</th>
                <th className="py-2.5 px-3 text-center">Tipo movimiento</th>
                <th className="py-2.5 px-3 text-center">Cantidad</th>
                <th className="py-2.5 px-3">Responsable</th>
                <th className="py-2.5 px-3">Detalles / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-slate-400">Cargando movimientos...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 italic text-xs">
                    No se encontraron registros de movimientos.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isIngress = log.tipo === "Recepción";
                  const isEgress = log.tipo === "Salida";
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{log.fecha}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{log.itemNombre}</td>
                      <td className="py-2.5 px-3 text-center">
                        {isIngress ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-200">
                            <FiArrowDownLeft size={10} /> Recepción
                          </span>
                        ) : isEgress ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold border border-rose-200">
                            <FiArrowUpRight size={10} /> Salida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-200">
                            <FiSliders size={10} /> Ajuste
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-center font-bold font-mono ${isIngress ? "text-emerald-600" : isEgress ? "text-rose-600" : "text-blue-600"}`}>
                        {isIngress ? "+" : isEgress ? "-" : ""}{log.cantidad}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">{log.responsable || "—"}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-normal max-w-xs truncate" title={log.notas}>
                        {log.notas || (log.motivo ? `Salida por: ${log.motivo}` : "—")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
