import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import {
  FiSearch,
  FiFileText,
  FiFilter,
  FiEye,
  FiX,
  FiDownload,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiUser,
  FiCopy,
  FiCheck,
  FiRefreshCw,
  FiCalendar,
  FiLayers
} from "react-icons/fi";
import { format, isValid } from "date-fns";
import * as XLSX from "xlsx";
import { getAuditEvents } from "../../../services/reportDataService";

/**
 * Mapea la acción técnica de Factus a un nombre legible en español y estilo visual
 */
function mapFactusAction(actionStr) {
  const act = (actionStr || "").toLowerCase();
  if (act.includes("support") || act.includes("soporte")) {
    return {
      tipo: "Documento Soporte Electrónico",
      badge: "bg-purple-50 text-purple-700 border-purple-200"
    };
  }
  if (act.includes("credit_note") || act.includes("nota_credito")) {
    return {
      tipo: "Nota Crédito Electrónica",
      badge: "bg-amber-50 text-amber-700 border-amber-200"
    };
  }
  if (act.includes("attached") || act.includes("zip") || act.includes("download")) {
    return {
      tipo: "Descarga Contenedor DIAN",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200"
    };
  }
  if (act.includes("validate")) {
    return {
      tipo: "Validación DIAN",
      badge: "bg-blue-50 text-blue-700 border-blue-200"
    };
  }
  if (act.includes("bill") || act.includes("factura")) {
    return {
      tipo: "Factura Electrónica de Venta",
      badge: "bg-sky-50 text-sky-700 border-sky-200"
    };
  }
  return {
    tipo: actionStr ? actionStr.replace(/_/g, " ").toUpperCase() : "Facturación Electrónica",
    badge: "bg-slate-50 text-slate-700 border-slate-200"
  };
}

/**
 * Extrae de forma inteligente el consecutivo del documento desde el error o los detalles
 */
function extractConsecutivoFromError(errorText, details) {
  if (details.consecutivo) return String(details.consecutivo).toUpperCase();
  if (details.billNumber) return String(details.billNumber).toUpperCase();
  if (details.number) return String(details.number).toUpperCase();
  if (details.reference_code) return String(details.reference_code).toUpperCase();
  if (details.documento && details.documento !== "—") return String(details.documento).toUpperCase();

  if (typeof errorText === "string") {
    // Patrones típicos de facturación colombiana: FCEV-0012, FE-01, SETP990000000, DS-100, etc.
    const match = errorText.match(/([A-Z]{2,6}[-_]?[0-9]{1,10})/i);
    if (match) return match[1].toUpperCase();
  }
  return "—";
}

/**
 * Genera una sugerencia técnica de solución según el mensaje de error de Factus / DIAN
 */
function getErrorResolutionGuide(errorText) {
  const err = (errorText || "").toLowerCase();
  if (err.includes("numbering_range_id")) {
    return {
      causa: "El ID de rango de numeración DIAN es inválido o no existe en la cuenta de Factus.",
      solucion: "Vaya a Administración → Facturación → Configuración Factus y verifique que el rango de numeración esté activo y asignado correctamente."
    };
  }
  if (err.includes("discount_rate")) {
    return {
      causa: "La tasa de descuento de uno de los ítems es superior al 100% o tiene formato incorrecto.",
      solucion: "Verifique la factura antes de enviar y asegúrese de que el porcentaje de descuento esté entre 0 y 100."
    };
  }
  if (err.includes("no se encontró el documento")) {
    return {
      causa: "Factus no encontró el documento consultado con ese consecutivo.",
      solucion: "Verifique si el consecutivo fue emitido previamente en la DIAN o si se eliminó en el proveedor tecnológico."
    };
  }
  if (err.includes("0948 no esta habilitado") || err.includes("fev-rips")) {
    return {
      causa: "La modalidad FEV-RIPS de salud (Resolución 0948) requiere habilitación en su suscripción Factus.",
      solucion: "Comuníquese con soporte de Factus para verificar que el perfil de salud con campos FEV-RIPS esté habilitado en su cuenta."
    };
  }
  return {
    causa: "Respuesta de rechazo devuelta por el servidor de Factus / DIAN.",
    solucion: "Revise el detalle técnico completo del mensaje para corregir los campos requeridos en la factura."
  };
}

