import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Building2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  Settings,
  Activity,
  FileText,
  AlertCircle
} from "lucide-react";
import { ihceClientService } from "../../services/ihce/ihceClientService.js";
import { useToast } from "../../context/ToastContext";

export default function IhceSuperAdminPanel() {
  const toast = useToast();
  const [tenantsList, setTenantsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAmbiente, setFilterAmbiente] = useState("TODOS");

  // Modal para detalle o auditoría de clínica
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await ihceClientService.getAllTenantsIhceStatus();
      setTenantsList(data || []);
    } catch (err) {
      console.error("Error al cargar estado IHCE de clínicas:", err);
      toast?.showToast?.("Error al cargar la información IHCE de clínicas.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Métricas globales
  const totalClinicas = tenantsList.length;
  const configuradas = tenantsList.filter(t => t.configured).length;
  const preproduccion = tenantsList.filter(t => t.ambiente === 'PRUEBAS_MINSALUD').length;
  const produccion = tenantsList.filter(t => t.ambiente === 'PRODUCCION').length;
  const totalRadicados = tenantsList.reduce((acc, t) => acc + (t.stats?.aceptados || 0), 0);
  const totalPendientes = tenantsList.reduce((acc, t) => acc + (t.stats?.pendientes || 0), 0);

  // Filtrado
  const filteredTenants = tenantsList.filter(t => {
    const matchesSearch = t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.nit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.repsCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAmbiente = filterAmbiente === "TODOS" || t.ambiente === filterAmbiente;
    return matchesSearch && matchesAmbiente;
  });

  return (
    <div className="space-y-6">
      {/* Banner Informativo */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 bg-blue-600/20 border border-blue-400/30 rounded-2xl">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-black tracking-tight text-white">Supervisión Central IHCE — MinSalud</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Ley 2015 / Res 1888
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Monitoreo multi-inquilino de conexiones hacia el Mecanismo Nacional de Interoperabilidad de Historia Clínica Electrónica.
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition-all disabled:opacity-50 self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Clínicas Registradas</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{totalClinicas}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Con IHCE Configurado</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{configuradas}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Preproducción</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{preproduccion}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Producción</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{produccion}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">RDAs Radicados</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{totalRadicados}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cola Pendiente</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{totalPendientes}</p>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por clínica, NIT o código REPS..."
            className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Ambiente:</span>
          <select
            value={filterAmbiente}
            onChange={(e) => setFilterAmbiente(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Todos los ambientes</option>
            <option value="SANDBOX_MOCK">Simulador Local (Mock)</option>
            <option value="PRUEBAS_MINSALUD">Preproducción (MinSalud)</option>
            <option value="PRODUCCION">Producción Oficial</option>
          </select>
        </div>
      </div>

      {/* Tabla de Clínicas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Clínica / Prestador</th>
                <th className="py-3 px-4">Código REPS</th>
                <th className="py-3 px-4">Ambiente</th>
                <th className="py-3 px-4">Estado IHCE</th>
                <th className="py-3 px-4 text-center">RDAs Radicados</th>
                <th className="py-3 px-4 text-center">Cola Outbox</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Cargando estado de interoperabilidad...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No se encontraron clínicas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.tenantId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{t.nombre}</div>
                      <div className="text-[11px] text-slate-400">NIT: {t.nit}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {t.repsCode !== 'No configurado' ? (
                        <span>{t.repsCode} <span className="text-slate-400 text-[10px]">({t.sedeCode})</span></span>
                      ) : (
                        <span className="text-slate-400 italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.ambiente === 'PRODUCCION' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          PRODUCCIÓN
                        </span>
                      ) : t.ambiente === 'PRUEBAS_MINSALUD' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          PREPRODUCCIÓN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          SIMULADOR LOCAL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.isActive ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activo</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pendiente</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {t.stats?.aceptados || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(t.stats?.pendientes || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {t.stats.pendientes} encolados
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedTenant(t);
                          setModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-all inline-flex items-center space-x-1"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Detalles</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle y Auditoría */}
      {modalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="font-bold text-sm leading-tight">{selectedTenant.nombre}</h4>
                  <p className="text-[11px] text-slate-400">Auditoría y Estado de Interoperabilidad IHCE</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Código REPS</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTenant.repsCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Sede Oficial</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTenant.sedeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Ambiente</span>
                  <span className="font-semibold text-slate-800">{selectedTenant.ambiente}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Despacho Automático</span>
                  <span className="font-semibold text-slate-800">{selectedTenant.autoDispatch ? 'Habilitado' : 'Manual'}</span>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <h5 className="text-xs font-bold text-slate-700 flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <span>Resumen de Transmisiones RDA (Transactional Outbox)</span>
                </h5>
                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="text-lg font-black text-emerald-700 block">{selectedTenant.stats?.aceptados || 0}</span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Radicados</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <span className="text-lg font-black text-amber-700 block">{selectedTenant.stats?.pendientes || 0}</span>
                    <span className="text-[10px] font-bold text-amber-600 uppercase">En Cola</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                    <span className="text-lg font-black text-rose-700 block">{selectedTenant.stats?.errores || 0}</span>
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Reintentos</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Custodia Criptográfica:</strong> Las credenciales oficiales de cada clínica residen cifradas en reposo con sobre AES-256-GCM. Ningún secreto se expone en este panel de auditoría.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
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
