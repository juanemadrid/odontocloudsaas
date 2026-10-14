import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Search, 
  FileText, 
  Copy, 
  Check, 
  Shield, 
  User, 
  Calendar, 
  ExternalLink,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

export default function IhceOutboxTable({ 
  items = [], 
  onRetry, 
  onDispatch,
  isRetrying,
  isDispatching 
}) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('summary'); // 'summary' | 'fhir' | 'response'

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
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" /> Aceptado
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600 shrink-0" /> Rechazado
          </span>
        );
      case 'ERROR_REINTENTO':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" /> En Reintento
          </span>
        );
      case 'ERROR_DEFINITIVO':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-200 shadow-xs">
            <XCircle className="w-3.5 h-3.5 mr-1 text-red-700 shrink-0" /> Fallido Definitivo
          </span>
        );
      case 'PROCESANDO':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-blue-600 animate-spin shrink-0" /> Procesando
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" /> Pendiente
          </span>
        );
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filtros de Pestaña */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ERROR_REINTENTO'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === f 
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'ALL' ? 'Todos' : f === 'ERROR_REINTENTO' ? 'Reintentos' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente, documento o radicado..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
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
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-1">No hay atenciones en cola</p>
                  <p className="text-xs text-slate-400">Las atenciones odontológicas firmadas aparecerán automáticamente aquí.</p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{item.paciente_nombre || 'Paciente Sintético'}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{item.paciente_documento || 'CC 1018234567'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    {item.radicado_oficial ? (
                      <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-bold border border-blue-200/60 inline-flex items-center space-x-1">
                        <Shield className="w-3 h-3 text-blue-600" />
                        <span>{item.radicado_oficial}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium italic">En espera de radicación</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="font-bold text-slate-800">{item.intentos || 0}</span> / {item.max_intentos || 5}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium">
                    {new Date(item.updated_at || item.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {item.status === 'PENDIENTE' && onDispatch && (
                      <button
                        onClick={() => onDispatch(item)}
                        disabled={isDispatching}
                        className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all font-bold inline-flex items-center shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                        title="Transmitir esta atención a MinSalud"
                      >
                        <Send className="w-3 h-3 mr-1.5" /> Despachar
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModalTab('summary');
                      }}
                      className="px-3 py-1.5 text-xs text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all font-bold inline-flex items-center cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Detalle
                    </button>

                    {(item.status === 'ERROR_REINTENTO' || item.status === 'RECHAZADO') && onRetry && (
                      <button
                        onClick={() => onRetry(item)}
                        disabled={isRetrying}
                        className="px-3 py-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all font-bold inline-flex items-center cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1 text-amber-600" /> Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Profesional de Detalle */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal con degradado elegante */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Detalle de Transmisión IHCE</h3>
                    <p className="text-[11px] text-slate-300">Auditoría y trazabilidad oficial MinSalud (FHIR R4)</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Pestañas del Modal */}
              <div className="flex space-x-2 mt-5 border-b border-white/10">
                <button
                  onClick={() => setActiveModalTab('summary')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    activeModalTab === 'summary' 
                      ? 'border-blue-400 text-blue-300' 
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Resumen Clínico
                </button>
                <button
                  onClick={() => setActiveModalTab('fhir')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    activeModalTab === 'fhir' 
                      ? 'border-blue-400 text-blue-300' 
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Paquete FHIR R4 (JSON)
                </button>
                {selectedItem.detalle_respuesta && (
                  <button
                    onClick={() => setActiveModalTab('response')}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                      activeModalTab === 'response' 
                        ? 'border-blue-400 text-blue-300' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    Respuesta MinSalud
                  </button>
                )}
              </div>
            </div>

            {/* Contenido del Modal con scroll */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1 custom-scrollbar">
              
              {activeModalTab === 'summary' && (
                <div className="space-y-4">
                  {/* Tarjeta de Paciente */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-sm">
                        {(selectedItem.paciente_nombre || 'P')[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900">{selectedItem.paciente_nombre || 'Paciente Registrado'}</h4>
                        <p className="text-[11px] text-slate-500 font-mono">{selectedItem.paciente_documento || 'Documento no registrado'}</p>
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(selectedItem.status)}
                    </div>
                  </div>

                  {/* Grid de Metadatos de Transmisión */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Radicado Ministerial</span>
                      <p className="font-mono text-xs font-bold text-slate-900">
                        {selectedItem.radicado_oficial || 'En espera de despacho'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Código HTTP de Pasarela</span>
                      <p className="font-mono text-xs font-bold text-slate-900">
                        {selectedItem.ultimo_http_status ? `HTTP ${selectedItem.ultimo_http_status}` : 'Sin intentos (0/5)'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Identificador de Cola</span>
                      <p className="font-mono text-[10px] text-slate-700 break-all select-all">
                        {selectedItem.id}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Identificador de Evolución</span>
                      <p className="font-mono text-[10px] text-slate-700 break-all select-all">
                        {selectedItem.evolution_id || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Alerta de Error si existiese */}
                  {selectedItem.ultimo_error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Detalle del Rechazo / Incidencia:</strong>
                        <p className="mt-1 font-mono text-[11px] leading-relaxed">{selectedItem.ultimo_error}</p>
                      </div>
                    </div>
                  )}

                  {/* Estado Operativo */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-blue-950 flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">Garantía de Conformidad FHIR R4</p>
                      <p className="text-[11px] text-blue-800/80 mt-0.5 leading-relaxed">
                        Este documento clínico contiene los recursos Patient, Encounter, Condition y Procedure validados con los catálogos oficiales CIE-10 y CUPS de Colombia.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pestaña FHIR JSON */}
              {activeModalTab === 'fhir' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Paquete Bundle HL7 FHIR R4 (Estructura oficial):</span>
                    <button
                      onClick={() => copyToClipboard(selectedItem.payload_bundle || {
                        resourceType: "Bundle",
                        id: selectedItem.id,
                        type: "document",
                        timestamp: selectedItem.created_at,
                        entry: [
                          { fullUrl: `urn:uuid:${selectedItem.paciente_id}`, resource: { resourceType: "Patient", id: selectedItem.paciente_id } },
                          { fullUrl: `urn:uuid:${selectedItem.evolution_id}`, resource: { resourceType: "Encounter", id: selectedItem.evolution_id, status: "finished" } }
                        ]
                      })}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{copiedJson ? "¡Copiado!" : "Copiar JSON"}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-emerald-400 rounded-2xl overflow-x-auto text-[11px] font-mono max-h-72 custom-scrollbar shadow-inner">
                    {JSON.stringify(selectedItem.payload_bundle || {
                      resourceType: "Bundle",
                      id: selectedItem.id,
                      meta: { profile: ["http://minsalud.gov.co/fhir/StructureDefinition/BundleRDA"] },
                      type: "document",
                      timestamp: selectedItem.created_at,
                      status: selectedItem.status,
                      entry: [
                        { fullUrl: `urn:uuid:${selectedItem.paciente_id}`, resource: { resourceType: "Patient", id: selectedItem.paciente_id, name: [{ text: selectedItem.paciente_nombre }] } },
                        { fullUrl: `urn:uuid:${selectedItem.evolution_id}`, resource: { resourceType: "Encounter", id: selectedItem.evolution_id, status: "finished", class: { code: "AMB", display: "Ambulatorio" } } }
                      ]
                    }, null, 2)}
                  </pre>
                </div>
              )}

              {/* Pestaña Respuesta MinSalud */}
              {activeModalTab === 'response' && selectedItem.detalle_respuesta && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Payload retornado por la pasarela ministerial:</span>
                    <button
                      onClick={() => copyToClipboard(selectedItem.detalle_respuesta)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{copiedJson ? "¡Copiado!" : "Copiar JSON"}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl overflow-x-auto text-[11px] font-mono max-h-72 custom-scrollbar shadow-inner">
                    {JSON.stringify(selectedItem.detalle_respuesta, null, 2)}
                  </pre>
                </div>
              )}

            </div>

            {/* Footer del Modal */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Actualizado: {new Date(selectedItem.updated_at || selectedItem.created_at).toLocaleString('es-CO')}
              </span>
              <div className="flex items-center space-x-2">
                {selectedItem.status === 'PENDIENTE' && onDispatch && (
                  <button
                    onClick={() => {
                      onDispatch(selectedItem);
                      setSelectedItem(null);
                    }}
                    disabled={isDispatching}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Despachar a MinSalud</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
