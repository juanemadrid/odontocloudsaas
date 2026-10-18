import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getDoctorsList } from "../../../services/supabaseServices";
import { calculateAgeStr } from "../../../utils/formatters";
import { FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX, FiCalendar, FiRefreshCw } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// Formatea números de documento con separadores de miles
const formatDocNumber = (val) => {
  if (val === undefined || val === null || val === "") return "";
  const s = String(val).trim();
  if (s.includes(".") || s.includes("-")) return s;
  if (/^\d{5,12}$/.test(s)) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  return s;
};

// Parser seguro de fecha para comparación Año/Mes (soporta DD/MM/YYYY, YYYY-MM-DD, ISO y Timestamps)
const parseDateToYM = (val) => {
  if (!val) return "";
  if (val?.toDate) {
    const d = val.toDate();
    return !isNaN(d.getTime()) ? format(d, "yyyyMM") : "";
  }
  const s = String(val).trim();
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    return `${year}${month}`;
  }
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    return `${year}${month}`;
  }
  const d = new Date(s);
  return !isNaN(d.getTime()) ? format(d, "yyyyMM") : "";
};

const MESES_NOMBRES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function ReportePacientes() {
  const { userProfile } = useAuth();
  const [allPacientes, setAllPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros principales superiores
  const [selectedYearMonth, setSelectedYearMonth] = useState("");
  const [selectedProfesional, setSelectedProfesional] = useState("TODOS");
  const [filtroFechaTipo, setFiltroFechaTipo] = useState("creacion"); // "creacion" | "ingreso"

  // Selector visual de calendario Año/Mes
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const monthPickerPopRef = useRef(null);

  const [hasSearched, setHasSearched] = useState(true);
  const [expandAllGroups, setExpandAllGroups] = useState(true);
  const tableContainerRef = useRef(null);

  // Filtros aplicados al presionar "Buscar"
  const [appliedFilters, setAppliedFilters] = useState({
    yearMonth: "",
    profesional: "TODOS",
    fechaTipo: "creacion"
  });

  // Filtro de búsqueda rápida global en la tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  // Filtros individuales por columna
  const [columnFilters, setColumnFilters] = useState({});

  // Control de selector de columnas visibles
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Las 42 columnas oficiales de OralDrive en su orden exacto
  const [visibleColumns, setVisibleColumns] = useState({
    fechaIngreso: true,
    fechaCreacion: true,
    tipoDocumento: true,
    documento: true,
    numeroHistoria: true,
    nombre: true,
    apellido: true,
    genero: true,
    rh: true,
    estadoCivil: true,
    fechaNacimiento: true,
    edad: true,
    paisNacimiento: true,
    ciudadNacimiento: true,
    direccion: true,
    paisDomicilio: true,
    ciudadDomicilio: true,
    lugarExpedicion: true,
    barrio: true,
    estrato: true,
    zonaResidencial: true,
    celular: true,
    telefono: true,
    telefonoOficina: true,
    extensionOficina: true,
    correo: true,
    ocupacion: true,
    nombreResponsable: true,
    relacionResponsable: true,
    celularResponsable: true,
    telefonoResponsable: true,
    correoResponsable: true,
    nombreAcompanante: true,
    telefonoAcompanante: true,
    convenio: true,
    tipoAfiliacion: true,
    eps: true,
    polizaSalud: true,
    sgsss: true,
    tipoPaciente: true,
    convenioBeneficio: true,
    convenioPago: true
  });

  const columnLabels = {
    fechaIngreso: "Fecha hora ingreso",
    fechaCreacion: "Fecha hora creación",
    tipoDocumento: "Tipo de documento",
    documento: "Documento",
    numeroHistoria: "Número Historia",
    nombre: "Nombre",
    apellido: "Apellido",
    genero: "Genero",
    rh: "RH",
    estadoCivil: "Estado civil",
    fechaNacimiento: "Fecha de nacimiento",
    edad: "Edad",
    paisNacimiento: "País de nacimiento",
    ciudadNacimiento: "Ciudad de nacimiento",
    direccion: "Dirección",
    paisDomicilio: "País de domicilio",
    ciudadDomicilio: "Ciudad de domicilio",
    lugarExpedicion: "Lugar de expedición del documento",
    barrio: "Barrio",
    estrato: "Estrato",
    zonaResidencial: "Zona residencial",
    celular: "Celular",
    telefono: "Teléfono",
    telefonoOficina: "Teléfono oficina",
    extensionOficina: "Extensión oficina",
    correo: "Correo",
    ocupacion: "Ocupación",
    nombreResponsable: "Nombre del responsable",
    relacionResponsable: "Relación con responsable",
    celularResponsable: "Celular responsable",
    telefonoResponsable: "Teléfono responsable",
    correoResponsable: "Correo responsable",
    nombreAcompanante: "Nombre acompañante",
    telefonoAcompanante: "Teléfono acompañante",
    convenio: "Convenio",
    tipoAfiliacion: "Tipo de afiliación",
    eps: "Eps",
    polizaSalud: "Poliza de salud",
    sgsss: "Sgsss",
    tipoPaciente: "Tipo de paciente",
    convenioBeneficio: "Convenio beneficio",
    convenioPago: "Convenio de pago"
  };

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllColumns = (val) => {
    const updated = {};
    Object.keys(columnLabels).forEach((k) => {
      updated[k] = val;
    });
    setVisibleColumns(updated);
  };

  // Carga de datos optimizada desde PostgreSQL de tu VPS
  const fetchData = useCallback(async () => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;
    setLoading(true);

    try {
      const [docsFromService, profilesRes, pacRes, citasRes, planesRes] = await Promise.all([
        getDoctorsList(userProfile, null).catch((e) => {
          console.warn("Aviso al consultar catálogo de doctores:", e);
          return [];
        }),
        supabase.from("profiles").select("*").eq("tenant_id", tenantId),
        supabase.from("pacientes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("citas").select("*").eq("tenant_id", tenantId),
        supabase.from("treatment_plans").select("*").eq("tenant_id", tenantId)
      ]);

      // Catálogo de profesionales
      const catalogProfs = Array.isArray(docsFromService) ? [...docsFromService] : [];

      (profilesRes?.data || []).forEach((u) => {
        if (isDoctorUser(u)) {
          const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || u.email || "";
          const primerApellido = u.apellido || u.apellidos || "";
          const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;

          if (!catalogProfs.some((d) => String(d.id).toLowerCase() === String(u.id).toLowerCase())) {
            catalogProfs.push({
              id: u.id,
              nombre: nombreCompleto,
              nombreCompleto: nombreCompleto,
              displayName: nombreCompleto,
              email: u.email || "",
              rawName: primerNombre,
              rawLastName: primerApellido,
              especialidades: u.especialidades || ["Odontología General"]
            });
          }
        }
      });

      const docMap = new Map();
      const listProfs = catalogProfs.map((u) => {
        const nom = (u.nombreCompleto || u.nombre || u.displayName || "").trim();
        const uid = String(u.id || "").toLowerCase().trim();
        const nomLower = nom.toLowerCase().trim();

        if (uid && nom) docMap.set(uid, nom);
        if (nomLower) docMap.set(nomLower, nom);

        return {
          id: u.id,
          nombre: nom,
          rawName: u.rawName || nom,
          rawLastName: u.rawLastName || "",
          cleanNameLower: nomLower
        };
      });

      setProfesionales(listProfs);

      const dataPacientes = pacRes?.data || [];
      const snapCitas = citasRes?.data || [];
      const snapPlanes = planesRes?.data || [];

      // Normalización uniforme de pacientes
      const normalized = dataPacientes.map((p) => {
        const fn = p.fecha_nacimiento || p.fechaNacimiento || "";
        const calculatedAge = fn ? calculateAgeStr(fn) : (p.edad || "");
        const pDocStr = String(p.documento || p.nroDocumento || p.identificacion || "").trim();

        const patientCitas = snapCitas.filter((c) => {
          const cPacId = c.paciente_id || c.pacienteId || c.paciente;
          const cDoc = String(c.paciente_documento || c.pacienteDocumento || c.documento || "").trim();
          return (cPacId && String(cPacId) === String(p.id)) || (cDoc && pDocStr && cDoc === pDocStr);
        });

        const patientPlans = snapPlanes.filter((pl) => {
          const plPacId = pl.paciente_id || pl.pacienteId || pl.patientId;
          const plDoc = String(pl.documento || pl.pacienteDocumento || "").trim();
          return (plPacId && String(plPacId) === String(p.id)) || (plDoc && pDocStr && plDoc === pDocStr);
        });

        // Resolución de doctores asociados
        const docNamesSet = new Set();
        const docIdsSet = new Set();

        const addValidDoctor = (nameVal, idVal) => {
          if (nameVal && typeof nameVal === "string") {
            const clean = nameVal.trim();
            if (clean.length >= 3 && clean.toLowerCase() !== "sin asignar") {
              docNamesSet.add(clean);
            }
          }
          if (idVal && typeof idVal === "string") {
            const cleanId = idVal.trim().toLowerCase();
            if (cleanId.length >= 3) {
              docIdsSet.add(cleanId);
              if (docMap.has(cleanId)) {
                docNamesSet.add(docMap.get(cleanId));
              }
            }
          }
        };

        if (Array.isArray(p.profesionales)) {
          p.profesionales.forEach((docItem) => {
            if (typeof docItem === "string") addValidDoctor(docItem, null);
            else if (typeof docItem === "object" && docItem !== null) {
              addValidDoctor(docItem.nombre || docItem.name || docItem.nombreCompleto, docItem.id);
            }
          });
        }

        const hmProfs = p.historial_medico?.profesionales || p.historialMedico?.profesionales;
        if (Array.isArray(hmProfs)) {
          hmProfs.forEach((docItem) => {
            if (typeof docItem === "string") addValidDoctor(docItem, null);
            else if (typeof docItem === "object" && docItem !== null) {
              addValidDoctor(docItem.nombre || docItem.name, docItem.id);
            }
          });
        }

        addValidDoctor(p.profesional_nombre || p.profesionalNombre || p.profesionalAsignado || p.profesional || p.odontologo || p.doctor, p.profesional_id || p.profesionalId || p.odontologo_id || p.doctor_id);

        patientCitas.forEach((c) => {
          addValidDoctor(c.profesional_nombre || c.profesionalNombre || c.doctor || c.doctorNombre, c.profesional_id || c.profesionalId || c.doctor_id || c.doctorId);
        });

        patientPlans.forEach((pl) => {
          const d = pl.detalles || {};
          addValidDoctor(pl.profesional_nombre || pl.doctor || pl.odontologo || d.profesional_nombre || d.doctor, pl.profesional_id || pl.doctor_id || d.profesional_id || d.doctor_id);
        });

        const docNamesArr = Array.from(docNamesSet);
        const docIdsArr = Array.from(docIdsSet);
        const doctorDisplay = docNamesArr.length > 0 ? docNamesArr.join(", ") : "Sin asignar";

        return {
          id: p.id,
          raw: p,
          fechaIngreso: p.historial_medico?.resumen_migracion?.fecha_ingreso_original || p.fecha_ingreso || p.fechaIngreso || p.created_at || p.createdAt || p.fechaCreacion,
          fechaCreacion: p.historial_medico?.resumen_migracion?.fecha_creacion_original || p.created_at || p.fechaCreacion || p.createdAt || p.fecha_creacion,
          tipoDocumento: p.tipo_documento || p.tipoDocumento || p.tipoIdentificacion || "Cédula de ciudadanía",
          documento: p.documento || p.nroDocumento || p.identificacion || "",
          numeroHistoria: p.nro_historia || p.nroHistoria || p.numeroHistoria || p.documento || p.nroDocumento || p.identificacion || "",
          nombre: p.nombres || p.nombre || "",
          apellido: p.apellidos || p.apellido || "",
          genero: p.genero || p.sexo || "Femenino",
          rh: p.rh || p.grupo_sanguineo || "",
          estadoCivil: p.estado_civil || p.estadoCivil || "",
          fechaNacimiento: fn,
          edad: calculatedAge,
          paisNacimiento: p.pais_nacimiento || p.paisNacimiento || "Colombia",
          ciudadNacimiento: p.ciudad_nacimiento || p.ciudadNacimiento || "",
          direccion: p.lugar_residencia || p.lugarResidencia || p.direccion || "",
          paisDomicilio: p.pais_domicilio || p.paisDomicilio || "Colombia",
          ciudadDomicilio: p.ciudad_domicilio || p.ciudadDomicilio || p.ciudad || "",
          lugarExpedicion: p.lugar_expedicion || p.lugarExpedicion || "",
          barrio: p.barrio || "",
          estrato: p.estrato || "",
          zonaResidencial: p.zona_residencial || p.zonaResidencial || p.zona || "",
          celular: p.celular || p.telefono || "",
          telefono: p.telefono_domicilio || p.telDomicilio || "",
          telefonoOficina: p.telefono_oficina || p.telOficina || "",
          extensionOficina: p.extension || p.extensionOficina || "",
          correo: p.email || p.correo || "",
          ocupacion: p.ocupacion || "",
          nombreResponsable: p.nombre_responsable || p.nombreResponsable || p.contacto_emergencia?.nombre || "",
          relacionResponsable: p.parentesco || p.relacionResponsable || p.contacto_emergencia?.parentesco || "",
          celularResponsable: p.celular_responsable || p.celularResponsable || p.contacto_emergencia?.telefono || "",
          telefonoResponsable: p.telefono_responsable || p.telefonoResponsable || "",
          correoResponsable: p.email_responsable || p.correoResponsable || "",
          nombreAcompanante: p.nombre_acompanante || p.nombreAcompanante || "",
          telefonoAcompanante: p.telefono_acompanante || p.telefonoAcompanante || "",
          convenio: p.plan_nombre || p.planNombre || p.convenio || "",
          tipoAfiliacion: p.tipo_afiliacion || p.tipoVinculacion || p.tipoAfiliacion || "",
          eps: p.eps || p.nombre_eps || p.nombreEps || "",
          polizaSalud: p.poliza_salud || p.polizaSalud || "",
          sgsss: p.sgsss || "",
          tipoPaciente: p.tipo_paciente || p.tipoPaciente || "",
          convenioBeneficio: p.convenio_beneficio || p.convenioBeneficio || "",
          convenioPago: p.convenio_pago || p.convenioPago || "",
          doctorNamesList: docNamesArr,
          doctorIdsList: docIdsArr,
          profesionales: doctorDisplay
        };
      });

      const sortedPacientes = normalized.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
      setAllPacientes(sortedPacientes);
    } catch (error) {
      console.error("Error cargando reporte de pacientes desde VPS:", error);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Formateadores de fecha
  const formatDateTime = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateVal)) return dateVal;
    if (dateVal?.toDate) return format(dateVal.toDate(), "dd/MM/yyyy HH:mm");
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? String(dateVal) : format(d, "dd/MM/yyyy HH:mm");
  };

  const formatDateOnly = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateVal)) {
      return dateVal.split(" ")[0];
    }
    if (dateVal?.toDate) return format(dateVal.toDate(), "dd/MM/yyyy");
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? String(dateVal) : format(d, "dd/MM/yyyy");
  };

  // Filtrado principal de tabla
  const filteredData = useMemo(() => {
    return allPacientes.filter((p) => {
      // 1. Filtro superior: Año/Mes
      const rawYm = (appliedFilters.yearMonth || "").trim();
      if (rawYm && rawYm !== "TODOS") {
        const ymInput = rawYm.replace(/\D/g, "");
        if (ymInput.length >= 4) {
          const targetDateRaw = appliedFilters.fechaTipo === "creacion" 
            ? (p.fechaCreacion || p.raw?.created_at || p.raw?.createdAt)
            : (p.fechaIngreso || p.raw?.fecha_ingreso || p.raw?.fechaIngreso || p.fechaCreacion || p.raw?.created_at);

          if (targetDateRaw) {
            const ymPatient = parseDateToYM(targetDateRaw);
            if (!ymPatient || !ymPatient.startsWith(ymInput)) return false;
          } else {
            return false;
          }
        }
      }

      // 2. Filtro superior: Profesional
      if (appliedFilters.profesional && appliedFilters.profesional !== "TODOS") {
        if (appliedFilters.profesional === "SIN_ASIGNAR") {
          const isUnassigned = (p.doctorNamesList || []).length === 0 && (p.doctorIdsList || []).length === 0 && (p.profesionales === "Sin asignar" || !p.profesionales);
          if (!isUnassigned) return false;
        } else {
          const targetProfName = String(appliedFilters.profesional).toLowerCase().trim();
          const profObj = profesionales.find(
            (pr) => pr.nombre === appliedFilters.profesional || pr.id === appliedFilters.profesional
          );
          const targetId = profObj?.id ? String(profObj.id).toLowerCase().trim() : null;

          let matchesDoc = false;

          if (targetId && (p.doctorIdsList || []).includes(targetId)) {
            matchesDoc = true;
          }

          if (!matchesDoc && targetProfName.length >= 3) {
            matchesDoc = (p.doctorNamesList || []).some((dn) => {
              const dnLower = dn.toLowerCase().trim();
              return dnLower === targetProfName || dnLower.includes(targetProfName) || targetProfName.includes(dnLower);
            });
          }

          if (!matchesDoc && targetProfName.length >= 3 && p.profesionales !== "Sin asignar") {
            const displayLower = String(p.profesionales || "").toLowerCase();
            matchesDoc = displayLower.includes(targetProfName);
          }

          if (!matchesDoc) return false;
        }
      }

      // 3. Búsqueda rápida global de tabla
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const matchesGlobal =
          p.nombre.toLowerCase().includes(term) ||
          p.apellido.toLowerCase().includes(term) ||
          p.documento.toLowerCase().includes(term) ||
          p.numeroHistoria.toLowerCase().includes(term) ||
          p.correo.toLowerCase().includes(term) ||
          p.celular.toLowerCase().includes(term) ||
          p.ciudadDomicilio.toLowerCase().includes(term) ||
          p.barrio.toLowerCase().includes(term);
        if (!matchesGlobal) return false;
      }

      // 4. Filtros individuales por columna
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal || filterVal.trim() === "") continue;
        const search = filterVal.toLowerCase().trim();

        let cellValue = "";
        if (colKey === "fechaIngreso") cellValue = formatDateTime(p.fechaIngreso);
        else if (colKey === "fechaCreacion") cellValue = formatDateTime(p.fechaCreacion);
        else if (colKey === "fechaNacimiento") cellValue = formatDateOnly(p.fechaNacimiento);
        else if (colKey === "documento" || colKey === "numeroHistoria") cellValue = formatDocNumber(p[colKey]);
        else cellValue = String(p[colKey] || "");

        if (!cellValue.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [allPacientes, appliedFilters, tableSearchTerm, columnFilters, profesionales]);

  const handleProfesionalChange = (newVal) => {
    setSelectedProfesional(newVal);
  };

  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      yearMonth: selectedYearMonth,
      profesional: selectedProfesional,
      fechaTipo: filtroFechaTipo
    });
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
    toast.success("Filtros aplicados correctamente", { id: "p-search", duration: 1200 });
  };

  const handleResetFilters = () => {
    setSelectedYearMonth("");
    setSelectedProfesional("TODOS");
    setFiltroFechaTipo("creacion");
    setColumnFilters({});
    setTableSearchTerm("");
    setAppliedFilters({
      yearMonth: "",
      profesional: "TODOS",
      fechaTipo: "creacion"
    });
  };

  const handleColumnFilterChange = (colKey, val) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colKey]: val
    }));
  };

  // Exportar reporte completo a Excel
  const handleExportExcel = () => {
    const rows = filteredData.map((p) => {
      const rowObj = {};
      Object.keys(columnLabels).forEach((colKey) => {
        if (visibleColumns[colKey]) {
          const colLabel = columnLabels[colKey];
          if (colKey === "fechaIngreso") rowObj[colLabel] = formatDateTime(p.fechaIngreso);
          else if (colKey === "fechaCreacion") rowObj[colLabel] = formatDateTime(p.fechaCreacion);
          else if (colKey === "fechaNacimiento") rowObj[colLabel] = formatDateOnly(p.fechaNacimiento);
          else if (colKey === "documento" || colKey === "numeroHistoria") rowObj[colLabel] = formatDocNumber(p[colKey]);
          else rowObj[colLabel] = p[colKey] || "";
        }
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Pacientes");
    
    const fileNameSuffix = (appliedFilters.yearMonth || "Completo").replace(/[/\\?%*:|"<>]/g, "-");
    XLSX.writeFile(workbook, `Reporte_Pacientes_${fileNameSuffix}.xlsx`);
    toast.success("Archivo Excel generado con éxito");
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f4f7fb] font-sans text-slate-700 pb-16">
      
      {/* ─── BARRA DE ACCIONES ─── */}
      <div className="flex items-center justify-end px-6 py-2.5 bg-white border-b border-slate-200 shadow-xs shrink-0">
        {/* Botón Generar reporte en Excel (OralDrive) */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-5 py-2 bg-[#009beb] hover:bg-[#0087cd] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl shadow-xs transition-all cursor-pointer"
        >
          <FiDownload size={14} />
          <span>Generar reporte en excel</span>
        </button>
      </div>

      {/* ─── CONTENEDOR DE FILTROS SUPERIOR ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          {/* Año/Mes */}
          <div className="flex items-center gap-3 relative" ref={monthPickerPopRef}>
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Año/Mes</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                placeholder="2026/06"
                className="w-32 h-8 pl-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
              />
              <button
                type="button"
                title="Seleccionar año y mes"
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer rounded hover:bg-slate-100 transition-colors"
              >
                📅
              </button>
            </div>

            {/* Popover de selector Año/Mes */}
            {showMonthPicker && (
              <div className="absolute left-16 top-10 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-56 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2 px-1">
                  <button 
                    type="button"
                    onClick={() => setPickerYear(prev => prev - 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold cursor-pointer"
                  >
                    &lt;
                  </button>
                  <span className="text-sky-600 font-bold">{pickerYear}</span>
                  <button 
                    type="button"
                    onClick={() => setPickerYear(prev => prev + 1)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1 text-[11px] font-medium">
                  {MESES_NOMBRES.map((mes, idx) => {
                    const mVal = String(idx + 1).padStart(2, "0");
                    const ymStr = `${pickerYear}/${mVal}`;
                    const isSelected = selectedYearMonth === ymStr;
                    return (
                      <button
                        key={mes}
                        type="button"
                        onClick={() => {
                          setSelectedYearMonth(ymStr);
                          setShowMonthPicker(false);
                        }}
                        className={`py-1.5 rounded transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-[#009beb] text-white font-bold' 
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {mes}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYearMonth("");
                      setShowMonthPicker(false);
                    }}
                    className="text-[10px] text-slate-500 hover:underline"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMonthPicker(false)}
                    className="text-[10px] text-sky-600 font-bold hover:underline"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profesional */}
          <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-[420px]">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => handleProfesionalChange(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium cursor-pointer"
            >
              <option value="TODOS">Todos los profesionales</option>
              <option value="SIN_ASIGNAR">Sin profesional asignado</option>
              {profesionales.map((prof) => (
                <option key={prof.id} value={prof.nombre}>
                  {prof.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Buscar (Verde OralDrive) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSearchClick}
              className="h-8 px-7 bg-[#8bc34a] hover:bg-[#7cb342] active:scale-[0.98] text-white font-bold text-xs rounded shadow-xs transition-all flex items-center justify-center cursor-pointer"
            >
              <span>Buscar</span>
            </button>

            {appliedFilters.yearMonth && (
              <button
                onClick={handleResetFilters}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded transition-all cursor-pointer"
                title="Limpiar filtros"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Radio Opciones: Mostrar (Fecha de creación / Fecha de ingreso) */}
        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <span className="text-slate-500 font-medium min-w-[60px]">Mostrar</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="filtroFechaTipo"
              checked={filtroFechaTipo === "creacion"}
              onChange={() => {
                setFiltroFechaTipo("creacion");
                setAppliedFilters((prev) => ({ ...prev, fechaTipo: "creacion" }));
              }}
              className="text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Filtro por fecha de creación</span>
            <span
              className="text-slate-400 text-[11px] cursor-help"
              title="Filtra por la fecha en la que se registró el paciente en el sistema"
            >
              ⓘ
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none ml-2">
            <input
              type="radio"
              name="filtroFechaTipo"
              checked={filtroFechaTipo === "ingreso"}
              onChange={() => {
                setFiltroFechaTipo("ingreso");
                setAppliedFilters((prev) => ({ ...prev, fechaTipo: "ingreso" }));
              }}
              className="text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Filtro por fecha de ingreso</span>
            <span
              className="text-slate-400 text-[11px] cursor-help"
              title="Filtra por la fecha de ingreso clínica del paciente"
            >
              ⓘ
            </span>
          </label>
        </div>
      </div>

      {/* ─── TABLA DE RESULTADOS CON TODAS LAS 42 COLUMNAS Y SCROLL HORIZONTAL ─── */}
      {hasSearched && (
        <div className="mx-6 my-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col min-h-[480px] overflow-hidden">
          
          {/* Barra superior de la tabla */}
          <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 font-medium select-none italic">
                Arrastra una columna aquí para agrupar por ella
              </span>
            </div>

            <div className="flex items-center gap-2.5 relative">
              {/* Botón Selector de Columnas */}
              <div className="relative">
                <button
                  title="Selector de columnas visibles"
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer border border-slate-200 ${
                    showColumnSelector ? "bg-sky-100 text-sky-700" : "hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  <FiFileText size={13} />
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 top-9 z-40 w-72 bg-white border border-slate-300 rounded-xl shadow-2xl p-3 animate-fadeIn">
                    <div className="text-xs font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                      <span>Columnas del reporte ({Object.values(visibleColumns).filter(Boolean).length} activas)</span>
                      <button
                        onClick={() => setShowColumnSelector(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#009beb] mb-2 px-1">
                      <button
                        onClick={() => toggleAllColumns(true)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FiCheck size={12} /> Todas
                      </button>
                      <button
                        onClick={() => toggleAllColumns(false)}
                        className="hover:underline text-slate-500 hover:text-red-500 flex items-center gap-1 cursor-pointer"
                      >
                        <FiX size={12} /> Ninguna
                      </button>
                    </div>

                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {Object.keys(columnLabels).map((key) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 text-xs text-slate-600 hover:bg-slate-50 p-1 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={!!visibleColumns[key]}
                            onChange={() => toggleColumn(key)}
                            className="rounded text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="truncate">{columnLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Limpiar Filtros de columna */}
              <button
                title="Limpiar filtros de columna"
                onClick={() => setColumnFilters({})}
                className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer border border-slate-200"
              >
                <FiFilter size={13} />
              </button>

              {/* Campo Buscar rápido */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  className="h-7 pl-8 pr-2.5 w-40 bg-white border border-slate-300 rounded text-xs outline-none focus:border-sky-500 transition-all font-normal"
                />
              </div>
            </div>
          </div>

          {/* Contenedor de la Tabla con Scroll Horizontal y Vertical suave */}
          <div 
            ref={tableContainerRef} 
            className="overflow-x-auto overflow-y-auto max-h-[640px] min-h-[380px] custom-scrollbar border-t border-slate-200"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-[#009beb] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-semibold text-slate-600">Consultando pacientes en tu VPS...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap min-w-[3600px]">
                <thead className="bg-[#fcfdfe] sticky top-0 z-20 border-b border-slate-300 text-slate-700 font-bold shadow-2xs">
                  {/* Fila 1: Títulos de las 42 columnas */}
                  <tr>
                    {Object.keys(columnLabels).map((key) => {
                      if (!visibleColumns[key]) return null;
                      return (
                        <th
                          key={key}
                          className="px-3 py-2 border-r border-slate-200 text-slate-700 text-xs font-bold select-none bg-slate-50"
                        >
                          {columnLabels[key]}
                        </th>
                      );
                    })}
                  </tr>

                  {/* Fila 2: Inputs de Búsqueda y Filtro por Columna con iconos 📅 o 🔍 */}
                  <tr className="bg-white border-b border-slate-200">
                    {Object.keys(columnLabels).map((key) => {
                      if (!visibleColumns[key]) return null;
                      const isDate = key === "fechaIngreso" || key === "fechaCreacion" || key === "fechaNacimiento";
                      return (
                        <th key={`filter-${key}`} className="px-2 py-1 border-r border-slate-200 font-normal">
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-slate-400 text-[10px] pointer-events-none">
                              {isDate ? "📅" : "🔍"}
                            </span>
                            <input
                              type="text"
                              value={columnFilters[key] || ""}
                              onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                              placeholder=""
                              className="w-full h-5 pl-5 pr-1 text-[10px] border border-slate-200 rounded outline-none focus:border-sky-500 text-slate-700 bg-white"
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {filteredData.map((p) => (
                    <tr key={p.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fechaIngreso && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-slate-600">
                          {formatDateTime(p.fechaIngreso)}
                        </td>
                      )}
                      {visibleColumns.fechaCreacion && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-slate-600">
                          {formatDateTime(p.fechaCreacion)}
                        </td>
                      )}
                      {visibleColumns.tipoDocumento && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.tipoDocumento}</td>
                      )}
                      {visibleColumns.documento && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-[#009beb] font-semibold">
                          {formatDocNumber(p.documento)}
                        </td>
                      )}
                      {visibleColumns.numeroHistoria && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-slate-700">
                          {formatDocNumber(p.numeroHistoria)}
                        </td>
                      )}
                      {visibleColumns.nombre && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 font-medium text-slate-800 uppercase">
                          {p.nombre}
                        </td>
                      )}
                      {visibleColumns.apellido && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 font-medium text-slate-800 uppercase">
                          {p.apellido}
                        </td>
                      )}
                      {visibleColumns.genero && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.genero}</td>
                      )}
                      {visibleColumns.rh && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-center">{p.rh}</td>
                      )}
                      {visibleColumns.estadoCivil && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-center">{p.estadoCivil}</td>
                      )}
                      {visibleColumns.fechaNacimiento && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{formatDateOnly(p.fechaNacimiento)}</td>
                      )}
                      {visibleColumns.edad && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.edad}</td>
                      )}
                      {visibleColumns.paisNacimiento && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.paisNacimiento}</td>
                      )}
                      {visibleColumns.ciudadNacimiento && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.ciudadNacimiento}</td>
                      )}
                      {visibleColumns.direccion && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.direccion}</td>
                      )}
                      {visibleColumns.paisDomicilio && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.paisDomicilio}</td>
                      )}
                      {visibleColumns.ciudadDomicilio && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.ciudadDomicilio}</td>
                      )}
                      {visibleColumns.lugarExpedicion && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.lugarExpedicion}</td>
                      )}
                      {visibleColumns.barrio && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.barrio}</td>
                      )}
                      {visibleColumns.estrato && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-center">{p.estrato}</td>
                      )}
                      {visibleColumns.zonaResidencial && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-center">{p.zonaResidencial}</td>
                      )}
                      {visibleColumns.celular && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.celular}</td>
                      )}
                      {visibleColumns.telefono && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.telefono}</td>
                      )}
                      {visibleColumns.telefonoOficina && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.telefonoOficina}</td>
                      )}
                      {visibleColumns.extensionOficina && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.extensionOficina}</td>
                      )}
                      {visibleColumns.correo && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-[#009beb] lowercase">{p.correo}</td>
                      )}
                      {visibleColumns.ocupacion && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.ocupacion}</td>
                      )}
                      {visibleColumns.nombreResponsable && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.nombreResponsable}</td>
                      )}
                      {visibleColumns.relacionResponsable && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.relacionResponsable}</td>
                      )}
                      {visibleColumns.celularResponsable && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.celularResponsable}</td>
                      )}
                      {visibleColumns.telefonoResponsable && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.telefonoResponsable}</td>
                      )}
                      {visibleColumns.correoResponsable && (
                        <td className="px-3 py-2 border-r border-b border-slate-200 text-[#009beb] lowercase">{p.correoResponsable}</td>
                      )}
                      {visibleColumns.nombreAcompanante && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.nombreAcompanante}</td>
                      )}
                      {visibleColumns.telefonoAcompanante && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.telefonoAcompanante}</td>
                      )}
                      {visibleColumns.convenio && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.convenio}</td>
                      )}
                      {visibleColumns.tipoAfiliacion && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.tipoAfiliacion}</td>
                      )}
                      {visibleColumns.eps && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.eps}</td>
                      )}
                      {visibleColumns.polizaSalud && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.polizaSalud}</td>
                      )}
                      {visibleColumns.sgsss && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.sgsss}</td>
                      )}
                      {visibleColumns.tipoPaciente && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.tipoPaciente}</td>
                      )}
                      {visibleColumns.convenioBeneficio && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.convenioBeneficio}</td>
                      )}
                      {visibleColumns.convenioPago && (
                        <td className="px-3 py-2 border-r border-b border-slate-200">{p.convenioPago}</td>
                      )}
                    </tr>
                  ))}

                  {filteredData.length === 0 && (
                    <tr>
                      <td
                        colSpan={Object.values(visibleColumns).filter(Boolean).length || 1}
                        className="px-6 py-16 text-center"
                      >
                        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                          <span className="text-sm font-bold text-slate-700 mb-1">
                            No se encontraron pacientes para los filtros seleccionados
                          </span>
                          <p className="text-xs text-slate-400 mb-4 text-center leading-relaxed">
                            {appliedFilters.profesional !== "TODOS" ? `Profesional: "${appliedFilters.profesional}". ` : ""}
                            {appliedFilters.yearMonth ? `Período: "${appliedFilters.yearMonth}". ` : ""}
                            Puedes seleccionar "Todos los profesionales" o limpiar el mes para consultar más pacientes.
                          </p>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                          >
                            Ver todos los pacientes ({allPacientes.length})
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla con totalizador */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0 font-medium">
            <span>
              Total de registros: <strong>{filteredData.length}</strong> de <strong>{allPacientes.length}</strong> pacientes
            </span>
            {filteredData.length < allPacientes.length && (
              <span className="text-slate-400 text-[11px]">
                (Filtrado por: {appliedFilters.profesional !== "TODOS" ? appliedFilters.profesional : "Todos"} {appliedFilters.yearMonth ? `| ${appliedFilters.yearMonth}` : "| Histórico"})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