export default function ReporteLogErroresFacturacion() {
  const { userProfile } = useAuth();
  const [logList, setLogList] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de la cabecera (Fecha inicial, Fecha final, Oficina)
  const [fechaInicial, setFechaInicial] = useState("2026-02-25");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("Todas las oficinas");

  const [hasSearched, setHasSearched] = useState(false);

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2026-02-25",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "Todas las oficinas"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Modal para ver detalle completo del error
  const [selectedLogModal, setSelectedLogModal] = useState(null);
  const [copiedError, setCopiedError] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaHora: true,
    tipoDocumento: true,
    consecutivo: true,
    pacienteTercero: true,
    operador: true,
    sucursal: true,
    statusHttp: true,
    documentosAsociados: true,
    acciones: true
  });

  const columnLabels = {
    fechaHora: "Fecha y Hora",
    tipoDocumento: "Tipo de Documento",
    consecutivo: "Consecutivo / Ref",
    pacienteTercero: "Paciente / Tercero",
    operador: "Operador / Usuario",
    sucursal: "Sucursal / Sede",
    statusHttp: "Estado HTTP",
    documentosAsociados: "Detalle del Error DIAN / Factus",
    acciones: "Acciones"
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchLogData = async () => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenant?.id;
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Cargar Sucursales reales
      let listSuc = [{ id: "TODAS", nombre: "Todas las oficinas" }];
      try {
        const cfgSuc = await getConfigItems(tenantId, "sucursales", "sucursales");
        if (Array.isArray(cfgSuc) && cfgSuc.length > 0) {
          cfgSuc.forEach(s => {
            const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
            if (name && !listSuc.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
              listSuc.push({ id: s.id, nombre: name });
            }
          });
        }
      } catch (_) {}

      try {
        const { data: dbSuc } = await supabase.from("sucursales").select("*").eq("tenant_id", tenantId);
        (dbSuc || []).forEach(s => {
          const name = s.nombre || s.name;
          if (name && !listSuc.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
            listSuc.push({ id: s.id, nombre: name });
          }
        });
      } catch (_) {}

      if (listSuc.length === 1) {
        listSuc.push({ id: "PRINCIPAL", nombre: "CLINICA DENTAL SINCELEJO - SEDE PRINCIPAL" });
      }
      setSucursalesList(listSuc);

      // 2. Cargar perfiles de usuarios para mapear operador (performed_by)
      let snapProfiles = [];
      try {
        const { data } = await supabase.from("profiles").select("id, full_name, nombre, apellido, email").eq("tenant_id", tenantId);
        if (data) snapProfiles = data;
      } catch (_) {}

      const profMap = {};
      (snapProfiles || []).forEach(u => {
        const nom = u.full_name || `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.email || "Usuario del sistema";
        profMap[u.id] = nom;
      });

      // 3. Cargar Logs de Errores de Facturación (FACTUS_ERROR)
      const snapLogs = await getAuditEvents({
        tenantId,
        actions: ["FACTUS_ERROR"],
        from: appliedFilters.fechaInicial,
        to: appliedFilters.fechaFinal,
        limit: 1000
      });

      const listData = (snapLogs || []).map((log) => {
        const details = log.details || {};
        const dateObj = new Date(log.created_at);
        const rawError = String(details.error || details.message || "Error no especificado").trim();
        const rawAction = String(details.action || "").trim();
        const actionInfo = mapFactusAction(rawAction);
        const consecutivoExtraido = extractConsecutivoFromError(rawError, details);
        const operador = profMap[log.performed_by] || (userProfile?.nombreCompleto || userProfile?.full_name || "Sistema / Factus");
        const statusCode = details.status ? `HTTP ${details.status}` : "HTTP 400";
        const sucursalNombre = details.sucursal || (listSuc[1]?.nombre || "CLINICA DENTAL SINCELEJO - SEDE PRINCIPAL");
        const guide = getErrorResolutionGuide(rawError);

        return {
          id: log.id,
          fechaObj: dateObj,
          fechaStr: format(dateObj, "dd/MM/yyyy"),
          horaStr: format(dateObj, "hh:mm a").toUpperCase(),
          tipoDocumento: details.tipoDocumento || actionInfo.tipo,
          tipoBadge: actionInfo.badge,
          consecutivo: consecutivoExtraido,
          documento: consecutivoExtraido !== "—" ? consecutivoExtraido : (details.documento || details.billNumber || "—"),
          pacienteTercero: details.paciente || details.tercero || details.customer || details.cliente || "Consumidor Final",
          operador: operador,
          documentosAsociados: rawError,
          statusHttp: statusCode,
          statusRaw: details.status || 400,
          actionRaw: rawAction,
          sucursal: sucursalNombre,
          guide: guide,
          detailsRaw: details,
          created_at: log.created_at
        };
      });

      listData.sort((a, b) => b.fechaObj - a.fechaObj);
      setLogList(listData);
      filterData(listData, appliedFilters, "");
      setHasSearched(true);

    } catch (error) {
      console.error("Error cargando log de errores de facturación:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogData();
  }, [userProfile?.inquilino, userProfile?.tenant_id]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(item => {
      // Filtro de Oficina
      if (filters.oficina && filters.oficina !== "Todas las oficinas" && filters.oficina !== "TODAS") {
        const targetOf = filters.oficina.toLowerCase();
        const itemOf = (item.sucursal || "").toLowerCase();
        if (!itemOf.includes(targetOf) && !targetOf.includes(itemOf)) return false;
      }
      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(item => (
        item.consecutivo.toLowerCase().includes(term) ||
        item.tipoDocumento.toLowerCase().includes(term) ||
        item.pacienteTercero.toLowerCase().includes(term) ||
        item.operador.toLowerCase().includes(term) ||
        item.documentosAsociados.toLowerCase().includes(term) ||
        item.statusHttp.toLowerCase().includes(term)
      ));
    }

    setFilteredLogs(result);
  };

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      oficina
    };
    setAppliedFilters(newFilters);
    filterData(logList, newFilters, tableSearchTerm);
  };

  // KPIs
  const totalErrores = useMemo(() => filteredLogs.length, [filteredLogs]);

  const totalFacturas = useMemo(() => {
    return filteredLogs.filter(l => l.tipoDocumento.includes("Factura")).length;
  }, [filteredLogs]);

  const totalDocSoporte = useMemo(() => {
    return filteredLogs.filter(l => l.tipoDocumento.includes("Soporte")).length;
  }, [filteredLogs]);

  const totalErroresRango = useMemo(() => {
    return filteredLogs.filter(l => l.documentosAsociados.toLowerCase().includes("numbering_range") || l.documentosAsociados.toLowerCase().includes("rango")).length;
  }, [filteredLogs]);

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;

    const rows = filteredLogs.map((item, idx) => ({
      "#": idx + 1,
      "Fecha": item.fechaStr,
      "Hora": item.horaStr,
      "Tipo de Documento": item.tipoDocumento,
      "Consecutivo / Ref": item.consecutivo,
      "Paciente / Tercero": item.pacienteTercero,
      "Operador / Usuario": item.operador,
      "Sucursal / Sede": item.sucursal,
      "Estado HTTP": item.statusHttp,
      "Detalle del Error Factus / DIAN": item.documentosAsociados
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ErroresFacturacion");
    XLSX.writeFile(workbook, `Log_Errores_Facturacion_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  const handleCopyError = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedError(true);
    setTimeout(() => setCopiedError(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB (1:1 ESTÁNDAR ODONTOCLOUD) ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200/80 shrink-0 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <FiAlertTriangle size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-800 tracking-tight">Log de Errores de Facturación</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100/70 text-rose-700 border border-rose-200/50">
                Auditoría DIAN / Factus
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>🏠 Reportes</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Log de Errores de Facturación Electrónica</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogData()}
            title="Recargar log de errores"
            className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="h-8 px-3.5 rounded-lg bg-[#009beb] hover:bg-[#0087cd] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <FiDownload size={13} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* ─── CONTENEDOR SCROLLABLE PRINCIPAL ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

        {/* ─── ÁREA DE FILTROS (1:1 ORALDRIVE) ─── */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs shrink-0 print:hidden">
          
          {/* Fila 1: Fecha inicial / Fecha final */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FiCalendar className="text-slate-400" size={12} />
                <span>Fecha inicial</span>
              </label>
              <input
                type="date"
                value={fechaInicial}
                onChange={(e) => setFechaInicial(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                max="9999-12-31"
                min="1900-01-01"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FiCalendar className="text-slate-400" size={12} />
                <span>Fecha final</span>
              </label>
              <input
                type="date"
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                max="9999-12-31"
                min="1900-01-01"
              />
            </div>
          </div>

          {/* Fila 2: Oficina + Botón Buscar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Oficina
              </label>
              <select
                value={oficina}
                onChange={(e) => setOficina(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all uppercase"
              >
                <option value="Todas las oficinas">Todas las oficinas</option>
                {sucursalesList
                  .filter(s => s.id !== "TODAS")
                  .map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <button
                onClick={handleSearchClick}
                disabled={loading}
                className="w-full h-9 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-[0.98] text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FiSearch size={14} />
                <span>Buscar</span>
              </button>
            </div>

          </div>

        </div>

        {/* ─── TARJETAS KPI RESUMEN DE AUDITORÍA ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <FiAlertTriangle size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Errores Registrados
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalErrores}
                </span>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Eventos
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <FiFileText size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Facturas Rechazadas
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalFacturas}
                </span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                  Facturas
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <FiLayers size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Documentos Soporte
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalDocSoporte}
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                  DS
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FiClock size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Fallo por Numeración / DIAN
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalErroresRango}
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  Rangos DIAN
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ─── TABLA DE RESULTADOS DATAGRID (CON ANCHO COMPLETO Y SIN CORTES) ─── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          
          {/* Barra de herramientas */}
          <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Auditoría de Rechazos de Facturación ({filteredLogs.length} eventos)
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                • Periodo: {appliedFilters.fechaInicial} al {appliedFilters.fechaFinal}
              </span>
            </div>

            <div className="flex items-center gap-2 relative">
              {/* Botón Selector de Columnas */}
              <div className="relative">
                <button 
                  title="Selector de columnas" 
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    showColumnSelector 
                      ? 'bg-sky-50 text-sky-700 border-sky-200' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <FiFileText size={14} />
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 top-9 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
                    <div className="text-[11px] font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                      <span>Seleccionar columnas</span>
                      <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {Object.keys(visibleColumns).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns[key]}
                            onChange={() => toggleColumn(key)}
                            className="rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span>{columnLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Buscador rápido */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Buscar consecutivo, error, tercero..."
                  value={tableSearchTerm}
                  onChange={(e) => {
                    setTableSearchTerm(e.target.value);
                    filterData(logList, appliedFilters, e.target.value);
                  }}
                  className="h-8 pl-8 pr-3 w-60 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Tabla con scroll horizontal garantizado y anchos equilibrados */}
          <div className="overflow-x-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-14 text-slate-400">
                <div className="w-7 h-7 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-bold text-slate-600">Cargando log de errores de facturación...</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Consultando eventos de auditoría Factus y DIAN</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <FiCheckCircle size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Sin errores de facturación en este periodo</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                  No se registraron rechazos de la DIAN ni errores de conexión con Factus entre {appliedFilters.fechaInicial} y {appliedFilters.fechaFinal}.
                </p>
                <button
                  onClick={() => {
                    setFechaInicial("2026-01-01");
                    setFechaFinal(format(new Date(), "yyyy-MM-dd"));
                    setOficina("Todas las oficinas");
                    handleSearchClick();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Ampliar rango de fechas
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
                <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fechaHora && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap w-36">
                        Fecha y Hora
                      </th>
                    )}
                    {visibleColumns.tipoDocumento && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[170px]">
                        Tipo de Documento
                      </th>
                    )}
                    {visibleColumns.consecutivo && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap w-32 font-mono">
                        Consecutivo / Ref
                      </th>
                    )}
                    {visibleColumns.pacienteTercero && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[160px]">
                        Paciente / Tercero
                      </th>
                    )}
                    {visibleColumns.operador && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[150px]">
                        Operador
                      </th>
                    )}
                    {visibleColumns.statusHttp && (
                      <th className="px-3 py-2.5 border-r border-slate-200/70 text-center whitespace-nowrap w-24">
                        Estado HTTP
                      </th>
                    )}
                    {visibleColumns.documentosAsociados && (
                      <th className="px-4 py-2.5 border-r border-slate-200/70 min-w-[280px]">
                        Detalle del Error DIAN / Factus
                      </th>
                    )}
                    {visibleColumns.sucursal && (
                      <th className="px-3 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[160px]">
                        Sucursal
                      </th>
                    )}
                    {visibleColumns.acciones && (
                      <th className="px-3 py-2.5 whitespace-nowrap text-center w-24 print:hidden sticky right-0 bg-slate-50 shadow-xs">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {visibleColumns.fechaHora && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap font-medium text-slate-600">
                          <div>{item.fechaStr}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.horaStr}</div>
                        </td>
                      )}

                      {visibleColumns.tipoDocumento && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${item.tipoBadge}`}>
                            {item.tipoDocumento}
                          </span>
                        </td>
                      )}

                      {visibleColumns.consecutivo && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap font-mono font-bold text-slate-900">
                          {item.consecutivo !== "—" ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                              {item.consecutivo}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.pacienteTercero && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 uppercase whitespace-nowrap text-slate-800">
                          {item.pacienteTercero}
                        </td>
                      )}

                      {visibleColumns.operador && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap text-slate-700">
                          {item.operador}
                        </td>
                      )}

                      {visibleColumns.statusHttp && (
                        <td className="px-3 py-2.5 border-r border-slate-100 text-center whitespace-nowrap font-mono text-[11px] font-bold">
                          <span className={`px-2 py-0.5 rounded-md ${
                            item.statusRaw >= 500
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {item.statusHttp}
                          </span>
                        </td>
                      )}

                      {/* Error con límite de anchura para NO desbordar ni tapar columnas */}
                      {visibleColumns.documentosAsociados && (
                        <td className="px-4 py-2.5 border-r border-slate-100 text-slate-600 max-w-sm" title={item.documentosAsociados}>
                          <div className="line-clamp-2 leading-relaxed font-mono text-[11px] text-rose-800 bg-rose-50/40 p-1.5 rounded border border-rose-100/60">
                            {item.documentosAsociados}
                          </div>
                        </td>
                      )}

                      {visibleColumns.sucursal && (
                        <td className="px-3 py-2.5 border-r border-slate-100 uppercase text-[11px] text-slate-500 whitespace-nowrap">
                          {item.sucursal}
                        </td>
                      )}

                      {/* Botón Acciones SIEMPRE VISIBLE */}
                      {visibleColumns.acciones && (
                        <td className="px-3 py-2.5 text-center whitespace-nowrap print:hidden sticky right-0 bg-white shadow-xs">
                          <button 
                            onClick={() => setSelectedLogModal(item)}
                            title="Ver detalle y solución del error"
                            className="px-2.5 py-1 bg-[#009beb] hover:bg-[#0087cd] active:scale-[0.98] text-white rounded-md text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <FiEye size={13} />
                            <span>Ver</span>
                          </button>
                        </td>
                      )}

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla */}
          {filteredLogs.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <span>
                Mostrando <strong>{filteredLogs.length}</strong> eventos de error de facturación.
              </span>
              <span className="font-semibold text-rose-600">
                Auditoría en línea DIAN / Factus
              </span>
            </div>
          )}

        </div>

      </div>

      {/* ─── MODAL PANORÁMICO DE DETALLE DEL ERROR (100% OPERATIVO) ─── */}
      {selectedLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <FiAlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Detalle del Rechazo de Facturación
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>Fecha: <strong>{selectedLogModal.fechaStr} {selectedLogModal.horaStr}</strong></span>
                    <span>•</span>
                    <span className="font-mono font-bold text-rose-600">{selectedLogModal.statusHttp}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedLogModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                title="Cerrar ventana"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Contenido técnico del error */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              
              {/* Tarjetas informativas de contexto */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo Operación</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{selectedLogModal.tipoDocumento}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Consecutivo Afectado</span>
                  <span className="text-xs font-mono font-black text-slate-900 mt-0.5 block">{selectedLogModal.consecutivo}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operador / Usuario</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">{selectedLogModal.operador}</span>
                </div>
              </div>

              {/* Mensaje de error completo de la DIAN / Factus */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Respuesta Técnica del Servidor (Factus / DIAN)
                  </label>
                  <button
                    onClick={() => handleCopyError(selectedLogModal.documentosAsociados)}
                    className="text-xs text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedError ? (
                      <>
                        <FiCheck size={13} className="text-emerald-600" />
                        <span className="text-emerald-600">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <FiCopy size={13} />
                        <span>Copiar Mensaje</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 bg-slate-900 text-rose-300 font-mono text-xs rounded-xl border border-slate-800 leading-relaxed overflow-x-auto whitespace-pre-wrap select-all">
                  {selectedLogModal.documentosAsociados}
                </div>
              </div>

              {/* Sugerencia y Guía de Resolución */}
              <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/90 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <FiAlertTriangle size={14} className="text-amber-600" />
                  <span>Diagnóstico y Sugerencia de Solución:</span>
                </div>
                <p className="leading-relaxed">
                  <strong>Causa probable:</strong> {selectedLogModal.guide.causa}
                </p>
                <p className="leading-relaxed text-amber-900">
                  <strong>Acción recomendada:</strong> {selectedLogModal.guide.solucion}
                </p>
              </div>

            </div>

            {/* Pie del modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 font-mono">
                ID Evento: {selectedLogModal.id}
              </span>
              <button
                onClick={() => setSelectedLogModal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
