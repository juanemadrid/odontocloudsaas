// src/modules/reportes/Reportes.jsx
// ============================================================
// 📊 Módulo de Reportes - OdontoCloud
// Vista compacta del Menú de Reportes que cabe en una sola pantalla.
// Al seleccionar un reporte, se oculta el menú y se muestra el reporte
// a pantalla completa (100% ancho).
// ============================================================
import React, { useState, useEffect } from "react";
import { 
  FiPieChart, FiUsers, FiFileText, FiDollarSign, FiAward, 
  FiTrendingUp, FiBox, FiGift, FiActivity, 
  FiList, FiClock, FiAlertTriangle, FiMessageSquare, 
  FiMonitor, FiHelpCircle, FiDatabase, FiArrowLeft, FiGrid, FiChevronRight
} from "react-icons/fi";

import Indicadores from "./views/Indicadores";
import ReportePacientes from "./views/ReportePacientes";
import ReportePlanesTratamiento from "./views/ReportePlanesTratamiento";
import ReporteFinanciero from "./views/ReporteFinanciero";
import ReporteConvenios from "./views/ReporteConvenios";
import ReporteVentasEfectividad from "./views/ReporteVentasEfectividad";
import ReporteMedicamentos from "./views/ReporteMedicamentos";
import ReporteCumpleanos from "./views/ReporteCumpleanos";
import ReporteOportunidadCitas from "./views/ReporteOportunidadCitas";
import ReporteMorbilidad from "./views/ReporteMorbilidad";
import ReporteConsultas from "./views/ReporteConsultas";
import ReporteEvoluciones from "./views/ReporteEvoluciones";
import ReporteLogErroresFacturacion from "./views/ReporteLogErroresFacturacion";
import ReporteLogWhatsApp from "./views/ReporteLogWhatsApp";
import ReporteUsoPlataforma from "./views/ReporteUsoPlataforma";
import ReporteAsistenciaClientes from "./views/ReporteAsistenciaClientes";
import ReporteLogInteroperabilidad from "./views/ReporteLogInteroperabilidad";
import ReporteClinico from "./views/ReporteClinico";
import ReporteSistema from "./views/ReporteSistema";
import ReporteIA from "./views/ReporteIA";

const ALL_REPORTS = [
  { id: "indicadores", label: "Indicadores", icon: <FiPieChart />, category: "General" },
  { id: "pacientes", label: "Reporte pacientes", icon: <FiUsers />, category: "General" },
  { id: "planes_tratamiento", label: "Reporte planes de tratamiento", icon: <FiFileText />, category: "General" },
  { id: "facturacion", label: "Reporte de facturación", icon: <FiDollarSign />, category: "Finanzas" },
  { id: "convenios", label: "Reporte de convenios", icon: <FiAward />, category: "Finanzas" },
  { id: "ventas_efectividad", label: "Reporte de ventas y efectividad", icon: <FiTrendingUp />, category: "Finanzas" },
  { id: "medicamentos", label: "Reporte medicamentos", icon: <FiBox />, category: "Clínico" },
  { id: "cumpleanos", label: "Reporte cumpleaños", icon: <FiGift />, category: "General" },
  { id: "oportunidad_citas", label: "Reporte de oportunidad de citas", icon: <FiClock />, category: "Clínico" },
  { id: "morbilidad", label: "Reporte de morbilidad", icon: <FiActivity />, category: "Clínico" },
  { id: "consultas", label: "Reporte de consultas", icon: <FiList />, category: "Clínico" },
  { id: "evoluciones", label: "Reporte de evoluciones", icon: <FiClock />, category: "Clínico" },
  { id: "log_errores_facturacion", label: "Log de errores de facturación", icon: <FiAlertTriangle />, category: "Logs & Sistema" },
  { id: "log_whatsapp", label: "Log WhatsApp Business API", icon: <FiMessageSquare />, category: "Logs & Sistema" },
  { id: "uso_plataforma", label: "Uso de la plataforma", icon: <FiMonitor />, category: "Logs & Sistema" },
  { id: "asistencia_clientes", label: "Asistencia de clientes", icon: <FiHelpCircle />, category: "Logs & Sistema" },
  { id: "log_ihce", label: "Log interoperabilidad (IHCE)", icon: <FiDatabase />, category: "Logs & Sistema" },
];

