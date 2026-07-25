import React, { useState } from "react";
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header toolbar */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar..."
            className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={onNew}
          className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
        >
          <FiPlus className="mr-1.5" size={14} />
          Nuevo producto
        </button>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Nombre</th>
                <th className="px-6 py-4">Marca</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4 text-center pr-8 w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando productos...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-400 italic">
                    No se encontraron productos registrados.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-4 font-black text-slate-800 uppercase tracking-tight">{item.nombre}</td>
                    <td className="px-6 py-4 font-bold text-slate-400 uppercase">{item.marca || "—"}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{item.descripcion || "—"}</td>
                    <td className="px-6 py-4 text-center pr-8 flex items-center justify-center gap-2">
                      <button 
                        onClick={() => onEdit(item)}
                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                        title="Editar"
                      >
                        <FiEdit2 size={13} />
                      </button>
                      <button 
                        onClick={() => onDelete(item.id)}
                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm"
                        title="Eliminar"
                      >
                        <FiTrash2 size={13} />
                      </button>
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
