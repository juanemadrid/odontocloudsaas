import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import {
  FiSearch,
  FiFileText,
  FiFilter,
  FiDownload,
  FiPrinter,
  FiEye,
  FiX,
  FiActivity,
  FiUser,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiLayers,
  FiRefreshCw,
  FiAlertCircle
} from "react-icons/fi";
import { format, parseISO, isValid } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteEvoluciones() {
  const { userProfile } = useAuth();
  const [evolucionesList, setEvolucionesList] = useState([]);
  const [filteredEvoluciones, setFilteredEvoluciones] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [profesionalesList, setProfesionalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive (Fecha inicial, Fecha final, Oficina, Profesional)
  const [fechaInicial, setFechaInicial] = useState("2026-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("Todas las oficinas");
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  const [hasSearched, setHasSearched] = useState(false);

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2026-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "Todas las oficinas",
    profesional: "Todos"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Modal para ver detalle completo de la evolución clínica
  const [selectedEvoModal, setSelectedEvoModal] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaHora: true,
    profesional: true,
    sucursal: true,
    tipoDocPaciente: true,
    numDocPaciente: true,
    nombrePaciente: true,
    diagnostico: true,
    evolucion: true,
    acciones: true
  });

  const columnLabels = {
    fechaHora: "Fecha y Hora Evolución",
    profesional: "Profesional / Odontólogo",
    sucursal: "Sucursal / Sede",
    tipoDocPaciente: "T. Doc.",
    numDocPaciente: "Num. Doc. Paciente",
    nombrePaciente: "Nombre Paciente",
    diagnostico: "Diagnóstico (CIE-10)",
    evolucion: "Evolución / Nota Clínica",
    acciones: "Acciones"
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Carga de datos reales vinculando evoluciones + pacientes + profesionales
  const fetchEvolucionesData = async () => {
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

      // 2. Cargar Perfiles / Profesionales Odontólogos
      let snapUsers = [];
      try {
        const { data } = await supabase.from("profiles").select("*").eq("tenant_id", tenantId);
        if (data) snapUsers = data;
      } catch (_) {}

      const profMap = {};
      (snapUsers || []).forEach(u => {
        const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
        const primerApellido = u.apellido || u.apellidos || "";
        const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email || "Doctor tratante";
        profMap[u.id] = nombreCompleto;
      });

      // Filtrar estrictamente: Solo personas con rol de doctor / profesionales médicos
      const listProf = (snapUsers || [])
        .filter(u => isDoctorUser(u))
        .map(u => {
          const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
          const primerApellido = u.apellido || u.apellidos || "";
          const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email || "Doctor tratante";
          return {
            id: u.id,
            nombre: nombreCompleto,
            cargo: u.cargo || u.especialidad || "Doctor"
          };
        });
      setProfesionalesList(listProf);

      // 3. Cargar Directorio de Pacientes reales para resolver nombres y documentos
      let snapPacientes = [];
      try {
        const { data } = await supabase.from("pacientes").select("*").eq("tenant_id", tenantId);
        if (data) snapPacientes = data;
      } catch (_) {}

      const pacMap = {};
      (snapPacientes || []).forEach(p => {
        const primerNombre = p.nombres || p.nombre || "";
        const primerApellido = p.apellidos || p.apellido || "";
        const nombreCompleto = (p.nombreCompleto || `${primerNombre} ${primerApellido}`).trim() || "Paciente sin nombre";
        const doc = p.documento || p.nroDocumento || p.identificacion || "";
        const tDoc = p.tipo_documento || p.tipoDocumento || "CC";
        const obj = {
          id: p.id,
          nombre: nombreCompleto,
          documento: doc,
          tipoDocumento: tDoc,
          sucursal: p.sucursal || p.sucursal_id || (listSuc[1]?.nombre || "SEDE PRINCIPAL"),
          telefono: p.telefono || p.celular || ""
        };
        pacMap[p.id] = obj;
        if (doc) pacMap[doc] = obj;
      });

      // 4. Cargar Evoluciones Clínicas reales
      let snapEvo = [];
      try {
        const { data, error } = await supabase
          .from("evoluciones")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (data && !error) snapEvo = data;
      } catch (_) {}

      const defaultSucursal = listSuc[1]?.nombre || "CLINICA DENTAL SINCELEJO - SEDE PRINCIPAL";
      const listEvo = [];

      (snapEvo || []).forEach(e => {
        // Parsear tratamiento estructurado si viene como JSON
        let parsedTratamiento = {};
        if (e.tratamiento) {
          if (typeof e.tratamiento === "object") {
            parsedTratamiento = e.tratamiento;
          } else if (typeof e.tratamiento === "string" && e.tratamiento.trim().startsWith("{")) {
            try {
              parsedTratamiento = JSON.parse(e.tratamiento);
            } catch (_) {}
          }
        }

        // Fecha de evolución
        let dateObj = null;
        if (e.fecha) {
          dateObj = new Date(e.fecha);
        } else if (e.created_at) {
          dateObj = new Date(e.created_at);
        }
        if (!dateObj || isNaN(dateObj.getTime())) dateObj = new Date();

        // Paciente resuelto
        const pacId = e.paciente_id || e.pacienteId;
        const pac = pacMap[pacId] || pacMap[e.pacienteDocumento] || pacMap[e.documento] || {};
        const pacNombre = pac.nombre || e.pacienteNombre || e.paciente || "Paciente sin registrar";
        const pacDoc = pac.documento || e.pacienteDocumento || e.documento || "—";
        const pacTipoDoc = pac.tipoDocumento || e.tipoDocPaciente || "CC";

        // Profesional tratante resuelto
        const profId = e.profesional_id || e.profesionalId || e.doctorId || parsedTratamiento.profesionalId || parsedTratamiento.doctorId;
        let profNombre = profMap[profId];
        if (!profNombre) {
          profNombre = e.profesionalNombre || parsedTratamiento.profesional || parsedTratamiento.profesionalNombre || e.odontologo || e.doctor || (profId ? "Odontólogo tratante" : "Sin asignar");
        }

        // Sucursal
        const suc = e.sucursal || e.oficina || pac.sucursal || defaultSucursal;

        // Diagnóstico CIE-10
        const diagCandidate = e.diagnostico || e.cie10Nombre || e.cie10Code || parsedTratamiento.diagnostico || parsedTratamiento.dxPrincipal || "";
        const diagTexto = typeof diagCandidate === "object" ? (diagCandidate.name || diagCandidate.nombre || diagCandidate.code || "") : String(diagCandidate).trim();

        // Procedimiento / CUPS
        const procCandidate = e.procedimiento_cups || e.procedimiento || parsedTratamiento.procedimientoTexto || parsedTratamiento.procedimiento || parsedTratamiento.nombre || "";
        const procTexto = typeof procCandidate === "object" ? (procCandidate.name || procCandidate.nombre || procCandidate.codigo || "") : String(procCandidate).trim();

        // Notas y descripción de la evolución clínica
        const notaCandidate = e.notas || e.nota || e.comentario || parsedTratamiento.description || parsedTratamiento.comentario || parsedTratamiento.notas || e.descripcion || "";
        const notaCompleta = typeof notaCandidate === "object" ? JSON.stringify(notaCandidate) : String(notaCandidate).trim();

        // Resumen para visualización en tabla
        let evolucionResumen = "";
        if (notaCompleta && notaCompleta.length > 0) {
          evolucionResumen = notaCompleta;
        } else if (procTexto && diagTexto) {
          evolucionResumen = `${procTexto} — ${diagTexto}`;
        } else if (procTexto) {
          evolucionResumen = procTexto;
        } else if (diagTexto) {
          evolucionResumen = diagTexto;
        } else {
          evolucionResumen = "Evolución clínica registrada";
        }

        listEvo.push({
          id: e.id,
          fechaHoraRaw: dateObj,
          fechaHoraStr: format(dateObj, "dd/MM/yyyy HH:mm"),
          profesional: profNombre,
          profesionalId: profId,
          sucursal: suc,
          tipoDocPaciente: pacTipoDoc,
          numDocPaciente: pacDoc,
          nombrePaciente: pacNombre,
          telefonoPaciente: pac.telefono || "",
          diagnostico: diagTexto || "—",
          procedimiento: procTexto || "—",
          notas: notaCompleta || "Sin observaciones adicionales",
          evolucion: evolucionResumen,
          dientes: parsedTratamiento.dientes || e.dientes || "",
          raw: e,
          parsedTratamiento
        });
      });

      listEvo.sort((a, b) => b.fechaHoraRaw - a.fechaHoraRaw);
      setEvolucionesList(listEvo);

      // Filtrar y activar visualización de inmediato
      processFilterData(listEvo, appliedFilters, "");
      setHasSearched(true);

    } catch (error) {
      console.error("Error cargando reporte de evoluciones:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvolucionesData();
  }, [userProfile?.inquilino, userProfile?.tenant_id]);

  const processFilterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(e => {
      // Filtro de fecha
      if (filters.fechaInicial && filters.fechaFinal) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (e.fechaHoraRaw < init || e.fechaHoraRaw > end) return false;
      }

      // Filtro de Oficina
      if (filters.oficina && filters.oficina !== "Todas las oficinas" && filters.oficina !== "TODAS") {
        const targetOf = filters.oficina.toLowerCase();
        const eOf = (e.sucursal || "").toLowerCase();
        if (!eOf.includes(targetOf) && !targetOf.includes(eOf)) return false;
      }

      // Filtro de Profesional
      if (filters.profesional && filters.profesional !== "Todos" && filters.profesional !== "TODOS") {
        const targetProf = filters.profesional.toLowerCase();
        const eProf = (e.profesional || "").toLowerCase();
        if (!eProf.includes(targetProf) && !targetProf.includes(eProf)) return false;
      }

      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(e => (
        e.nombrePaciente.toLowerCase().includes(term) ||
        e.numDocPaciente.toLowerCase().includes(term) ||
        e.profesional.toLowerCase().includes(term) ||
        e.sucursal.toLowerCase().includes(term) ||
        e.diagnostico.toLowerCase().includes(term) ||
        e.procedimiento.toLowerCase().includes(term) ||
        e.evolucion.toLowerCase().includes(term) ||
        e.notas.toLowerCase().includes(term)
      ));
    }

    setFilteredEvoluciones(result);
  };

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      oficina,
      profesional: selectedProfesional
    };
    setAppliedFilters(newFilters);
    processFilterData(evolucionesList, newFilters, tableSearchTerm);
  };

  // KPIs resumen
  const totalEvoluciones = useMemo(() => filteredEvoluciones.length, [filteredEvoluciones]);

  const totalPacientesUnicos = useMemo(() => {
    const s = new Set();
    filteredEvoluciones.forEach(e => {
      if (e.numDocPaciente && e.numDocPaciente !== "—") s.add(e.numDocPaciente);
      else if (e.nombrePaciente) s.add(e.nombrePaciente);
    });
    return s.size;
  }, [filteredEvoluciones]);

  const totalProfesionalesActivos = useMemo(() => {
    const s = new Set();
    filteredEvoluciones.forEach(e => {
      if (e.profesional && e.profesional !== "—" && e.profesional !== "Sin asignar") s.add(e.profesional);
    });
    return s.size;
  }, [filteredEvoluciones]);

  const totalConDiagnostico = useMemo(() => {
    return filteredEvoluciones.filter(e => e.diagnostico && e.diagnostico !== "—").length;
  }, [filteredEvoluciones]);

  const handleExportExcel = () => {
    if (filteredEvoluciones.length === 0) return;

    const rows = filteredEvoluciones.map((e, idx) => ({
      "#": idx + 1,
      "Fecha y Hora": e.fechaHoraStr,
      "Profesional": e.profesional,
      "Sucursal / Sede": e.sucursal,
      "T. Doc. Paciente": e.tipoDocPaciente,
      "Num. Doc. Paciente": e.numDocPaciente,
      "Nombre Paciente": e.nombrePaciente,
      "Teléfono": e.telefonoPaciente,
      "Diagnóstico (CIE-10)": e.diagnostico,
      "Procedimiento": e.procedimiento,
      "Notas Clínicas / Observaciones": e.notas
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Evoluciones Clínicas");
    XLSX.writeFile(workbook, `Reporte_Evoluciones_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  const handlePrintModal = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB (1:1 ESTÁNDAR ODONTOCLOUD) ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200/80 shrink-0 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <FiActivity size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-800 tracking-tight">Reporte de evoluciones</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100/70 text-sky-700 border border-sky-200/50">
                Historial Clínico
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>🏠 Reportes</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Reporte de evoluciones clínicas</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchEvolucionesData()}
            title="Recargar datos clínicos"
            className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredEvoluciones.length === 0}
            className="h-8 px-3.5 rounded-lg bg-[#009beb] hover:bg-[#0087cd] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <FiDownload size={13} />
            <span>Generar reporte en excel</span>
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

          {/* Fila 2: Oficina + Profesional + Botón Buscar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            
            <div className="md:col-span-2">
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

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Profesional
              </label>
              <select
                value={selectedProfesional}
                onChange={(e) => setSelectedProfesional(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all uppercase"
              >
                <option value="Todos">Todos los profesionales</option>
                {profesionalesList.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
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

        {/* ─── TARJETAS KPI RESUMEN EJECUTIVO ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <FiActivity size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Evoluciones
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalEvoluciones}
                </span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                  Registradas
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FiUser size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pacientes Atendidos
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalPacientesUnicos}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Únicos
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FiLayers size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Doctores con Notas
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalProfesionalesActivos}
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  Tratantes
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FiCheckCircle size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Con Diagnóstico CIE
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalConDiagnostico}
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  {totalEvoluciones > 0 ? `${((totalConDiagnostico / totalEvoluciones) * 100).toFixed(0)}%` : "0%"}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ─── TABLA DE RESULTADOS DATAGRID (SÓLIDA Y PROFESIONAL) ─── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          
          {/* Barra de herramientas */}
          <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Historial de Evoluciones ({filteredEvoluciones.length} notas clínicas)
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
                  placeholder="Buscar paciente, cédula, doctor..."
                  value={tableSearchTerm}
                  onChange={(e) => {
                    setTableSearchTerm(e.target.value);
                    processFilterData(evolucionesList, appliedFilters, e.target.value);
                  }}
                  className="h-8 pl-8 pr-3 w-60 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-14 text-slate-400">
                <div className="w-7 h-7 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-bold text-slate-600">Cargando evoluciones clínicas reales...</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Sincronizando información de pacientes y profesionales</span>
              </div>
            ) : filteredEvoluciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
                  <FiAlertCircle size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Sin evoluciones registradas en este periodo</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                  No se encontraron notas de evolución para la sede o profesional seleccionado entre {appliedFilters.fechaInicial} y {appliedFilters.fechaFinal}.
                </p>
                <button
                  onClick={() => {
                    setFechaInicial("2020-04-22");
                    setFechaFinal(format(new Date(), "yyyy-MM-dd"));
                    setOficina("Todas las oficinas");
                    setSelectedProfesional("Todos");
                    handleSearchClick();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Ampliar rango de fechas
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fechaHora && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap w-36">
                        Fecha y Hora
                      </th>
                    )}
                    {visibleColumns.profesional && (
                      <th className="px-4 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[180px]">
                        Profesional
                      </th>
                    )}
                    {visibleColumns.sucursal && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[200px]">
                        Sucursal
                      </th>
                    )}
                    {visibleColumns.tipoDocPaciente && (
                      <th className="px-2.5 py-2.5 border-r border-slate-200/70 text-center w-16">
                        T. Doc.
                      </th>
                    )}
                    {visibleColumns.numDocPaciente && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap w-32 font-mono">
                        Num. Documento
                      </th>
                    )}
                    {visibleColumns.nombrePaciente && (
                      <th className="px-4 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[200px]">
                        Nombre Paciente
                      </th>
                    )}
                    {visibleColumns.diagnostico && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap min-w-[170px]">
                        Diagnóstico (CIE)
                      </th>
                    )}
                    {visibleColumns.evolucion && (
                      <th className="px-4 py-2.5 border-r border-slate-200/70 min-w-[240px]">
                        Evolución / Nota Clínica
                      </th>
                    )}
                    {visibleColumns.acciones && (
                      <th className="px-3 py-2.5 whitespace-nowrap text-center w-24 print:hidden">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredEvoluciones.map((e) => (
                    <tr key={e.id} className="hover:bg-sky-50/40 transition-colors">
                      
                      {visibleColumns.fechaHora && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap font-medium text-slate-600">
                          {e.fechaHoraStr}
                        </td>
                      )}

                      {visibleColumns.profesional && (
                        <td className="px-4 py-2.5 border-r border-slate-100 whitespace-nowrap font-semibold text-slate-800">
                          {e.profesional}
                        </td>
                      )}

                      {visibleColumns.sucursal && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 uppercase text-[11px] text-slate-600 whitespace-nowrap font-medium">
                          {e.sucursal}
                        </td>
                      )}

                      {visibleColumns.tipoDocPaciente && (
                        <td className="px-2.5 py-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {e.tipoDocPaciente}
                          </span>
                        </td>
                      )}

                      {visibleColumns.numDocPaciente && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {e.numDocPaciente}
                        </td>
                      )}

                      {visibleColumns.nombrePaciente && (
                        <td className="px-4 py-2.5 border-r border-slate-100 font-bold text-slate-900 whitespace-nowrap">
                          {e.nombrePaciente}
                        </td>
                      )}

                      {visibleColumns.diagnostico && (
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                          {e.diagnostico && e.diagnostico !== "—" ? (
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 font-semibold text-[11px]">
                              {e.diagnostico}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.evolucion && (
                        <td className="px-4 py-2.5 border-r border-slate-100 text-slate-600 max-w-sm truncate" title={e.notas || e.evolucion}>
                          {e.evolucion}
                        </td>
                      )}

                      {visibleColumns.acciones && (
                        <td className="px-3 py-2.5 text-center whitespace-nowrap print:hidden">
                          <button
                            onClick={() => setSelectedEvoModal(e)}
                            className="px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            title="Ver detalle completo de la evolución"
                          >
                            <FiEye size={12} />
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
          {filteredEvoluciones.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <span>
                Mostrando <strong>{filteredEvoluciones.length}</strong> de <strong>{evolucionesList.length}</strong> evoluciones registradas.
              </span>
              <span className="font-semibold text-slate-700">
                {totalPacientesUnicos} pacientes atendidos en este periodo
              </span>
            </div>
          )}

        </div>

      </div>

      {/* ─── MODAL PANORÁMICO DE DETALLE COMPLETO DE EVOLUCIÓN (100% FUNCIONAL) ─── */}
      {selectedEvoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <FiFileText size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Detalle de Evolución Clínica
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>Fecha: <strong>{selectedEvoModal.fechaHoraStr}</strong></span>
                    <span>•</span>
                    <span>Sede: <strong>{selectedEvoModal.sucursal}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintModal}
                  className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Imprimir esta evolución clínica"
                >
                  <FiPrinter size={13} />
                  <span>Imprimir</span>
                </button>

                <button
                  onClick={() => setSelectedEvoModal(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                  title="Cerrar ventana"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Contenido Clínico Detallado */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              
              {/* Tarjetas resumen Paciente y Profesional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Datos del Paciente */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <FiUser size={13} className="text-sky-600" />
                    <span>Datos del Paciente</span>
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {selectedEvoModal.nombrePaciente}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                        {selectedEvoModal.tipoDocPaciente} {selectedEvoModal.numDocPaciente}
                      </span>
                      {selectedEvoModal.telefonoPaciente && (
                        <span>Tel: {selectedEvoModal.telefonoPaciente}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Datos del Profesional */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <FiActivity size={13} className="text-emerald-600" />
                    <span>Profesional Tratante</span>
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {selectedEvoModal.profesional}
                    </h4>
                    <span className="text-xs text-slate-500 block mt-1">
                      Sede: {selectedEvoModal.sucursal}
                    </span>
                  </div>
                </div>

              </div>

              {/* Diagnóstico y Procedimiento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-4 rounded-xl border border-slate-200/70 space-y-1.5 bg-white">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Diagnóstico Clínico (CIE-10)
                  </span>
                  <div className="text-xs font-bold text-slate-800">
                    {selectedEvoModal.diagnostico && selectedEvoModal.diagnostico !== "—" ? (
                      <span className="inline-block px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                        {selectedEvoModal.diagnostico}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">No especificado en el registro</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 space-y-1.5 bg-white">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Procedimiento Realizado / CUPS
                  </span>
                  <div className="text-xs font-bold text-slate-800">
                    {selectedEvoModal.procedimiento && selectedEvoModal.procedimiento !== "—" ? (
                      <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        {selectedEvoModal.procedimiento}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">Atención general de evolución</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Piezas dentales si existen */}
              {selectedEvoModal.dientes && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                  <strong className="font-bold">Dientes / Piezas tratadas:</strong> {selectedEvoModal.dientes}
                </div>
              )}

              {/* Nota Clínica Completa */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Notas Clínicas / Descripción de la Evolución
                </span>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedEvoModal.notas || selectedEvoModal.evolucion}
                </div>
              </div>

            </div>

            {/* Pie del modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                Identificador: <span className="font-mono text-[11px]">{selectedEvoModal.id}</span>
              </span>
              <button
                onClick={() => setSelectedEvoModal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
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
