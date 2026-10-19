import React from "react";
import { FiPieChart, FiUsers, FiFileText, FiDollarSign, FiAward, FiTrendingUp, FiGift, FiActivity, FiList, FiClock, FiAlertTriangle, FiMessageSquare, FiMonitor, FiHelpCircle, FiDatabase, FiChevronRight } from "react-icons/fi";
export const ALL_REPORTS = [
  { id: "indicadores", label: "Indicadores", icon: <FiPieChart />, category: "General", perm: "Reporte Dashboard" },
  { id: "pacientes", label: "Reporte pacientes", icon: <FiUsers />, category: "General", perm: "Reporte Pacientes" },
  { id: "planes_tratamiento", label: "Reporte planes de tratamiento", icon: <FiFileText />, category: "General", perm: "Reporte Planes de tratamiento" },
  { id: "facturacion", label: "Reporte de facturación", icon: <FiDollarSign />, category: "Finanzas", perm: "Reporte Facturacion" },
  { id: "convenios", label: "Reporte de convenios", icon: <FiAward />, category: "Finanzas", perm: "Reporte Convenios" },
  { id: "ventas_efectividad", label: "Reporte de ventas y efectividad", icon: <FiTrendingUp />, category: "Finanzas", perm: "Reporte ventas y efectividad" },
  { id: "clinico", label: "Reporte clínico", icon: <FiActivity />, category: "Clínico", perm: "Reporte Clínico" },
  { id: "cumpleanos", label: "Reporte cumpleaños", icon: <FiGift />, category: "General", perm: "Reporte Cumpleaños" },
  { id: "oportunidad_citas", label: "Reporte de oportunidad de citas", icon: <FiClock />, category: "Clínico", perm: "Reporte de oportunidad de citas" },
  { id: "morbilidad", label: "Reporte de morbilidad", icon: <FiActivity />, category: "Clínico", perm: "Reporte Morbilidad" },
  { id: "consultas", label: "Reporte de consultas", icon: <FiList />, category: "Clínico", perm: "Reporte Consultas" },
  { id: "evoluciones", label: "Reporte de evoluciones", icon: <FiClock />, category: "Clínico", perm: "Reporte evoluciones" },
  { id: "log_errores_facturacion", label: "Log de errores de facturación", icon: <FiAlertTriangle />, category: "Logs & Sistema", perm: "Log de errores de facturacion" },
  { id: "log_whatsapp", label: "Log WhatsApp Business API", icon: <FiMessageSquare />, category: "Logs & Sistema", perm: "Log WhatsApp Business API" },
  { id: "uso_plataforma", label: "Uso de la plataforma", icon: <FiMonitor />, category: "Logs & Sistema", perm: "Indicadores de uso de la plataforma" },
  { id: "asistencia_clientes", label: "Asistencia de clientes", icon: <FiHelpCircle />, category: "Logs & Sistema", perm: "Asistencia de clientes" },
  { id: "log_ihce", label: "Log interoperabilidad (IHCE)", icon: <FiDatabase />, category: "Logs & Sistema", perm: "Log Interoperabilidad (IHCE)" },
];
export default function ReportsMenu({filteredReports = ALL_REPORTS, setSelectedReport = () => {}}) { return (
        <div className="p-4 max-w-6xl mx-auto space-y-3 w-full animate-in fade-in duration-200">
          {/* Header Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FiPieChart size={16} />
              </div>
              <div>
                <h1 className="text-[14px] font-bold text-slate-800 tracking-tight">Menú de Reportes</h1>
                <p className="text-[11px] text-slate-500 font-medium">Haz clic en cualquier reporte para abrirlo a pantalla completa</p>
              </div>
            </div>

            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              {filteredReports.length} Reportes disponibles
            </span>
          </div>

          {/* Grid Compacto de Opciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredReports.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedReport(item.id)}
                className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:shadow-sm hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group gap-2 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0 transition-transform group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white">
                    {item.icon}
                  </div>
                  <span className="text-[12px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors uppercase truncate">
                    {item.label}
                  </span>
                </div>
                <FiChevronRight size={15} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
); }
