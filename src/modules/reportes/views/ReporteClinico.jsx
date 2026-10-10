import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getDoctorsList } from "../../../services/supabaseServices";
import { 
  FiActivity, FiDownload, FiSearch, FiCheckCircle, FiClock, 
  FiXCircle, FiRefreshCw, FiCalendar, FiFileText, FiFilter,
  FiUser, FiLayers, FiAlertTriangle, FiChevronDown, FiChevronUp
} from "react-icons/fi";
import { format, isValid, parseISO } from "date-fns";
import * as XLSX from "xlsx";

// Normalizador de estado de cita en español estándar
export const normalizeEstadoCita = (raw) => {
  if (!raw) return "Programada";
  const st = String(raw).toLowerCase().trim();
  if (st === "atendida" || st === "atendido" || st === "completada" || st === "finalizada" || st === "realizada") return "Atendida";
  if (st === "confirmada" || st === "confirmado") return "Confirmada";
  if (st === "cancelada" || st === "anulada") return "Cancelada";
  if (st.includes("no asiste") || st.includes("no_asistio") || st === "inasistencia") return "Inasistencia";
  if (st === "en sala" || st === "en_espera" || st === "sala de espera") return "En sala";
  if (st === "programada" || st === "pendiente" || st === "agendada") return "Programada";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

// Formateador seguro de fecha
const formatSafeDate = (d, pattern = "dd/MM/yyyy") => {
  if (!d) return "—";
  try {
    return isValid(d) ? format(d, pattern) : "—";
  } catch (e) {
    return "—";
  }
};

export default function ReporteClinico() {
  const { userProfile } = useAuth();
  
  // Resolución robusta del inquilino / tenant_id
  const tenantId = useMemo(() => {
    return userProfile?.tenant_id || userProfile?.inquilino || userProfile?.tenantId || null;
  }, [userProfile]);

  const [allRecords, setAllRecords] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fechas por defecto: Mes actual
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [isAllHistory, setIsAllHistory] = useState(false);

  // Filtros superiores
  const [selectedProfesional, setSelectedProfesional] = useState("TODOS");
  const [selectedEstado, setSelectedEstado] = useState("TODOS");
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [pacienteSearchTerm, setPacienteSearchTerm] = useState("");
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);

  const pacienteInputRef = useRef(null);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    profesional: "TODOS",
    estado: "TODOS",
    paciente: "",
    allHistory: false
  });

  // Búsqueda rápida global en tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Ordenamiento por columna
  const [sortField, setSortField] = useState("fecha");
  const [sortDirection, setSortDirection] = useState("desc"); // 'asc' | 'desc'

  // Control de columnas visibles (1:1 OralDrive estándar)
  const [visibleColumns, setVisibleColumns] = useState({
    fechaHora: true,
    paciente: true,
    documento: true,
    procedimiento: true,
    profesional: true,
    consultorio: true,
    estado: true,
    notas: false
  });

  const columnLabels = {
    fechaHora: "Fecha y hora",
    paciente: "Paciente",
    documento: "Documento",
    procedimiento: "Procedimiento / Motivo",
    profesional: "Dr. / Tratante",
    consultorio: "Consultorio / Sede",
    estado: "Estado",
    notas: "Notas / Observaciones"
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

  // Filtros individuales por columna
  const [columnFilters, setColumnFilters] = useState({
    fechaHora: "",
    paciente: "",
    documento: "",
    procedimiento: "",
    profesional: "",
    consultorio: "",
    estado: "TODOS"
  });

  // Clic fuera para cerrar dropdown de pacientes
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pacienteInputRef.current && !pacienteInputRef.current.contains(e.target)) {
        setShowPacienteDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Carga paralela optimizada desde PostgreSQL de tu VPS
  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [docsFromService, profilesRes, pacRes, citasRes, consultoriosRes] = await Promise.all([
        getDoctorsList(userProfile, null).catch(e => {
          console.warn("Aviso catálogo doctores:", e);
          return [];
        }),
        supabase.from("profiles").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("pacientes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).then(r => r, () => ({ data: [] })),
        supabase.from("citas").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).then(r => r, () => ({ data: [] })),
        supabase.from("consultorios").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] }))
      ]);

      // 1. Armar Directorio de Pacientes
      const pacMap = {};
      const listPacs = (pacRes?.data || []).map(p => {
        const nombreCompleto = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || 'Paciente sin nombre';
        const doc = p.documento || p.nroDocumento || p.identificacion || p.nro_historia || '';
        const obj = {
          id: p.id,
          nombre: nombreCompleto,
          documento: doc,
          telefono: p.telefono || p.celular || ''
        };
        pacMap[p.id] = obj;
        if (doc) pacMap[doc] = obj;
        return obj;
      });
      setPacientesList(listPacs);

      // 2. Armar Catálogo unificado de Profesionales Médicos
      const catalogProfs = Array.isArray(docsFromService) ? [...docsFromService] : [];
      (profilesRes?.data || []).forEach(u => {
        if (isDoctorUser(u)) {
          const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
          const primerApellido = u.apellido || u.apellidos || "";
          const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email || "Doctor";
          if (!catalogProfs.some(d => String(d.id).toLowerCase() === String(u.id).toLowerCase())) {
            catalogProfs.push({
              id: u.id,
              nombre: nombreCompleto,
              nombreCompleto: nombreCompleto,
              email: u.email || "",
              especialidades: u.especialidades || []
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
      setProfesionales(catalogProfs);

      // 3. Catálogo de Consultorios
      const consMap = {};
      (consultoriosRes?.data || []).forEach(c => {
        if (c.id) consMap[c.id] = c.nombre || c.ubicacion || `Consultorio ${c.id}`;
      });

      // 4. Mapear Citas / Consultas con Datos Reales
      const rawCitas = citasRes?.data || [];
      const listRows = [];

      rawCitas.forEach(c => {
        // Resolver fecha y hora
        let dateObj = null;
        if (c.fecha_inicio) {
          dateObj = new Date(c.fecha_inicio);
        } else if (c.start) {
          dateObj = new Date(c.start);
        } else if (c.fecha && c.hora) {
          dateObj = new Date(`${c.fecha}T${c.hora}:00`);
        } else if (c.fecha) {
          dateObj = new Date(c.fecha);
        } else if (c.created_at) {
          dateObj = new Date(c.created_at);
        }

        const validDate = dateObj && !isNaN(dateObj.getTime()) ? dateObj : null;
        const fechaFormatStr = validDate ? format(validDate, "dd/MM/yyyy") : (c.fecha || "—");
        const horaFormatStr = validDate ? format(validDate, "hh:mm a") : (c.hora || "—");
        const isoDateOnly = validDate ? format(validDate, "yyyy-MM-dd") : (c.fecha || "");

        // Resolver Paciente
        const pId = c.paciente_id || c.pacienteId;
        const pDocCandidate = c.paciente_documento || c.pacienteDocumento || c.documento;
        const pacObj = pacMap[pId] || (pDocCandidate ? pacMap[pDocCandidate] : null);

        const pacNombre = pacObj?.nombre || c.paciente_nombre || c.nombrePaciente || c.paciente || (c.detalles?.pacienteNombre) || "Paciente sin registrar";
        const pacDoc = pacObj?.documento || pDocCandidate || "—";

        // Resolver Profesional / Dr. Tratante
        const profId = c.profesional_id || c.profesionalId || c.doctorId;
        let profNombre = profId ? docMap.get(String(profId).toLowerCase()) : null;
        if (!profNombre) {
          profNombre = c.profesional_nombre || c.doctor_nombre || c.dentista || c.odontologo || c.profesional || "Sin asignar";
        }

        // Resolver Consultorio
        const roomId = c.consultorio_id || c.consultorioId || c.roomId;
        const consNombre = (roomId && consMap[roomId]) ? consMap[roomId] : (c.consultorio || c.sala || c.sede || "Consultorio Principal");

        // Resolver Procedimiento / Motivo
        const procMotivo = (c.motivo || c.procedimiento || c.servicio || c.tratamiento || c.titulo || "Consulta Odontológica General").trim();
        const estadoNorm = normalizeEstadoCita(c.estado);

        listRows.push({
          id: c.id,
          dateObj: validDate,
          isoDate: isoDateOnly,
          fechaStr: fechaFormatStr,
          horaStr: horaFormatStr,
          fechaHoraDisplay: `${fechaFormatStr} ${horaFormatStr}`,
          paciente: pacNombre,
          documento: pacDoc,
          profesional: profNombre,
          profesionalId: profId,
          consultorio: consNombre,
          procedimiento: procMotivo,
          estado: estadoNorm,
          rawEstado: c.estado || "programada",
          notas: c.notas || c.comentario || c.observaciones || "—"
        });
      });

      // Orden descendente por fecha
      listRows.sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj.getTime() : 0;
        const timeB = b.dateObj ? b.dateObj.getTime() : 0;
        return timeB - timeA;
      });

      setAllRecords(listRows);

    } catch (error) {
      console.error("Error al cargar reporte clínico:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, userProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sugerencias de pacientes (>= 2 caracteres)
  const filteredPatientSuggestions = useMemo(() => {
    const term = pacienteSearchTerm.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return pacientesList.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      p.documento.toLowerCase().includes(term)
    );
  }, [pacientesList, pacienteSearchTerm]);

  // Manejador del botón Buscar
  const handleSearchClick = () => {
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      profesional: selectedProfesional,
      estado: selectedEstado,
      paciente: selectedPaciente,
      allHistory: isAllHistory
    });
  };

  // Manejador de Restablecer filtros
  const handleResetFilters = () => {
    setFechaInicial(format(firstDayOfMonth, "yyyy-MM-dd"));
    setFechaFinal(format(now, "yyyy-MM-dd"));
    setIsAllHistory(false);
    setSelectedProfesional("TODOS");
    setSelectedEstado("TODOS");
    setSelectedPaciente("");
    setPacienteSearchTerm("");
    setTableSearchTerm("");
    setColumnFilters({
      fechaHora: "",
      paciente: "",
      documento: "",
      procedimiento: "",
      profesional: "",
      consultorio: "",
      estado: "TODOS"
    });
    setAppliedFilters({
      fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
      fechaFinal: format(now, "yyyy-MM-dd"),
      profesional: "TODOS",
      estado: "TODOS",
      paciente: "",
      allHistory: false
    });
  };

  // Filtrado de datos
  const filteredData = useMemo(() => {
    return allRecords.filter(r => {
      // 1. Filtro por fecha (si no está activo "Ver todo el histórico")
      if (!appliedFilters.allHistory && r.isoDate) {
        if (appliedFilters.fechaInicial && r.isoDate < appliedFilters.fechaInicial) return false;
        if (appliedFilters.fechaFinal && r.isoDate > appliedFilters.fechaFinal) return false;
      }

      // 2. Filtro por profesional
      if (appliedFilters.profesional !== "TODOS") {
        const target = appliedFilters.profesional.toLowerCase();
        const rProf = (r.profesional || "").toLowerCase();
        if (!rProf.includes(target) && !target.includes(rProf)) return false;
      }

      // 3. Filtro por estado
      if (appliedFilters.estado !== "TODOS") {
        if (r.estado.toLowerCase() !== appliedFilters.estado.toLowerCase()) return false;
      }

      // 4. Filtro por paciente
      if (appliedFilters.paciente) {
        const target = appliedFilters.paciente.toLowerCase();
        const rPac = (r.paciente || "").toLowerCase();
        if (!rPac.includes(target) && !target.includes(rPac)) return false;
      }

      // 5. Búsqueda rápida global
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const match =
          r.paciente.toLowerCase().includes(term) ||
          r.documento.toLowerCase().includes(term) ||
          r.profesional.toLowerCase().includes(term) ||
          r.procedimiento.toLowerCase().includes(term) ||
          r.consultorio.toLowerCase().includes(term) ||
          r.estado.toLowerCase().includes(term) ||
          r.fechaHoraDisplay.toLowerCase().includes(term);
        if (!match) return false;
      }

      // 6. Filtros por columna individuales
      if (columnFilters.fechaHora && !r.fechaHoraDisplay.toLowerCase().includes(columnFilters.fechaHora.toLowerCase())) return false;
      if (columnFilters.paciente && !r.paciente.toLowerCase().includes(columnFilters.paciente.toLowerCase())) return false;
      if (columnFilters.documento && !r.documento.toLowerCase().includes(columnFilters.documento.toLowerCase())) return false;
      if (columnFilters.procedimiento && !r.procedimiento.toLowerCase().includes(columnFilters.procedimiento.toLowerCase())) return false;
      if (columnFilters.profesional && !r.profesional.toLowerCase().includes(columnFilters.profesional.toLowerCase())) return false;
      if (columnFilters.consultorio && !r.consultorio.toLowerCase().includes(columnFilters.consultorio.toLowerCase())) return false;
      if (columnFilters.estado !== "TODOS" && r.estado.toLowerCase() !== columnFilters.estado.toLowerCase()) return false;

      return true;
    });
  }, [allRecords, appliedFilters, tableSearchTerm, columnFilters]);

  // Ordenamiento de tabla
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "fechaHora" || sortField === "fecha") {
        const timeA = a.dateObj ? a.dateObj.getTime() : 0;
        const timeB = b.dateObj ? b.dateObj.getTime() : 0;
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      valA = String(valA || "").toLowerCase();
      valB = String(valB || "").toLowerCase();
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  // Manejo de clic en cabecera
  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Métricas y totales en tiempo real
  const stats = useMemo(() => {
    let atendidas = 0;
    let programadas = 0;
    let canceladas = 0;
    let inasistencias = 0;

    sortedData.forEach(r => {
      const st = r.estado.toLowerCase();
      if (st === "atendida") atendidas++;
      else if (st === "cancelada") canceladas++;
      else if (st === "inasistencia") inasistencias++;
      else programadas++;
    });

    const total = sortedData.length;
    const efectividad = total > 0 ? Math.round((atendidas / total) * 100) : 0;

    return {
      total,
      atendidas,
      programadas,
      canceladas,
      inasistencias,
      efectividad
    };
  }, [sortedData]);

  // Exportar a Excel Institucional formal con metadata
  const handleExportExcel = () => {
    const clinicName = userProfile?.clinica || userProfile?.clinica_nombre || "OdontoCloud";
    const reportDate = format(new Date(), "dd/MM/yyyy HH:mm");

    const excelRows = [
      { A: "ODONTOCLOUD - SOFTWARE ODONTOLÓGICO ESPECIALIZADO", B: "", C: "", D: "", E: "", F: "", G: "" },
      { A: `Clínica: ${clinicName}`, B: "", C: "", D: "", E: "", F: "", G: "" },
      { A: `Reporte: REPORTE CLÍNICO - LOG DE CONSULTAS Y ATENCIONES`, B: "", C: "", D: "", E: "", F: "", G: "" },
      { A: `Rango: ${appliedFilters.allHistory ? "Todo el histórico" : `${appliedFilters.fechaInicial} a ${appliedFilters.fechaFinal}`}`, B: "", C: "", D: "", E: "", F: "", G: "" },
      { A: `Generado por: ${userProfile?.full_name || userProfile?.email || "Usuario"} | ${reportDate}`, B: "", C: "", D: "", E: "", F: "", G: "" },
      { A: "", B: "", C: "", D: "", E: "", F: "", G: "" },
    ];

    // Encabezados
    const headerRow = {};
    if (visibleColumns.fechaHora) headerRow.A = "Fecha y Hora";
    if (visibleColumns.paciente) headerRow.B = "Paciente";
    if (visibleColumns.documento) headerRow.C = "Documento";
    if (visibleColumns.procedimiento) headerRow.D = "Procedimiento / Motivo";
    if (visibleColumns.profesional) headerRow.E = "Dr. / Tratante";
    if (visibleColumns.consultorio) headerRow.F = "Consultorio / Sede";
    if (visibleColumns.estado) headerRow.G = "Estado";
    excelRows.push(headerRow);

    // Filas de datos
    sortedData.forEach(r => {
      const dataRow = {};
      if (visibleColumns.fechaHora) dataRow.A = r.fechaHoraDisplay;
      if (visibleColumns.paciente) dataRow.B = r.paciente;
      if (visibleColumns.documento) dataRow.C = r.documento;
      if (visibleColumns.procedimiento) dataRow.D = r.procedimiento;
      if (visibleColumns.profesional) dataRow.E = r.profesional;
      if (visibleColumns.consultorio) dataRow.F = r.consultorio;
      if (visibleColumns.estado) dataRow.G = r.estado;
      excelRows.push(dataRow);
    });

    // Fila resumen
    excelRows.push({ A: "", B: "", C: "", D: "", E: "", F: "", G: "" });
    excelRows.push({
      A: `TOTAL CONSULTAS: ${stats.total}`,
      B: `ATENDIDAS: ${stats.atendidas} (${stats.efectividad}%)`,
      C: `PROGRAMADAS / CONFIRMADAS: ${stats.programadas}`,
      D: `CANCELADAS: ${stats.canceladas}`,
      E: `INASISTENCIAS: ${stats.inasistencias}`,
      F: "",
      G: ""
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows, { skipHeader: true });
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 32 },
      { wch: 16 },
      { wch: 35 },
      { wch: 28 },
      { wch: 20 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Clínico");

    const fileSuffix = appliedFilters.allHistory ? "Historico_Completo" : `${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}`;
    XLSX.writeFile(workbook, `Reporte_Clinico_${fileSuffix}.xlsx`);
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (sortedData.length === 0) return;
    const headers = ["Fecha y Hora", "Paciente", "Documento", "Procedimiento", "Doctor Tratante", "Consultorio", "Estado"];
    const rows = sortedData.map(r => [
      `"${r.fechaHoraDisplay}"`,
      `"${r.paciente.replace(/"/g, "'")}"`,
      `"${r.documento}"`,
      `"${r.procedimiento.replace(/"/g, "'")}"`,
      `"${r.profesional.replace(/"/g, "'")}"`,
      `"${r.consultorio.replace(/"/g, "'")}"`,
      `"${r.estado}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Clinico_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans text-slate-700">
      
      {/* ─── HEADER & BREADCRUMB (1:1 ESTÁNDAR ODONTOCLOUD / ORALDRIVE) ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-50 text-[#009beb] rounded-xl flex items-center justify-center font-bold border border-sky-100 shadow-xs">
            <FiActivity size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 leading-tight">Reporte clínico</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>🏠 Reportes</span>
              <span>/</span>
              <span className="text-slate-500 font-semibold">Reporte clínico</span>
            </div>
          </div>
        </div>

        {/* Acciones principales: Actualizar, Exportar CSV y Generar Excel */}
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
            onClick={handleExportCSV}
            disabled={sortedData.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            title="Exportar en formato CSV"
          >
            <FiDownload size={13} />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={sortedData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <FiDownload size={14} />
            <span>Generar reporte en excel</span>
          </button>
        </div>
      </div>

      {/* ─── FILTROS SUPERIORES (ESTRUCTURA UNIFICADA CUADRADA CON BORDES REDONDEADOS SUAVES) ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0">
        
        {/* Fila 1: Fechas y Toggle de Histórico */}
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
                max="9999-12-31"
                min="1900-01-01"
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
                max="9999-12-31"
                min="1900-01-01"
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

        {/* Fila 2: Profesional / Estado / Paciente / Botón Buscar y Limpiar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          {/* Selector de Profesional / Doctor */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            >
              <option value="TODOS">-- Todos los profesionales --</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.nombreCompleto || p.nombre}>
                  {p.nombreCompleto || p.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Estado */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Estado</label>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            >
              <option value="TODOS">Todos</option>
              <option value="Atendida">Atendida</option>
              <option value="Confirmada">Confirmada</option>
              <option value="Programada">Programada</option>
              <option value="Cancelada">Cancelada</option>
              <option value="Inasistencia">Inasistencia</option>
            </select>
          </div>

          {/* Autocomplete de Paciente (>= 2 caracteres) */}
          <div className="md:col-span-3 relative" ref={pacienteInputRef}>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Paciente</label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="BUSCAR PACIENTE..."
                value={selectedPaciente || pacienteSearchTerm}
                onChange={(e) => {
                  setSelectedPaciente("");
                  setPacienteSearchTerm(e.target.value);
                  setShowPacienteDropdown(true);
                }}
                onFocus={() => {
                  if (pacienteSearchTerm.trim().length >= 2) {
                    setShowPacienteDropdown(true);
                  }
                }}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase pr-8"
              />
              {(selectedPaciente || pacienteSearchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaciente("");
                    setPacienteSearchTerm("");
                    setShowPacienteDropdown(false);
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown de Pacientes */}
            {showPacienteDropdown && pacienteSearchTerm.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto custom-scrollbar p-1">
                {filteredPatientSuggestions.map(pac => (
                  <button
                    key={pac.id}
                    type="button"
                    onClick={() => {
                      setSelectedPaciente(pac.nombre);
                      setPacienteSearchTerm(pac.nombre);
                      setShowPacienteDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors uppercase truncate flex items-center justify-between"
                  >
                    <span>{pac.nombre}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{pac.documento}</span>
                  </button>
                ))}
                {filteredPatientSuggestions.length === 0 && (
                  <div className="px-3 py-2.5 text-xs text-slate-400 font-medium text-center">
                    No se encontraron pacientes para "{pacienteSearchTerm}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botones Buscar y Limpiar */}
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

      {/* ─── TABLA DE RESULTADOS DATAGRID PROFESIONAL ─── */}
      <div className="mx-6 my-4 flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col min-h-0 overflow-hidden animate-fadeIn">
        
        {/* Barra de herramientas / Agrupación OralDrive */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium italic">
              Arrastra una columna aquí para agrupar por ella
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-600">
              Registros: <strong className="text-sky-700">{sortedData.length}</strong>
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

        {/* Tabla de Consultas */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-600">Cargando reporte clínico...</span>
              <span className="text-[11px] text-slate-400 mt-1">Consultando atenciones, doctores y pacientes en tiempo real</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold select-none">
                {/* Fila 1: Títulos de columna con clic para ordenar */}
                <tr>
                  {visibleColumns.fechaHora && (
                    <th 
                      onClick={() => handleHeaderSort("fechaHora")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Fecha y hora</span>
                        {sortField === "fechaHora" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
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
                  {visibleColumns.procedimiento && (
                    <th 
                      onClick={() => handleHeaderSort("procedimiento")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Procedimiento / Motivo</span>
                        {sortField === "procedimiento" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.profesional && (
                    <th 
                      onClick={() => handleHeaderSort("profesional")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Dr. / Tratante</span>
                        {sortField === "profesional" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.consultorio && (
                    <th 
                      onClick={() => handleHeaderSort("consultorio")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Consultorio / Sede</span>
                        {sortField === "consultorio" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.estado && (
                    <th 
                      onClick={() => handleHeaderSort("estado")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Estado</span>
                        {sortField === "estado" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.notas && (
                    <th className="px-3.5 py-2 whitespace-nowrap">
                      <span>Notas</span>
                    </th>
                  )}
                </tr>

                {/* Fila 2: Inputs de filtro por columna individuales */}
                <tr className="bg-white border-b border-slate-200 font-normal">
                  {visibleColumns.fechaHora && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.fechaHora}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, fechaHora: e.target.value }))}
                          placeholder="dd/mm/aaaa"
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
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
                  {visibleColumns.procedimiento && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.procedimiento}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, procedimiento: e.target.value }))}
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
                  {visibleColumns.consultorio && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.consultorio}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, consultorio: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.estado && (
                    <th className="p-1 border-r border-slate-200">
                      <select
                        value={columnFilters.estado}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, estado: e.target.value }))}
                        className="w-full h-6 px-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white text-slate-700"
                      >
                        <option value="TODOS">(Todos)</option>
                        <option value="Atendida">Atendida</option>
                        <option value="Confirmada">Confirmada</option>
                        <option value="Programada">Programada</option>
                        <option value="Cancelada">Cancelada</option>
                        <option value="Inasistencia">Inasistencia</option>
                      </select>
                    </th>
                  )}
                  {visibleColumns.notas && (
                    <th className="p-1">
                      <div className="h-6 bg-slate-50/50 rounded" />
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedData.map((r) => (
                  <tr key={r.id} className="hover:bg-sky-50/40 transition-colors">
                    {visibleColumns.fechaHora && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{r.fechaStr}</div>
                        <div className="text-[10px] text-slate-400">{r.horaStr}</div>
                      </td>
                    )}
                    {visibleColumns.paciente && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-semibold text-slate-800 uppercase">
                        <div>{r.paciente}</div>
                      </td>
                    )}
                    {visibleColumns.documento && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono text-slate-600">
                        {r.documento}
                      </td>
                    )}
                    {visibleColumns.procedimiento && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 text-slate-700">
                        <span className="font-medium text-slate-800">{r.procedimiento}</span>
                      </td>
                    )}
                    {visibleColumns.profesional && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-semibold text-sky-800">
                        {r.profesional}
                      </td>
                    )}
                    {visibleColumns.consultorio && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 text-slate-600">
                        {r.consultorio}
                      </td>
                    )}
                    {visibleColumns.estado && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.estado === "Atendida"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : r.estado === "Confirmada"
                            ? "bg-sky-100 text-sky-800 border border-sky-200"
                            : r.estado === "Cancelada"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : r.estado === "Inasistencia"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {r.estado}
                        </span>
                      </td>
                    )}
                    {visibleColumns.notas && (
                      <td className="px-3.5 py-2.5 text-slate-500 italic truncate max-w-xs">
                        {r.notas}
                      </td>
                    )}
                  </tr>
                ))}

                {sortedData.length === 0 && (
                  <tr>
                    <td
                      colSpan={Object.values(visibleColumns).filter(Boolean).length || 1}
                      className="px-6 py-16 text-center text-slate-400 font-medium text-xs"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FiActivity size={32} className="text-slate-300 stroke-[1.5]" />
                        <span className="text-slate-500 font-bold">No se encontraron consultas registradas</span>
                        <span className="text-[11px] text-slate-400 max-w-md">
                          {appliedFilters.allHistory 
                            ? "No hay citas ni consultas guardadas en el sistema para esta sede."
                            : "No hay consultas en el rango de fechas seleccionado. Prueba marcando 'Ver todo el histórico' o cambiando el profesional."}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── FOOTER CON TOTALIZADORES EN TIEMPO REAL (1:1 ESTÁNDAR ODONTOCLOUD) ─── */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 shrink-0 font-medium">
          <div className="flex items-center gap-4">
            <span>
              Total consultas: <strong className="text-slate-800 font-bold">{stats.total}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Atendidas: <strong className="text-emerald-700 font-bold">{stats.atendidas}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Programadas / Confirmadas: <strong className="text-sky-700 font-bold">{stats.programadas}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Canceladas: <strong className="text-rose-700 font-bold">{stats.canceladas}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Inasistencias: <strong className="text-purple-700 font-bold">{stats.inasistencias}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Tasa de efectividad:</span>
            <span className="font-bold text-slate-900 text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              {stats.efectividad}% cumplidas
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
