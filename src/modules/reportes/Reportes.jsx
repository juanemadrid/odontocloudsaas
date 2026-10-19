// src/modules/reportes/Reportes.jsx
// ============================================================
// 📊 Módulo de Reportes - OdontoCloud
// Vista compacta del Menú de Reportes que cabe en una sola pantalla.
// Al seleccionar un reporte, se oculta el menú y se muestra el reporte
// a pantalla completa (100% ancho).
// ============================================================
import React, { useState, useEffect, useMemo } from "react";
import { 
  FiPieChart, FiUsers, FiFileText, FiDollarSign, FiAward, 
  FiTrendingUp, FiBox, FiGift, FiActivity, 
  FiList, FiClock, FiAlertTriangle, FiMessageSquare, 
  FiMonitor, FiHelpCircle, FiDatabase, FiArrowLeft, FiChevronRight
} from "react-icons/fi";
import { usePermissions } from "../../hooks/usePermissions";

import Indicadores from "./views/Indicadores";
import ReportePacientes from "./views/ReportePacientes";
import ReportePlanesTratamiento from "./views/ReportePlanesTratamiento";
import ReporteFinanciero from "./views/ReporteFinanciero";
import ReporteConvenios from "./views/ReporteConvenios";
import ReporteVentasEfectividad from "./views/ReporteVentasEfectividad";
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

import ReportsMenu, { ALL_REPORTS } from "./ReportsMenu";

export default function Reportes() {
  const { can } = usePermissions();
  const [selectedReport, setSelectedReport] = useState(null);

  const filteredReports = useMemo(() => {
    return ALL_REPORTS.filter(r => {
      if (!r.perm) return true;
      return can("Reportes", r.perm, "consultar");
    });
  }, [can]);

  useEffect(() => {
    if (selectedReport && !filteredReports.some(r => r.id === selectedReport)) {
      setSelectedReport(null);
    }
  }, [selectedReport, filteredReports]);

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
          </div>

          {/* Vista del reporte a pantalla completa */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-[#f4f7fb]">
            {selectedReport === "indicadores" && <Indicadores />}
            {selectedReport === "pacientes" && <ReportePacientes />}
            {selectedReport === "planes_tratamiento" && <ReportePlanesTratamiento />}
            {selectedReport === "facturacion" && <ReporteFinanciero />}
            {selectedReport === "convenios" && <ReporteConvenios />}
            {selectedReport === "ventas_efectividad" && <ReporteVentasEfectividad />}
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
        <ReportsMenu filteredReports={filteredReports} setSelectedReport={setSelectedReport} />
      )}
    </div>
  );
}
