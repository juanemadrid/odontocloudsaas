import React from "react";
import { FiSearch, FiAlertTriangle } from "react-icons/fi";

export default function ListadoInventario({ items, loading, searchTerm, setSearchTerm }) {
  const filtered = items.filter(item => {
    const t = searchTerm.toLowerCase();
    return (
      (item.nombre || "").toLowerCase().includes(t) ||
      (item.referencia || "").toLowerCase().includes(t) ||
      (item.categoria || "").toLowerCase().includes(t)
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
            placeholder="Buscar en el inventario..."
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#7cb342]" />
          <span className="text-[11px] font-semibold text-slate-600">Total: {items.length}</span>
        </div>
      </div>

      {/* Inventory list Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                <th className="py-2.5 px-4">Nombre</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Referencia</th>
                <th className="py-2.5 px-3 text-center">Stock Actual</th>
                <th className="py-2.5 px-3 text-center">Mínimo</th>
                <th className="py-2.5 px-3 text-center w-28">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-slate-400">Cargando inventario...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 italic text-xs">
                    No hay productos en inventario que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isLow = (item.cantidad || 0) <= (item.minimo || 5);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.nombre}</span>
                          {item.marca && <span className="text-[10px] text-slate-400 font-medium">{item.marca}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600">{item.categoria || "Sin categoría"}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{item.referencia || "—"}</td>
                      <td className={`py-2.5 px-3 text-center font-bold font-mono ${isLow ? "text-rose-600" : "text-slate-800"}`}>
                        {item.cantidad} <span className="text-[10px] text-slate-400 font-normal">{item.unidad || "unidades"}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600">{item.minimo || 5}</td>
                      <td className="py-2.5 px-3 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold border border-rose-200">
                            <FiAlertTriangle size={10} /> Bajo Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-200">
                            Disponible
                          </span>
                        )}
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
