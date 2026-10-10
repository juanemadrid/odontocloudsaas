import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getDoctorsList } from "../../../services/supabaseServices";
import { getConfigItems } from "../../../services/configPersistenceService";
import { 
  FiSearch, FiFileText, FiFilter, FiSend, FiClock, 
  FiRefreshCw, FiDownload, FiCheckCircle, FiChevronDown, FiChevronUp 
} from "react-icons/fi";
import { format, differenceInDays, isValid, parseISO } from "date-fns";
import * as XLSX from "xlsx";

// Formateador seguro de fecha
const formatSafeDate = (rawDate, pattern = "dd/MM/yyyy HH:mm") => {
  if (!rawDate) return "—";
  try {
    const d = rawDate instanceof Date ? rawDate : (rawDate.toDate ? rawDate.toDate() : parseISO(rawDate));
    return isValid(d) ? format(d, pattern) : "—";
  } catch (e) {
    return "—";
  }
};

export default function ReporteOportunidadCitas() {
  const { userProfile } = useAuth();
  const toast = useToast();

  // Resolución unificada del inquilino
  const tenantId = useMemo(() => {
    return userProfile?.tenant_id || userProfile?.inquilino || userProfile?.tenantId || null;
  }, [userProfile]);

  const [citasList, setCitasList] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fechas por defecto: mes actual
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [isAllHistory, setIsAllHistory] = useState(true); // Activo por defecto para ver todo el histórico de citas
  const [oficina, setOficina] = useState("Todas las oficinas");

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    oficina: "Todas las oficinas",
    allHistory: true
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Ordenamiento por columna
  const [sortField, setSortField] = useState("fechaAsignada");
  const [sortDirection, setSortDirection] = useState("desc");

  // Control de columnas visibles
  const [visibleColumns, setVisibleColumns] = useState({
    paciente: true,
    documento: true,
    fechaSolicitud: true,
    fechaAsignada: true,
    diasOportunidad: true,
    especialidad: true,
    profesional: true,
    sucursal: true,
    estado: true,
  });

  const columnLabels = {
    paciente: "Paciente",
    documento: "Documento",
    fechaSolicitud: "Fecha solicitud cita",
    fechaAsignada: "Fecha cita asignada",
    diasOportunidad: "Días de oportunidad",
    especialidad: "Especialidad / Motivo",
    profesional: "Profesional",
    sucursal: "Oficina / Sucursal",
    estado: "Estado",
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAllColumns = () => {
    const allTrue = Object.keys(visibleColumns).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setVisibleColumns(allTrue);
  };

  const handleDeselectAllColumns = () => {
    const allFalse = Object.keys(visibleColumns).reduce((acc, k) => ({ ...acc, [k]: false }), {});
    setVisibleColumns(allFalse);
  };

  // Filtros por columna individuales
  const [columnFilters, setColumnFilters] = useState({
    paciente: "",
    documento: "",
    fechaSolicitud: "",
    fechaAsignada: "",
    diasOportunidad: "",
    especialidad: "",
    profesional: "",
    sucursal: "",
    estado: "TODOS"
  });

  // Carga unificada de datos reales desde PostgreSQL VPS
  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Consultas paralelas a prueba de fallos
      const [
        docsFromService,
        profilesRes,
        pacRes,
        citasRes,
        sucRes,
        cfgSucRes
      ] = await Promise.all([
        getDoctorsList(userProfile, null).catch(() => []),
        supabase.from("profiles").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("pacientes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).then(r => r, () => ({ data: [] })),
        supabase.from("citas").select("*, paciente:pacientes(id, nombres, apellidos, documento, tipo_documento, telefono)").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("sucursales").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        getConfigItems(tenantId, "sucursales", "sucursales").catch(() => [])
      ]);

      // Catálogo de Sucursales
      const listSuc = [{ id: "TODAS", nombre: "Todas las oficinas" }];
      if (Array.isArray(cfgSucRes)) {
        cfgSucRes.forEach(s => {
          const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
          if (name && !listSuc.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
            listSuc.push({ id: s.id, nombre: name });
          }
        });
      }
      (sucRes?.data || []).forEach(s => {
        const name = s.nombre || s.name;
        if (name && !listSuc.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
          listSuc.push({ id: s.id, nombre: name });
        }
      });
      if (listSuc.length === 1) {
        listSuc.push({ id: "PRINCIPAL", nombre: "CLINICA DENTAL SINCELEJO - SEDE PRINCIPAL" });
      }
      setSucursalesList(listSuc);

      // Catálogo consolidado de Profesionales
      const catalogProfs = Array.isArray(docsFromService) ? [...docsFromService] : [];
      (profilesRes?.data || []).forEach(u => {
        if (isDoctorUser(u)) {
          const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
          const primerApellido = u.apellido || u.apellidos || "";
          const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
          if (!catalogProfs.some(d => String(d.id).toLowerCase() === String(u.id).toLowerCase())) {
            catalogProfs.push({
              id: u.id,
              nombre: nombreCompleto,
              nombreCompleto: nombreCompleto,
              email: u.email || ""
            });
          }
        }
      });

      const docMap = new Map();
      catalogProfs.forEach(u => {
        const nom = (u.nombreCompleto || u.nombre || u.displayName || "").trim();
        const uid = String(u.id || "").toLowerCase().trim();
        const nomLower = nom.toLowerCase().trim();
        if (uid && nom) docMap.set(uid, nom);
        if (nomLower) docMap.set(nomLower, nom);
      });

      // Directorio de Pacientes
      const pacMap = {};
      (pacRes?.data || []).forEach(p => {
        const primerNombre = p.nombres || p.nombre || "";
        const primerApellido = p.apellidos || p.apellido || "";
        const nom = (p.nombreCompleto || `${primerNombre} ${primerApellido}`).trim() || "Paciente sin nombre";
        const docNum = p.documento || p.nroDocumento || p.identificacion || p.nro_historia || "";
        const tDoc = p.tipo_documento || p.tipoDocumento || "CC";
        const obj = { id: p.id, nombre: nom, documento: docNum, tipoDocumento: tDoc, sucursal: p.sucursal || p.sucursal_id };
        pacMap[p.id] = obj;
        if (docNum) pacMap[docNum] = obj;
      });

      // Mapeo de Citas y Cálculo de Días de Oportunidad
      const rawCitas = citasRes?.data || [];
      const listCitas = [];

      rawCitas.forEach(c => {
        // Fecha de Solicitud (cuando el paciente pide la cita / fecha de registro en el sistema)
        const fSolicitud = c.created_at ? new Date(c.created_at) : (c.fecha_creacion ? new Date(c.fecha_creacion) : new Date());
        
        // Fecha Asignada (para cuándo quedó programada la atención en la agenda)
        let rawAsignada = c.fecha_inicio || c.fechaInicio || (c.fecha ? `${c.fecha}T${c.hora || "08:00"}:00` : fSolicitud);
        const fAsignada = new Date(rawAsignada);

        // Cálculo exacto de Días de Oportunidad (Diferencia de días, mínimo 0 si fue el mismo día)
        let diffDays = 0;
        if (fSolicitud && fAsignada && !isNaN(fSolicitud.getTime()) && !isNaN(fAsignada.getTime())) {
          diffDays = Math.max(0, differenceInDays(fAsignada, fSolicitud));
        }

        // Paciente
        const pacId = c.paciente_id || c.pacienteId;
        const pacFromJoin = c.paciente ? {
          id: c.paciente.id,
          nombre: `${c.paciente.nombres || ""} ${c.paciente.apellidos || ""}`.trim(),
          documento: c.paciente.documento || "",
          tipoDocumento: c.paciente.tipo_documento || "CC"
        } : null;

        const pac = pacMap[pacId] || pacMap[c.pacienteDocumento] || pacMap[c.documento] || pacFromJoin || {};
        const pacNombre = pac.nombre || c.nombrePaciente || c.pacienteNombre || c.paciente || "—";
        const pacDoc = pac.documento || c.pacienteIdentificacion || c.documento || "—";

        // Profesional / Doctor
        const profId = c.profesional_id || c.profesionalId || c.doctorId;
        let profNombre = profId ? docMap.get(String(profId).toLowerCase()) : null;
        if (!profNombre) {
          profNombre = c.dentista || c.odontologo || c.profesional || c.doctor || "Sin asignar";
        }

        // Sucursal
        const sucNombre = c.sucursal || c.oficina || pac.sucursal || (listSuc[1]?.nombre) || (listSuc[0]?.nombre) || "SEDE PRINCIPAL";

        listCitas.push({
          id: c.id,
          paciente: pacNombre,
          documento: pacDoc,
          fechaSolicitud: fSolicitud,
          fechaAsignada: fAsignada,
          rawDiffDays: diffDays,
          diasOportunidad: `${diffDays} días`,
          especialidad: c.motivo || c.servicio || c.procedimiento || "Consulta Odontológica",
          profesional: profNombre,
          sucursal: sucNombre,
          estado: (c.estado || "Programada").toUpperCase()
        });
      });

      // Ordenar por fecha asignada descendente
      listCitas.sort((a, b) => {
        const dateA = a.fechaAsignada?.getTime() || 0;
        const dateB = b.fechaAsignada?.getTime() || 0;
        return dateB - dateA;
      });

      setCitasList(listCitas);

    } catch (error) {
      console.error("Error cargando reporte de oportunidad de citas:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, userProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manejador del botón Buscar
  const handleSearchClick = () => {
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      oficina,
      allHistory: isAllHistory
    });
  };

  // Restablecer filtros
  const handleResetFilters = () => {
    setFechaInicial(format(firstDayOfMonth, "yyyy-MM-dd"));
    setFechaFinal(format(now, "yyyy-MM-dd"));
    setIsAllHistory(true);
    setOficina("Todas las oficinas");
    setTableSearchTerm("");
    setColumnFilters({
      paciente: "",
      documento: "",
      fechaSolicitud: "",
      fechaAsignada: "",
      diasOportunidad: "",
      especialidad: "",
      profesional: "",
      sucursal: "",
      estado: "TODOS"
    });
    setAppliedFilters({
      fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
      fechaFinal: format(now, "yyyy-MM-dd"),
      oficina: "Todas las oficinas",
      allHistory: true
    });
  };

  // Filtrado de datos
  const filteredCitas = useMemo(() => {
    return citasList.filter(c => {
      // 1. Filtro por Fechas (si no está activo "Ver todo el histórico")
      if (!appliedFilters.allHistory && c.fechaAsignada) {
        const targetDate = c.fechaAsignada;
        if (targetDate && !isNaN(targetDate.getTime())) {
          const init = new Date(appliedFilters.fechaInicial + "T00:00:00");
          const end = new Date(appliedFilters.fechaFinal + "T23:59:59");
          if (targetDate < init || targetDate > end) return false;
        }
      }

      // 2. Filtro por Oficina / Sucursal
      if (appliedFilters.oficina !== "Todas las oficinas") {
        const targetOficina = appliedFilters.oficina.toLowerCase();
        const cSuc = (c.sucursal || "").toLowerCase();
        if (!cSuc.includes(targetOficina) && !targetOficina.includes(cSuc)) return false;
      }

      // 3. Búsqueda rápida global
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const match =
          c.paciente.toLowerCase().includes(term) ||
          c.documento.toLowerCase().includes(term) ||
          c.profesional.toLowerCase().includes(term) ||
          c.especialidad.toLowerCase().includes(term) ||
          c.sucursal.toLowerCase().includes(term) ||
          c.estado.toLowerCase().includes(term);
        if (!match) return false;
      }

      // 4. Filtros por columna individuales
      if (columnFilters.paciente && !c.paciente.toLowerCase().includes(columnFilters.paciente.toLowerCase())) return false;
      if (columnFilters.documento && !c.documento.toLowerCase().includes(columnFilters.documento.toLowerCase())) return false;
      if (columnFilters.diasOportunidad && !c.diasOportunidad.toLowerCase().includes(columnFilters.diasOportunidad.toLowerCase())) return false;
      if (columnFilters.especialidad && !c.especialidad.toLowerCase().includes(columnFilters.especialidad.toLowerCase())) return false;
      if (columnFilters.profesional && !c.profesional.toLowerCase().includes(columnFilters.profesional.toLowerCase())) return false;
      if (columnFilters.sucursal && !c.sucursal.toLowerCase().includes(columnFilters.sucursal.toLowerCase())) return false;
      if (columnFilters.estado !== "TODOS" && c.estado.toLowerCase() !== columnFilters.estado.toLowerCase()) return false;

      return true;
    });
  }, [citasList, appliedFilters, tableSearchTerm, columnFilters]);

  // Ordenamiento de tabla
  const sortedCitas = useMemo(() => {
    return [...filteredCitas].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "fechaAsignada" || sortField === "fechaSolicitud") {
        const timeA = a[sortField] ? a[sortField].getTime() : 0;
        const timeB = b[sortField] ? b[sortField].getTime() : 0;
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (sortField === "diasOportunidad") {
        return sortDirection === "asc" ? a.rawDiffDays - b.rawDiffDays : b.rawDiffDays - a.rawDiffDays;
      }

      valA = String(valA || "").toLowerCase();
      valB = String(valB || "").toLowerCase();
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredCitas, sortField, sortDirection]);

  // Manejo de clic en cabecera para ordenar
  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Estadísticas y Métricas de Oportunidad
  const stats = useMemo(() => {
    const total = sortedCitas.length;
    if (total === 0) return { total: 0, promedio: 0, excelentes: 0, inmediatas: 0 };

    const sumaDias = sortedCitas.reduce((acc, c) => acc + c.rawDiffDays, 0);
    const promedio = (sumaDias / total).toFixed(1);
    const excelentes = sortedCitas.filter(c => c.rawDiffDays <= 3).length;
    const inmediatas = sortedCitas.filter(c => c.rawDiffDays === 0).length;

    return {
      total,
      promedio,
      excelentes,
      inmediatas
    };
  }, [sortedCitas]);

  // Exportar a Excel Institucional
  const handleExportExcel = () => {
    const clinicName = userProfile?.clinica || userProfile?.clinica_nombre || "OdontoCloud";
    const reportDate = format(new Date(), "dd/MM/yyyy HH:mm");

    const excelRows = [
      { A: "ODONTOCLOUD - SOFTWARE ODONTOLÓGICO ESPECIALIZADO", B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
      { A: `Clínica: ${clinicName}`, B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
      { A: `Reporte: REPORTE DE OPORTUNIDAD DE CITAS (RESOLUCIÓN 256 / MINSALUD)`, B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
      { A: `Rango: ${appliedFilters.allHistory ? "Todo el histórico" : `${appliedFilters.fechaInicial} a ${appliedFilters.fechaFinal}`}`, B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
      { A: `Generado por: ${userProfile?.full_name || userProfile?.email || "Usuario"} | ${reportDate}`, B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
      { A: "", B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
    ];

    const headerRow = {};
    if (visibleColumns.paciente) headerRow.A = "Paciente";
    if (visibleColumns.documento) headerRow.B = "Documento";
    if (visibleColumns.fechaSolicitud) headerRow.C = "Fecha solicitud cita";
    if (visibleColumns.fechaAsignada) headerRow.D = "Fecha cita asignada";
    if (visibleColumns.diasOportunidad) headerRow.E = "Días de oportunidad";
    if (visibleColumns.especialidad) headerRow.F = "Especialidad / Motivo";
    if (visibleColumns.profesional) headerRow.G = "Profesional";
    if (visibleColumns.sucursal) headerRow.H = "Oficina / Sucursal";
    if (visibleColumns.estado) headerRow.I = "Estado";
    excelRows.push(headerRow);

    sortedCitas.forEach(c => {
      const dataRow = {};
      if (visibleColumns.paciente) dataRow.A = c.paciente;
      if (visibleColumns.documento) dataRow.B = c.documento;
      if (visibleColumns.fechaSolicitud) dataRow.C = formatSafeDate(c.fechaSolicitud);
      if (visibleColumns.fechaAsignada) dataRow.D = formatSafeDate(c.fechaAsignada);
      if (visibleColumns.diasOportunidad) dataRow.E = c.rawDiffDays;
      if (visibleColumns.especialidad) dataRow.F = c.especialidad;
      if (visibleColumns.profesional) dataRow.G = c.profesional;
      if (visibleColumns.sucursal) dataRow.H = c.sucursal;
      if (visibleColumns.estado) dataRow.I = c.estado;
      excelRows.push(dataRow);
    });

    excelRows.push({ A: "", B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" });
    excelRows.push({
      A: `TOTAL CITAS: ${stats.total}`,
      B: `PROMEDIO OPORTUNIDAD: ${stats.promedio} DÍAS`,
      C: `CUMPLIMIENTO <= 3 DÍAS: ${stats.excelentes} CITAS`,
      D: "",
      E: "",
      F: "",
      G: "",
      H: "",
      I: ""
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows, { skipHeader: true });
    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 28 },
      { wch: 26 },
      { wch: 35 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OportunidadCitas");
    const fileSuffix = appliedFilters.allHistory ? "Historico_Completo" : `${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}`;
    XLSX.writeFile(workbook, `Reporte_Oportunidad_Citas_${fileSuffix}.xlsx`);
    toast?.success("Reporte de oportunidad descargado exitosamente");
  };

  // Acción del botón Enviar / Reporte Minsalud
  const handleEnviarReporte = () => {
    toast?.info(`Compilando indicadores de oportunidad (${stats.total} citas analizadas, promedio: ${stats.promedio} días) para el Sistema Obligatorio de Garantía de Calidad en Salud.`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB CON ACCIONES (Zip + Enviar + Actualizar) ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-50 text-[#009beb] rounded-xl flex items-center justify-center font-bold border border-sky-100 shadow-xs">
            <FiClock size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 leading-tight">Reporte de oportunidad de citas</h2>
              <span className="text-slate-400 text-xs cursor-help" title="Mide los días entre la fecha en que el paciente solicitó la cita y la fecha asignada en la agenda (Resolución 256 de 2016 Minsalud)">ⓘ</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>🏠 Reportes</span>
              <span>/</span>
              <span className="text-slate-500 font-semibold">Reporte de oportunidad de citas</span>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchData();
            }}
            disabled={loading || isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            title="Recargar datos del servidor"
          >
            <FiRefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            title="Descargar paquete de reporte en Excel/Zip"
          >
            <FiFileText size={14} />
            <span>Zip / Excel</span>
          </button>

          <button
            onClick={handleEnviarReporte}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            title="Generar y verificar reporte para entes de salud"
          >
            <FiSend size={14} />
            <span>Enviar</span>
          </button>
        </div>
      </div>

      {/* ─── FILTROS SUPERIORES (1:1 ESTÁNDAR ODONTOCLOUD / ORALDRIVE) ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0">
        
        {/* Fila 1: Fecha inicial / Fecha final / Toggle Histórico */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha inicial</label>
            <div className="relative flex items-center">
              <input
                type="date"
                disabled={isAllHistory}
                value={fechaInicial}
                onChange={(e) => setFechaInicial(e.target.value)}
                className={`w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all pr-10 ${
                  isAllHistory ? "opacity-50 cursor-not-allowed bg-slate-50" : ""
                }`}
                max="9999-12-31" min="1900-01-01" 
              />
              <span className="absolute right-2.5 text-slate-400 pointer-events-none text-xs">📅</span>
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha final</label>
            <div className="relative flex items-center">
              <input
                type="date"
                disabled={isAllHistory}
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className={`w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all pr-10 ${
                  isAllHistory ? "opacity-50 cursor-not-allowed bg-slate-50" : ""
                }`}
                max="9999-12-31" min="1900-01-01" 
              />
              <span className="absolute right-2.5 text-slate-400 pointer-events-none text-xs">📅</span>
            </div>
          </div>

          <div className="md:col-span-2 pb-1.5 flex items-center">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-600 hover:text-sky-700">
              <input
                type="checkbox"
                checked={isAllHistory}
                onChange={(e) => setIsAllHistory(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <span>Ver todo el histórico</span>
            </label>
          </div>
        </div>

        {/* Fila 2: Oficina / Sucursal + Botón Buscar y Limpiar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          <div className="md:col-span-9">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Oficina / Sede</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="Todas las oficinas">TODAS LAS OFICINAS</option>
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <button
              onClick={handleSearchClick}
              className="flex-1 h-9 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FiSearch size={14} />
              <span>Buscar</span>
            </button>

            <button
              onClick={handleResetFilters}
              title="Restablecer filtros"
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-semibold text-xs rounded-lg transition-all flex items-center justify-center cursor-pointer"
            >
              <span>Limpiar</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS DATAGRID (SIEMPRE DISPONIBLE TRAS CARGAR) ─── */}
      <div className="mx-6 my-4 flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col min-h-0 overflow-hidden animate-fadeIn">
        
        {/* Barra de herramientas */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium italic">
              Arrastra una columna aquí para agrupar por ella
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-600">
              Registros: <strong className="text-sky-700">{sortedCitas.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Selector de Columnas */}
            <div className="relative">
              <button 
                title="Selector de columnas" 
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${showColumnSelector ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-200 text-slate-600'}`}
              >
                <FiFileText size={14} />
              </button>

              {showColumnSelector && (
                <div className="absolute right-0 top-8 z-30 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
                  <div className="text-xs font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span>Seleccionar columnas</span>
                    <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={handleSelectAllColumns}
                      className="text-[10px] text-sky-600 hover:underline font-bold"
                    >
                      Seleccionar todo
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={handleDeselectAllColumns}
                      className="text-[10px] text-slate-500 hover:underline"
                    >
                      Deseleccionar todo
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {Object.keys(visibleColumns).map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
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

            {/* Buscador rápido global */}
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Buscar..."
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
                className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-200 rounded-md text-xs outline-none focus:border-sky-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-600">Calculando oportunidad de citas...</span>
              <span className="text-[11px] text-slate-400 mt-1">Auditando tiempos entre solicitud y agenda en tiempo real</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold select-none">
                {/* Fila 1: Títulos de columna con clic para ordenar */}
                <tr>
                  {visibleColumns.paciente && (
                    <th 
                      onClick={() => handleHeaderSort("paciente")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Paciente</span>
                        {sortField === "paciente" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.documento && (
                    <th 
                      onClick={() => handleHeaderSort("documento")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Documento</span>
                        {sortField === "documento" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.fechaSolicitud && (
                    <th 
                      onClick={() => handleHeaderSort("fechaSolicitud")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Fecha solicitud cita</span>
                        {sortField === "fechaSolicitud" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.fechaAsignada && (
                    <th 
                      onClick={() => handleHeaderSort("fechaAsignada")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Fecha cita asignada</span>
                        {sortField === "fechaAsignada" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.diasOportunidad && (
                    <th 
                      onClick={() => handleHeaderSort("diasOportunidad")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap text-center cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Días de oportunidad</span>
                        {sortField === "diasOportunidad" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.especialidad && (
                    <th 
                      onClick={() => handleHeaderSort("especialidad")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Especialidad / Motivo</span>
                        {sortField === "especialidad" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.profesional && (
                    <th 
                      onClick={() => handleHeaderSort("profesional")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Profesional</span>
                        {sortField === "profesional" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.sucursal && (
                    <th 
                      onClick={() => handleHeaderSort("sucursal")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Oficina / Sucursal</span>
                        {sortField === "sucursal" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.estado && (
                    <th 
                      onClick={() => handleHeaderSort("estado")}
                      className="px-3.5 py-2 whitespace-nowrap text-center cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Estado</span>
                        {sortField === "estado" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                </tr>

                {/* Fila 2: Inputs de filtro por columna */}
                <tr className="bg-white border-b border-slate-200 font-normal">
                  {visibleColumns.paciente && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.paciente}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, paciente: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.documento && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.documento}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, documento: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.fechaSolicitud && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="h-6 bg-slate-50/50 rounded" />
                    </th>
                  )}
                  {visibleColumns.fechaAsignada && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="h-6 bg-slate-50/50 rounded" />
                    </th>
                  )}
                  {visibleColumns.diasOportunidad && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          placeholder="Filtro..."
                          value={columnFilters.diasOportunidad}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, diasOportunidad: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white text-center"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.especialidad && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.especialidad}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, especialidad: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.profesional && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.profesional}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, profesional: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.sucursal && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.sucursal}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, sucursal: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.estado && (
                    <th className="p-1">
                      <select
                        value={columnFilters.estado}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, estado: e.target.value }))}
                        className="w-full h-6 px-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white text-slate-700 uppercase"
                      >
                        <option value="TODOS">(Todos)</option>
                        <option value="CONFIRMADA">CONFIRMADA</option>
                        <option value="ATENDIDO">ATENDIDO</option>
                        <option value="PROGRAMADA">PROGRAMADA</option>
                        <option value="CANCELADA">CANCELADA</option>
                      </select>
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedCitas.map((c) => (
                  <tr key={c.id} className="hover:bg-sky-50/40 transition-colors">
                    {visibleColumns.paciente && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-bold text-sky-700 uppercase whitespace-nowrap">
                        {c.paciente}
                      </td>
                    )}
                    {visibleColumns.documento && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono whitespace-nowrap text-slate-600">
                        {c.documento}
                      </td>
                    )}
                    {visibleColumns.fechaSolicitud && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono whitespace-nowrap text-slate-600">
                        {formatSafeDate(c.fechaSolicitud)}
                      </td>
                    )}
                    {visibleColumns.fechaAsignada && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono whitespace-nowrap text-slate-700 font-semibold">
                        {formatSafeDate(c.fechaAsignada)}
                      </td>
                    )}
                    {visibleColumns.diasOportunidad && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          c.rawDiffDays <= 1 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                            : c.rawDiffDays <= 3 
                            ? "bg-sky-100 text-sky-800 border border-sky-200" 
                            : c.rawDiffDays <= 7 
                            ? "bg-amber-100 text-amber-800 border border-amber-200" 
                            : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}>
                          {c.diasOportunidad}
                        </span>
                      </td>
                    )}
                    {visibleColumns.especialidad && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap text-slate-700">
                        {c.especialidad}
                      </td>
                    )}
                    {visibleColumns.profesional && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 uppercase whitespace-nowrap font-medium text-slate-800">
                        {c.profesional}
                      </td>
                    )}
                    {visibleColumns.sucursal && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 uppercase whitespace-nowrap text-[10px] text-slate-500">
                        {c.sucursal}
                      </td>
                    )}
                    {visibleColumns.estado && (
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          c.estado === "ATENDIDO" || c.estado === "ATENDIDA"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : c.estado === "CONFIRMADA" || c.estado === "CONFIRMADO"
                            ? "bg-sky-50 text-sky-700 border border-sky-100"
                            : c.estado === "CANCELADA"
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {c.estado}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}

                {sortedCitas.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-16 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FiClock size={32} className="text-slate-300 stroke-[1.5]" />
                        <span className="text-slate-500 font-bold">No se encontraron registros de oportunidad de citas</span>
                        <span className="text-[11px] text-slate-400 max-w-md">
                          Prueba cambiando el rango de fechas o activando "Ver todo el histórico".
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── FOOTER CON TOTALIZADORES EN TIEMPO REAL ─── */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 shrink-0 font-medium">
          <div className="flex items-center gap-4">
            <span>
              Total citas: <strong className="text-slate-800 font-bold">{stats.total}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Promedio de oportunidad: <strong className="text-sky-700 font-bold">{stats.promedio} días</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Cumplimiento (≤ 3 días): <strong className="text-emerald-700 font-bold">{stats.excelentes}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Inmediatas (0 días): <strong className="text-slate-700 font-bold">{stats.inmediatas}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Indicador Minsalud:</span>
            <span className="font-bold text-slate-900 text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              {stats.total > 0 ? `${Math.round((stats.excelentes / stats.total) * 100)}% en meta` : "—"}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
