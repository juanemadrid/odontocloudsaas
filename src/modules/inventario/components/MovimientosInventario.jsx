import React, { useState, useEffect } from "react";
import { FiSearch, FiCalendar, FiArrowUpRight, FiArrowDownLeft, FiSliders } from "react-icons/fi";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
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
      const snap = await getDocs(query(collection(db, "registro_movimientos_inventario"), where("inquilino", "==", inquilino)));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort newest first
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || new Date(a.fecha || 0).getTime() / 1000;
        const tB = b.createdAt?.seconds || new Date(b.fecha || 0).getTime() / 1000;
        return tB - tA;
      });
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Search toolbar */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar en el historial de movimientos..."
            className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={loadLogs}
          className="h-10 px-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-black uppercase tracking-widest transition-all"
        >
          Actualizar
        </button>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4 pl-8">Fecha</th>
                <th className="px-6 py-4">Concepto / Insumo</th>
                <th className="px-6 py-4 text-center">Tipo Movimiento</th>
                <th className="px-6 py-4 text-center">Cantidad</th>
                <th className="px-6 py-4">Responsable</th>
                <th className="px-6 py-4 pr-8">Detalles / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando movimientos...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center text-slate-400 italic">
                    No se encontraron registros de movimientos.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isIngress = log.tipo === "Recepción";
                  const isEgress = log.tipo === "Salida";
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-4 pl-8 font-semibold text-slate-500 font-mono">{log.fecha}</td>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">{log.itemNombre}</td>
                      <td className="px-6 py-4 text-center">
                        {isIngress ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider border border-emerald-100">
                            <FiArrowDownLeft size={11} /> Recepción
                          </span>
                        ) : isEgress ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider border border-rose-100">
                            <FiArrowUpRight size={11} /> Salida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-wider border border-blue-100">
                            <FiSliders size={11} /> Ajuste
                          </span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-center font-black font-mono text-[14px] ${isIngress ? "text-emerald-600" : isEgress ? "text-rose-500" : "text-blue-600"}`}>
                        {isIngress ? "+" : isEgress ? "-" : ""}{log.cantidad}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500 uppercase">{log.responsable || "—"}</td>
                      <td className="px-6 py-4 pr-8 text-slate-400 font-medium max-w-xs truncate" title={log.notas}>
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
