import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { 
  FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX, 
  FiRefreshCw, FiCalendar, FiAward, FiUsers, FiDollarSign, FiChevronDown, FiChevronUp 
} from "react-icons/fi";
import { format, isValid, parseISO } from "date-fns";
import * as XLSX from "xlsx";

// Formateador de moneda colombiana
const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `$ ${num.toLocaleString("es-CO")}`;
};

// Formateador seguro de fecha
const formatSafeDate = (rawDate, pattern = "yyyy-MM-dd") => {
  if (!rawDate) return "";
  try {
    const d = rawDate.toDate ? rawDate.toDate() : (typeof rawDate === "string" ? parseISO(rawDate) : new Date(rawDate));
    return isValid(d) ? format(d, pattern) : "";
  } catch (e) {
    return "";
  }
};

export default function ReporteConvenios() {
  const { userProfile } = useAuth();
  
  // Resolución robusta del inquilino / tenant_id
  const tenantId = useMemo(() => {
    return userProfile?.tenant_id || userProfile?.inquilino || userProfile?.tenantId || null;
  }, [userProfile]);

  const [allRecords, setAllRecords] = useState([]);
  const [conveniosList, setConveniosList] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fechas por defecto: primer día del año actual hasta la fecha de hoy
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDay, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [isAllHistory, setIsAllHistory] = useState(false);

  // Selectores de Convenio y Paciente
  const [selectedConvenio, setSelectedConvenio] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [pacienteSearchTerm, setPacienteSearchTerm] = useState("");
  const [convenioSearchTerm, setConvenioSearchTerm] = useState("");
  const [showConvenioDropdown, setShowConvenioDropdown] = useState(false);
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);

  const pacienteInputRef = useRef(null);
  const convenioInputRef = useRef(null);

  // Estado de búsqueda: inicia en TRUE para que el datagrid se dibuje de inmediato con datos reales
  const [hasSearched, setHasSearched] = useState(true);

  // Filtros aplicados al presionar Buscar
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDay, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    convenio: "",
    paciente: "",
    allHistory: false
  });

  // Búsqueda rápida en tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Ordenamiento por columna
  const [sortField, setSortField] = useState("fecha");
  const [sortDirection, setSortDirection] = useState("desc"); // 'asc' | 'desc'

  // Columnas visibles (1:1 OralDrive CovenantReport + Valor Plan opcional)
  const [visibleColumns, setVisibleColumns] = useState({
    paciente: true,
    convenioActual: true,
    titular: true,
    fecha: true,
    beneficiario: true,
    valor: true,
  });

  const columnLabels = {
    paciente: "Paciente",
    convenioActual: "Convenio actual",
    titular: "Titular",
    fecha: "Fecha",
    beneficiario: "Beneficiario",
    valor: "Valor tratamientos",
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
    convenioActual: "",
    titular: "",
    fecha: "",
    beneficiario: "Todo"
  });

  // Cerrar dropdowns si se hace clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pacienteInputRef.current && !pacienteInputRef.current.contains(e.target)) {
        setShowPacienteDropdown(false);
      }
      if (convenioInputRef.current && !convenioInputRef.current.contains(e.target)) {
        setShowConvenioDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Carga unificada de datos desde el VPS PostgreSQL (Multi-tenant y Multi-clínica)
  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Consultas concurrentes protegidas a prueba de fallos
      const [
        convsRes,
        pacRes,
        planesRes,
        webCfgRes,
        cfgItemsRes
      ] = await Promise.all([
        supabase.from("convenios").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("pacientes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).then(r => r, () => ({ data: [] })),
        supabase.from("treatment_plans").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).then(r => r, () => ({ data: [] })),
        supabase.from("website_config").select("config").eq("tenant_id", tenantId).maybeSingle().then(r => r, () => ({ data: null })),
        getConfigItems(tenantId, "convenios", "convenios").catch(() => [])
      ]);

      // 1. Unificar Catálogo de Convenios Configurados
      const mapConveniosCatalog = new Map();

      // De tabla `convenios`
      (convsRes?.data || []).forEach(c => {
        const nom = (c.nombre || c.name || "").trim();
        if (nom) {
          mapConveniosCatalog.set(nom.toLowerCase(), {
            id: c.id,
            nombre: nom,
            activo: c.activo !== false,
            count: 0
          });
        }
      });

      // De `website_config.config.convenios`
      const cfgConvenios = webCfgRes?.data?.config?.convenios || [];
      if (Array.isArray(cfgConvenios)) {
        cfgConvenios.forEach(c => {
          const nom = (c.nombre || c.name || "").trim();
          if (nom && !mapConveniosCatalog.has(nom.toLowerCase())) {
            mapConveniosCatalog.set(nom.toLowerCase(), {
              id: c.id || `cfg_${nom}`,
              nombre: nom,
              activo: c.activo !== false,
              count: 0
            });
          }
        });
      }

      // De `getConfigItems`
      if (Array.isArray(cfgItemsRes)) {
        cfgItemsRes.forEach(c => {
          const nom = (c.nombre || c.name || c.nombreConvenio || "").trim();
          if (nom && !mapConveniosCatalog.has(nom.toLowerCase())) {
            mapConveniosCatalog.set(nom.toLowerCase(), {
              id: c.id || `item_${nom}`,
              nombre: nom,
              activo: true,
              count: 0
            });
          }
        });
      }

      // 2. Procesar Pacientes y Beneficiarios
      const rawPacientes = pacRes?.data || [];
      const listPacsForSuggestions = [];
      const listRecords = [];

      rawPacientes.forEach(p => {
        const nombreCompleto = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || 'Paciente sin nombre';
        const doc = p.documento || p.nroDocumento || p.identificacion || p.nro_historia || '';
        const fechaPac = p.fechaAfiliacion || p.fecha_afiliacion || p.created_at || p.fecha || new Date().toISOString();
        
        // Identificar convenio asignado
        const convPrincipal = (p.convenio || p.convenio_beneficio || p.convenio_pago || p.convenioActual || p.convenioNombre || p.plan_nombre || "").trim();
        
        listPacsForSuggestions.push({
          id: p.id,
          nombre: nombreCompleto,
          documento: doc,
          convenio: convPrincipal
        });

        // Registrar en catálogo si no estaba
        if (convPrincipal && !mapConveniosCatalog.has(convPrincipal.toLowerCase())) {
          mapConveniosCatalog.set(convPrincipal.toLowerCase(), {
            id: `conv_${convPrincipal}`,
            nombre: convPrincipal,
            activo: true,
            count: 0
          });
        }

        // Si el paciente tiene un convenio activo, agregarlo como Titular
        if (convPrincipal && convPrincipal !== "—" && convPrincipal.toLowerCase() !== "particular") {
          const existingConv = mapConveniosCatalog.get(convPrincipal.toLowerCase());
          if (existingConv) existingConv.count += 1;

          listRecords.push({
            id: `pac_${p.id}`,
            pacienteId: p.id,
            paciente: nombreCompleto,
            documento: doc,
            convenioActual: convPrincipal,
            titular: p.titular || p.nombreTitular || nombreCompleto,
            fecha: fechaPac,
            beneficiario: "No",
            parentesco: "Titular",
            valor: Number(p.saldo_favor || 0)
          });
        }

        // Extraer Beneficiarios dependientes registrados en este paciente
        const currentHistorial = p.historial_medico || p.historialMedico || {};
        const rawBeneficiarios = (Array.isArray(p.beneficiarios) && p.beneficiarios.length > 0)
          ? p.beneficiarios
          : (Array.isArray(currentHistorial?.beneficiarios) ? currentHistorial.beneficiarios : []);

        if (Array.isArray(rawBeneficiarios) && rawBeneficiarios.length > 0) {
          rawBeneficiarios.forEach((ben, bIdx) => {
            const benNombre = (ben.nombre || ben.nombreCompleto || ben.nombres || '').trim() || `Beneficiario ${bIdx + 1}`;
            const benDoc = ben.documento || ben.nroDocumento || ben.identificacion || '—';
            const benConv = (ben.convenio || convPrincipal || "Convenio Titular").trim();
            const benParentesco = ben.parentesco || ben.relacion || ben.vinculo || "Beneficiario";
            const benFecha = ben.fecha || ben.created_at || fechaPac;

            if (benConv && !mapConveniosCatalog.has(benConv.toLowerCase())) {
              mapConveniosCatalog.set(benConv.toLowerCase(), {
                id: `conv_${benConv}`,
                nombre: benConv,
                activo: true,
                count: 0
              });
            }

            const existingConv = mapConveniosCatalog.get(benConv.toLowerCase());
            if (existingConv) existingConv.count += 1;

            listRecords.push({
              id: `ben_${p.id}_${ben.id || bIdx}`,
              pacienteId: ben.id || p.id,
              paciente: benNombre,
              documento: benDoc,
              convenioActual: benConv,
              titular: nombreCompleto,
              fecha: benFecha,
              beneficiario: "Sí",
              parentesco: benParentesco,
              valor: 0
            });
          });
        }
      });

      // 3. Procesar Planes de Tratamiento (`treatment_plans`) con Convenio
      const rawPlanes = planesRes?.data || [];
      rawPlanes.forEach(pl => {
        const convPlan = (
          pl.convenio || 
          pl.convenioNombre || 
          pl.cobertura?.entidadNombre || 
          pl.cobertura?.nombreEntidad || 
          pl.entidadNombre || 
          ""
        ).trim();

        if (convPlan && convPlan !== "—" && convPlan.toLowerCase() !== "particular") {
          const pacNom = pl.patientName || pl.nombrePaciente || "Paciente";
          const pacDoc = pl.patientDocument || pl.identificacion || "—";
          const planFecha = pl.createdAt || pl.created_at || new Date().toISOString();
          const planValor = Number(pl.total || pl.valorTotal || pl.valor || 0);

          if (!mapConveniosCatalog.has(convPlan.toLowerCase())) {
            mapConveniosCatalog.set(convPlan.toLowerCase(), {
              id: `conv_${convPlan}`,
              nombre: convPlan,
              activo: true,
              count: 0
            });
          }

          // Verificar si ya tenemos este paciente registrado con este convenio
          const matchExisting = listRecords.find(r => 
            r.paciente.toLowerCase() === pacNom.toLowerCase() && 
            r.convenioActual.toLowerCase() === convPlan.toLowerCase()
          );

          if (matchExisting) {
            // Acumular el valor del tratamiento si ya existe
            matchExisting.valor = (matchExisting.valor || 0) + planValor;
          } else {
            const existingConv = mapConveniosCatalog.get(convPlan.toLowerCase());
            if (existingConv) existingConv.count += 1;

            listRecords.push({
              id: `plan_${pl.id}`,
              pacienteId: pl.patient_id || pl.id,
              paciente: pacNom,
              documento: pacDoc,
              convenioActual: convPlan,
              titular: pacNom,
              fecha: planFecha,
              beneficiario: "No",
              parentesco: "Titular",
              valor: planValor
            });
          }
        }
      });

      // Orden cronológico por fecha descendente por defecto
      listRecords.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

      setPacientesList(listPacsForSuggestions);
      setConveniosList(Array.from(mapConveniosCatalog.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setAllRecords(listRecords);

    } catch (error) {
      console.error("Error cargando reporte de convenios:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId]);

  // Disparo inicial
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sugerencias de pacientes (requiere al menos 2 letras)
  const filteredPatientSuggestions = useMemo(() => {
    const term = pacienteSearchTerm.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return pacientesList.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      p.documento.toLowerCase().includes(term)
    );
  }, [pacientesList, pacienteSearchTerm]);

  // Sugerencias de convenios
  const filteredConvenioSuggestions = useMemo(() => {
    const term = convenioSearchTerm.trim().toLowerCase();
    if (!term) return conveniosList;
    return conveniosList.filter(c => c.nombre.toLowerCase().includes(term));
  }, [conveniosList, convenioSearchTerm]);

  // Manejador del clic en Buscar
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      convenio: selectedConvenio,
      paciente: selectedPaciente,
      allHistory: isAllHistory
    });
  };

  // Restablecer filtros
  const handleResetFilters = () => {
    setFechaInicial(format(firstDay, "yyyy-MM-dd"));
    setFechaFinal(format(now, "yyyy-MM-dd"));
    setIsAllHistory(false);
    setSelectedConvenio("");
    setSelectedPaciente("");
    setPacienteSearchTerm("");
    setConvenioSearchTerm("");
    setTableSearchTerm("");
    setColumnFilters({
      paciente: "",
      convenioActual: "",
      titular: "",
      fecha: "",
      beneficiario: "Todo"
    });
    setAppliedFilters({
      fechaInicial: format(firstDay, "yyyy-MM-dd"),
      fechaFinal: format(now, "yyyy-MM-dd"),
      convenio: "",
      paciente: "",
      allHistory: false
    });
    setHasSearched(true);
  };

  // Filtrado de datos en base a filtros aplicados + búsqueda en tabla + filtros por columna
  const filteredData = useMemo(() => {
    return allRecords.filter(r => {
      // 1. Filtro por Fecha (si no está activo "Ver todo el histórico")
      if (!appliedFilters.allHistory && r.fecha) {
        const rDate = formatSafeDate(r.fecha, "yyyy-MM-dd");
        if (rDate) {
          if (appliedFilters.fechaInicial && rDate < appliedFilters.fechaInicial) return false;
          if (appliedFilters.fechaFinal && rDate > appliedFilters.fechaFinal) return false;
        }
      }

      // 2. Filtro por Convenio
      if (appliedFilters.convenio && appliedFilters.convenio !== "Todos") {
        const convTarget = appliedFilters.convenio.toLowerCase();
        const rConv = (r.convenioActual || "").toLowerCase();
        if (!rConv.includes(convTarget) && !convTarget.includes(rConv)) return false;
      }

      // 3. Filtro por Paciente
      if (appliedFilters.paciente) {
        const pacTarget = appliedFilters.paciente.toLowerCase();
        const rPac = (r.paciente || "").toLowerCase();
        if (!rPac.includes(pacTarget) && !pacTarget.includes(rPac)) return false;
      }

      // 4. Búsqueda rápida global en tabla
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const match =
          (r.paciente && r.paciente.toLowerCase().includes(term)) ||
          (r.documento && r.documento.toLowerCase().includes(term)) ||
          (r.convenioActual && r.convenioActual.toLowerCase().includes(term)) ||
          (r.titular && r.titular.toLowerCase().includes(term)) ||
          (r.beneficiario && r.beneficiario.toLowerCase().includes(term)) ||
          (r.parentesco && r.parentesco.toLowerCase().includes(term));
        if (!match) return false;
      }

      // 5. Filtros por columna individuales
      if (columnFilters.paciente && !r.paciente.toLowerCase().includes(columnFilters.paciente.toLowerCase())) return false;
      if (columnFilters.convenioActual && !r.convenioActual.toLowerCase().includes(columnFilters.convenioActual.toLowerCase())) return false;
      if (columnFilters.titular && !r.titular.toLowerCase().includes(columnFilters.titular.toLowerCase())) return false;
      if (columnFilters.fecha) {
        const rDate = formatSafeDate(r.fecha, "yyyy-MM-dd");
        if (!rDate.includes(columnFilters.fecha)) return false;
      }
      if (columnFilters.beneficiario && columnFilters.beneficiario !== "Todo") {
        if (r.beneficiario !== columnFilters.beneficiario) return false;
      }

      return true;
    });
  }, [allRecords, appliedFilters, tableSearchTerm, columnFilters]);

  // Datos ordenados según columna seleccionada
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "fecha") {
        const timeA = new Date(valA || 0).getTime();
        const timeB = new Date(valB || 0).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (sortField === "valor") {
        const numA = Number(valA || 0);
        const numB = Number(valB || 0);
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      valA = String(valA || "").toLowerCase();
      valB = String(valB || "").toLowerCase();
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  // Manejo de clic en cabecera para ordenar
  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Métricas y totales en tiempo real
  const totalTitulares = useMemo(() => {
    return sortedData.filter(r => r.beneficiario === "No").length;
  }, [sortedData]);

  const totalBeneficiarios = useMemo(() => {
    return sortedData.filter(r => r.beneficiario === "Sí").length;
  }, [sortedData]);

  const totalValorConvenios = useMemo(() => {
    return sortedData.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  }, [sortedData]);

  // Exportar a Excel Institucional formal con metadata
  const handleExportExcel = () => {
    const clinicName = userProfile?.clinica || userProfile?.clinica_nombre || "OdontoCloud";
    const reportDate = format(new Date(), "dd/MM/yyyy HH:mm");

    const excelRows = [
      { A: "ODONTOCLOUD - SOFTWARE ODONTOLÓGICO ESPECIALIZADO", B: "", C: "", D: "", E: "", F: "" },
      { A: `Clínica: ${clinicName}`, B: "", C: "", D: "", E: "", F: "" },
      { A: `Reporte: REPORTE DE CONVENIOS Y BENEFICIARIOS`, B: "", C: "", D: "", E: "", F: "" },
      { A: `Rango: ${appliedFilters.allHistory ? "Todo el histórico" : `${appliedFilters.fechaInicial} a ${appliedFilters.fechaFinal}`}`, B: "", C: "", D: "", E: "", F: "" },
      { A: `Generado por: ${userProfile?.full_name || userProfile?.email || "Usuario"} | ${reportDate}`, B: "", C: "", D: "", E: "", F: "" },
      { A: "", B: "", C: "", D: "", E: "", F: "" }, // Fila vacía
    ];

    // Encabezados de tabla según columnas visibles
    const headerRow = {};
    if (visibleColumns.paciente) headerRow.A = "Paciente";
    if (visibleColumns.convenioActual) headerRow.B = "Convenio actual";
    if (visibleColumns.titular) headerRow.C = "Titular";
    if (visibleColumns.fecha) headerRow.D = "Fecha";
    if (visibleColumns.beneficiario) headerRow.E = "Beneficiario / Vínculo";
    if (visibleColumns.valor) headerRow.F = "Valor tratamientos ($)";
    excelRows.push(headerRow);

    // Filas de datos
    sortedData.forEach(r => {
      const dataRow = {};
      if (visibleColumns.paciente) dataRow.A = `${r.paciente} (${r.documento})`;
      if (visibleColumns.convenioActual) dataRow.B = r.convenioActual;
      if (visibleColumns.titular) dataRow.C = r.titular;
      if (visibleColumns.fecha) dataRow.D = formatSafeDate(r.fecha, "dd/MM/yyyy");
      if (visibleColumns.beneficiario) dataRow.E = r.parentesco ? `${r.beneficiario} (${r.parentesco})` : r.beneficiario;
      if (visibleColumns.valor) dataRow.F = Number(r.valor || 0);
      excelRows.push(dataRow);
    });

    // Fila de resumen
    excelRows.push({ A: "", B: "", C: "", D: "", E: "", F: "" });
    excelRows.push({
      A: `TOTAL REGISTROS: ${sortedData.length}`,
      B: `TITULARES: ${totalTitulares}`,
      C: `BENEFICIARIOS: ${totalBeneficiarios}`,
      D: "",
      E: "VALOR TOTAL:",
      F: totalValorConvenios
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows, { skipHeader: true });
    
    // Autoancho de columnas
    worksheet["!cols"] = [
      { wch: 35 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 22 },
      { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Convenios");
    
    const fileSuffix = appliedFilters.allHistory ? "Historico_Completo" : `${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}`;
    XLSX.writeFile(workbook, `Reporte_Convenios_${fileSuffix}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans text-slate-700">
      
      {/* ─── HEADER & BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-50 text-[#009beb] rounded-xl flex items-center justify-center font-bold border border-sky-100 shadow-xs">
            <FiAward size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 leading-tight">Reporte convenios</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>🏠 Reportes</span>
              <span>/</span>
              <span className="text-slate-500 font-semibold">Reportes convenios</span>
            </div>
          </div>
        </div>

        {/* Acciones principales: Refrescar y Generar Excel */}
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
            disabled={sortedData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <FiDownload size={14} />
            <span>Generar reporte en excel</span>
          </button>
        </div>
      </div>

      {/* ─── FILTROS SUPERIORES (1:1 ORALDRIVE) ─── */}
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

        {/* Fila 2: Convenio / Paciente / Botón Buscar y Limpiar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          {/* Selector de Convenio con Autocomplete y Conteo */}
          <div className="md:col-span-5 relative" ref={convenioInputRef}>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Convenio</label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="TODOS LOS CONVENIOS"
                value={selectedConvenio || convenioSearchTerm}
                onChange={(e) => {
                  setSelectedConvenio("");
                  setConvenioSearchTerm(e.target.value);
                  setShowConvenioDropdown(true);
                }}
                onFocus={() => setShowConvenioDropdown(true)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase pr-8"
              />
              {(selectedConvenio || convenioSearchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConvenio("");
                    setConvenioSearchTerm("");
                    setShowConvenioDropdown(false);
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown de convenios */}
            {showConvenioDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConvenio("");
                    setConvenioSearchTerm("");
                    setShowConvenioDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-lg transition-colors uppercase"
                >
                  -- TODOS LOS CONVENIOS --
                </button>
                {filteredConvenioSuggestions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedConvenio(c.nombre);
                      setConvenioSearchTerm(c.nombre);
                      setShowConvenioDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors uppercase truncate flex items-center justify-between"
                  >
                    <span>{c.nombre}</span>
                    {c.count > 0 && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-1.5 py-0.5 rounded-full">
                        {c.count} {c.count === 1 ? "paciente" : "pacientes"}
                      </span>
                    )}
                  </button>
                ))}
                {filteredConvenioSuggestions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 font-medium text-center">
                    No se encontraron convenios
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Autocomplete de Paciente (aparece al escribir 2 letras o más) */}
          <div className="md:col-span-4 relative" ref={pacienteInputRef}>
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

            {/* Dropdown Pacientes */}
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

          {/* Botones de Acción: Buscar (Verde OralDrive #7cb342) y Limpiar */}
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

            {/* Buscador rápido */}
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

        {/* Tabla de Convenios */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-600">Cargando reporte de convenios...</span>
              <span className="text-[11px] text-slate-400 mt-1">Consultando pacientes, convenios y planes en tiempo real</span>
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
                  {visibleColumns.convenioActual && (
                    <th 
                      onClick={() => handleHeaderSort("convenioActual")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Convenio actual</span>
                        {sortField === "convenioActual" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.titular && (
                    <th 
                      onClick={() => handleHeaderSort("titular")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Titular</span>
                        {sortField === "titular" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.fecha && (
                    <th 
                      onClick={() => handleHeaderSort("fecha")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Fecha</span>
                        {sortField === "fecha" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.beneficiario && (
                    <th 
                      onClick={() => handleHeaderSort("beneficiario")}
                      className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>Beneficiario</span>
                        {sortField === "beneficiario" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                  {visibleColumns.valor && (
                    <th 
                      onClick={() => handleHeaderSort("valor")}
                      className="px-3.5 py-2 whitespace-nowrap text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Valor tratamientos</span>
                        {sortField === "valor" && (sortDirection === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                      </div>
                    </th>
                  )}
                </tr>

                {/* Fila 2: Inputs de filtro por columna (1:1 OralDrive) */}
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
                  {visibleColumns.convenioActual && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.convenioActual}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, convenioActual: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.titular && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          value={columnFilters.titular}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, titular: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.fecha && (
                    <th className="p-1 border-r border-slate-200">
                      <div className="relative flex items-center">
                        <FiSearch className="absolute left-2 text-slate-400" size={11} />
                        <input
                          type="text"
                          placeholder="yyyy-mm-dd"
                          value={columnFilters.fecha}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, fecha: e.target.value }))}
                          className="w-full h-6 pl-6 pr-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                        />
                      </div>
                    </th>
                  )}
                  {visibleColumns.beneficiario && (
                    <th className="p-1 border-r border-slate-200">
                      <select
                        value={columnFilters.beneficiario}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, beneficiario: e.target.value }))}
                        className="w-full h-6 px-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white text-slate-700"
                      >
                        <option value="Todo">(Todo)</option>
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                      </select>
                    </th>
                  )}
                  {visibleColumns.valor && (
                    <th className="p-1">
                      <div className="h-6 bg-slate-50/50 rounded border border-transparent" />
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedData.map((r) => (
                  <tr key={r.id} className="hover:bg-sky-50/40 transition-colors">
                    {visibleColumns.paciente && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-semibold text-slate-800 uppercase">
                        <div>{r.paciente}</div>
                        {r.documento && r.documento !== "—" && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">Doc: {r.documento}</div>
                        )}
                      </td>
                    )}
                    {visibleColumns.convenioActual && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-bold text-sky-700 uppercase">
                        <span className="inline-flex items-center gap-1">
                          <FiAward size={12} className="text-sky-500" />
                          <span>{r.convenioActual}</span>
                        </span>
                      </td>
                    )}
                    {visibleColumns.titular && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 text-slate-700 uppercase">
                        {r.titular || "—"}
                      </td>
                    )}
                    {visibleColumns.fecha && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono text-slate-600">
                        {formatSafeDate(r.fecha, "dd/MM/yyyy") || "—"}
                      </td>
                    )}
                    {visibleColumns.beneficiario && (
                      <td className="px-3.5 py-2.5 border-r border-slate-100">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.beneficiario === "Sí" 
                            ? "bg-amber-100 text-amber-800 border border-amber-200" 
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {r.beneficiario === "Sí" ? `Sí (${r.parentesco || "Beneficiario"})` : "Titular directo"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.valor && (
                      <td className="px-3.5 py-2.5 text-right font-bold text-slate-800 font-mono">
                        {r.valor > 0 ? formatCurrency(r.valor) : "—"}
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
                        <FiAward size={32} className="text-slate-300 stroke-[1.5]" />
                        <span className="text-slate-500 font-bold">No se encontraron registros de convenios</span>
                        <span className="text-[11px] text-slate-400 max-w-md">
                          {appliedFilters.allHistory 
                            ? "No hay pacientes ni planes registrados bajo ningún convenio o beneficio."
                            : "No hay registros en el rango de fechas seleccionado. Prueba marcando 'Ver todo el histórico' o cambiando el filtro de convenio."}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── FOOTER CON TOTALIZADORES EN TIEMPO REAL (1:1 ORALDRIVE) ─── */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 shrink-0 font-medium">
          <div className="flex items-center gap-4">
            <span>
              Total registros: <strong className="text-slate-800 font-bold">{sortedData.length}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Titulares: <strong className="text-emerald-700 font-bold">{totalTitulares}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Beneficiarios: <strong className="text-amber-700 font-bold">{totalBeneficiarios}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Total convenios / tratamientos:</span>
            <span className="font-bold text-slate-900 text-sm font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              {formatCurrency(totalValorConvenios)}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