export default function Reportes() {
  const [selectedReport, setSelectedReport] = useState(null);

  // Escuchar reset desde el menú lateral principal (al dar clic en REPORTES)
  useEffect(() => {
    const handleReset = () => {
      setSelectedReport(null);
    };
    window.addEventListener("reset-module-reportes", handleReset);
    return () => window.removeEventListener("reset-module-reportes", handleReset);
  }, []);

  const getReportTitle = (id) => {
    const found = ALL_REPORTS.find(r => r.id === id);
    return found ? found.label : "Reporte";
  };

  return (
    <div className="flex flex-col bg-slate-50 h-[calc(100vh-60px)] overflow-hidden">
      
      {/* ─── CASO 1: REPORTE SELECCIONADO (PANTALLA COMPLETA 100% ANCHO) ─── */}
      {selectedReport ? (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-50 overflow-hidden">
          
          {/* Top Bar de navegación del reporte activo */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[12px] font-bold transition-all border border-slate-200 cursor-pointer"
                title="Volver a la lista de reportes"
              >
                <FiArrowLeft size={14} /> Menú de reportes
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-[14px] font-bold text-slate-800">
                {getReportTitle(selectedReport)}
              </span>
            </div>
            
            <button
              onClick={() => setSelectedReport(null)}
              className="text-[12px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 cursor-pointer border-0 bg-transparent"
            >
              <FiGrid size={14} /> Cambiar reporte
            </button>
          </div>

          {/* Vista del reporte a pantalla completa */}
          <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-5">
            {selectedReport === "indicadores" && <Indicadores />}
            {selectedReport === "pacientes" && <ReportePacientes />}
            {selectedReport === "planes_tratamiento" && <ReportePlanesTratamiento />}
            {selectedReport === "facturacion" && <ReporteFinanciero />}
            {selectedReport === "convenios" && <ReporteConvenios />}
            {selectedReport === "ventas_efectividad" && <ReporteVentasEfectividad />}
            {selectedReport === "medicamentos" && <ReporteMedicamentos />}
            {selectedReport === "cumpleanos" && <ReporteCumpleanos />}
            {selectedReport === "oportunidad_citas" && <ReporteOportunidadCitas />}
            {selectedReport === "morbilidad" && <ReporteMorbilidad />}
            {selectedReport === "consultas" && <ReporteConsultas />}
            {selectedReport === "evoluciones" && <ReporteEvoluciones />}
            {selectedReport === "log_errores_facturacion" && <ReporteLogErroresFacturacion />}
            {selectedReport === "log_whatsapp" && <ReporteLogWhatsApp />}
            {selectedReport === "uso_plataforma" && <ReporteUsoPlataforma />}
            {selectedReport === "asistencia_clientes" && <ReporteAsistenciaClientes />}
            {selectedReport === "log_ihce" && <ReporteLogInteroperabilidad />}
            {selectedReport === "clinico" && <ReporteClinico />}
            {selectedReport === "sistema" && <ReporteSistema />}
            {selectedReport === "ia" && <ReporteIA />}
          </div>
        </div>

      ) : (

        /* ─── CASO 2: MENÚ DE REPORTES COMPACTO (ALINEADO A LA ALTURA DE ADMINISTRACIÓN) ─── */
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
              {ALL_REPORTS.length} Reportes disponibles
            </span>
          </div>

          {/* Grid Compacto de Opciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {ALL_REPORTS.map((item) => (
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
      )}
    </div>
  );
}
