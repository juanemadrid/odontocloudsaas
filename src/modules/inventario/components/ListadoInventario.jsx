import React, { useState } from "react";
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Search toolbar */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar en el inventario..."
            className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-5 py-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Conceptos: {items.length}</span>
        </div>
      </div>

      {/* Inventory list Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Nombre</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4">Referencia</th>
                <th className="px-6 py-4 text-center">Stock Actual</th>
                <th className="px-6 py-4 text-center">Mínimo</th>
                <th className="px-6 py-4 text-center pr-8 w-40">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando inventario...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center text-slate-400 italic">
                    No hay productos en inventario que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isLow = (item.cantidad || 0) <= (item.minimo || 5);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-slate-800 uppercase tracking-tight">{item.nombre}</span>
                          {item.marca && <span className="text-[10px] font-bold text-slate-400 uppercase">{item.marca}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-450 uppercase">{item.categoria || "Sin categoría"}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">{item.referencia || "—"}</td>
                      <td className={`px-6 py-4 text-center font-black font-mono text-[14px] ${isLow ? "text-rose-500" : "text-slate-800"}`}>
                        {item.cantidad} <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unidad || "unidades"}</span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-500 font-bold">{item.minimo || 5}</td>
                      <td className="px-6 py-4 text-center pr-8">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-rose-100">
                            <FiAlertTriangle size={10} /> Bajo Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100">
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
