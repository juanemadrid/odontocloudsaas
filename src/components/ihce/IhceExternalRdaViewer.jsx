import React, { useState } from 'react';
import { Search, Building, UserCheck, Stethoscope, AlertOctagon, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { IhceExternalRdaService } from '../../services/ihce/ihceExternalRdaService.js';

export default function IhceExternalRdaViewer({ defaultDocumento = '' }) {
  const [documento, setDocumento] = useState(defaultDocumento);
  const [rdas, setRdas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const rdaService = new IhceExternalRdaService();

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!documento.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const results = await rdaService.fetchExternalRdasByPatient('CC', documento.trim());
      setRdas(results);
    } catch (err) {
      console.error('Error al consultar RDAs externos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Buscador de Paciente en Red IHCE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-1">Consulta de Antecedentes en Red Nacional IHCE</h3>
        <p className="text-xs text-slate-500 mb-4">
          Acceda a los Resúmenes Digitales de Atención (RDA) generados por otras instituciones de salud para este paciente.
        </p>

        <form onSubmit={handleSearch} className="flex gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="Número de documento del paciente..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5"
          >
            <span>{isLoading ? 'Consultando...' : 'Consultar Red'}</span>
          </button>
        </form>
      </div>

      {/* Resultados de la Consulta */}
      {hasSearched && (
        <div className="space-y-4">
          {rdas.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-sm">
              No se encontraron registros de atención externos para el documento suministrado en la red IHCE.
            </div>
          ) : (
            rdas.map((rda) => (
              <div key={rda.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
                {/* Header de la Atención Externa */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{rda.institucionEmisora}</h4>
                      <p className="text-[11px] text-slate-500">REPS Emisor: <span className="font-mono font-medium">{rda.repsEmisor}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(rda.fecha).toLocaleDateString('es-CO', { dateStyle: 'long' })}</span>
                  </div>
                </div>

                {/* Contenido Clínico */}
                <div className="p-5 space-y-4 text-xs">
                  {/* Profesional Tratante y Modalidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-medium">Profesional Externo:</span>
                      <strong className="text-slate-800">{rda.profesional.nombre}</strong> ({rda.profesional.especialidad})
                      <div className="text-[11px] text-slate-500">{rda.profesional.registroMedico}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Modalidad de Atención:</span>
                      <strong className="text-slate-800">{rda.atencion.modalidad}</strong>
                    </div>
                  </div>

                  {/* Alertas y Alergias si existen */}
                  {rda.atencion.alergiasAdvertencias?.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                        <AlertOctagon className="w-4 h-4 text-rose-600" />
                        <span>Advertencias Clínicas Reportadas:</span>
                      </div>
                      {rda.atencion.alergiasAdvertencias.map((alerta, idx) => (
                        <p key={idx} className="pl-5 text-[11px]">• {alerta}</p>
                      ))}
                    </div>
                  )}

                  {/* Diagnósticos CIE-10 */}
                  <div>
                    <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-[11px]">
                      Diagnósticos Registrados (CIE-10):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {rda.atencion.diagnosticos.map((diag, idx) => (
                        <div key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
                          <strong className="font-mono mr-1.5 text-indigo-700">{diag.codigo}</strong> {diag.descripcion}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Procedimientos CUPS */}
                  <div>
                    <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-[11px]">
                      Procedimientos Ejecutados (CUPS):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {rda.atencion.procedimientos.map((proc, idx) => (
                        <div key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900 text-xs">
                          <strong className="font-mono mr-1.5 text-emerald-700">{proc.codigo}</strong> {proc.descripcion}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumen de la Evolución */}
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[11px]">
                      Notas y Conducta Clínica:
                    </span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                      "{rda.atencion.evolucionClinica}"
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
