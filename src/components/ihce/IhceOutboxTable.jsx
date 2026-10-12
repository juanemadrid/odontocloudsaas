import React, { useState } from 'react';
import { Send, CheckCircle2, XCircle, Clock, RefreshCw, Search, FileText, ChevronRight } from 'lucide-react';

export default function IhceOutboxTable({ items = [], onRetry, isRetrying }) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'ALL' || item.status === filter;
    const matchesSearch = !search || 
      item.paciente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      item.paciente_documento?.includes(search) ||
      item.radicado_oficial?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACEPTADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Aceptado
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" /> Rechazado
          </span>
        );
      case 'ERROR_REINTENTO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" /> En Reintento
          </span>
        );
      case 'ERROR_DEFINITIVO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-900">
            <XCircle className="w-3.5 h-3.5 mr-1 text-red-700" /> Fallido Definitivo
          </span>
        );
      case 'PROCESANDO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-blue-600 animate-spin" /> Procesando
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filtros de Pestaña */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ERROR_REINTENTO'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {f === 'ALL' ? 'Todos' : f === 'ERROR_REINTENTO' ? 'Reintentos' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente, documento o radicado..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <th className="py-3 px-4">Paciente</th>
              <th className="py-3 px-4">Estado Radicación</th>
              <th className="py-3 px-4">Radicado Oficial</th>
              <th className="py-3 px-4">Intentos</th>
              <th className="py-3 px-4">Última Actualización</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                  No se encontraron documentos RDA en la cola para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{item.paciente_nombre || 'Paciente Sintético'}</div>
                    <div className="text-[11px] text-slate-400">{item.paciente_documento || 'CC 1018234567'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    {item.radicado_oficial ? (
                      <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold">
                        {item.radicado_oficial}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="font-semibold">{item.intentos || 0}</span> / {item.max_intentos || 5}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {new Date(item.updated_at || item.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium inline-flex items-center"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> Detalle
                    </button>
                    {(item.status === 'ERROR_REINTENTO' || item.status === 'RECHAZADO') && onRetry && (
                      <button
                        onClick={() => onRetry(item.id)}
                        disabled={isRetrying}
                        className="px-2.5 py-1 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors font-medium inline-flex items-center"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalle */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Detalle de Transmisión IHCE</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div><strong>ID de Cola:</strong> {selectedItem.id}</div>
                <div><strong>Estado:</strong> {selectedItem.status}</div>
                <div><strong>HTTP Status:</strong> {selectedItem.ultimo_http_status || 'N/A'}</div>
                <div><strong>Radicado:</strong> {selectedItem.radicado_oficial || 'Pendiente'}</div>
                <div className="col-span-2"><strong>Clave de Idempotencia:</strong> <span className="font-mono text-[10px] break-all">{selectedItem.idempotency_key}</span></div>
              </div>

              {selectedItem.ultimo_error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                  <strong>Detalle del Error / Rechazo:</strong>
                  <p className="mt-1 font-mono text-[11px]">{selectedItem.ultimo_error}</p>
                </div>
              )}

              {selectedItem.detalle_respuesta && (
                <div>
                  <strong className="block mb-1">Respuesta del Mecanismo Nacional:</strong>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[10px] font-mono max-h-48">
                    {JSON.stringify(selectedItem.detalle_respuesta, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
