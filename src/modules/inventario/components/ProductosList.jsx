import React from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";

export default function ProductosList({ items, loading, searchTerm, setSearchTerm, onNew, onEdit, onDelete }) {
  const filtered = items.filter(item => {
    const t = searchTerm.toLowerCase();
    return (
      (item.nombre || "").toLowerCase().includes(t) ||
      (item.referencia || "").toLowerCase().includes(t) ||
      (item.descripcion || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input 
            type="text" 
            placeholder="Buscar producto..."
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={onNew}
          className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
        >
          <FiPlus size={13} />
          Nuevo producto
        </button>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                <th className="py-2.5 px-4">Nombre</th>
                <th className="py-2.5 px-3">Marca</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-3 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-slate-400">Cargando productos...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-16 text-center text-slate-400 italic text-xs">
                    No se encontraron productos registrados.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-800">{item.nombre}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-500">{item.marca || "—"}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-normal">{item.descripcion || "—"}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => onEdit(item)}
                          className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                          title="Editar"
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button 
                          onClick={() => onDelete(item.id)}
                          className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                          title="Eliminar"
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
