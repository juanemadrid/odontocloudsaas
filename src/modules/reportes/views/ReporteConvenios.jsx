import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteConvenios() {
  const { userProfile } = useAuth();
  const [allRecords, setAllRecords] = useState([]);
  const [conveniosList, setConveniosList] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fechas por defecto (Primer día del año / mes actual y hoy)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDay, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));

  // Selectores de Convenio y Paciente
  const [selectedConvenio, setSelectedConvenio] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [pacienteSearchTerm, setPacienteSearchTerm] = useState("");
  const [convenioSearchTerm, setConvenioSearchTerm] = useState("");
  const [showConvenioDropdown, setShowConvenioDropdown] = useState(false);
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);

  const pacienteInputRef = useRef(null);
  const convenioInputRef = useRef(null);

  // Estado de si se ha presionado Buscar
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros aplicados al presionar Buscar
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDay, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    convenio: "",
    paciente: ""
  });

  // Búsqueda rápida en tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Columnas visibles (1:1 OralDrive CovenantReport)
  const [visibleColumns, setVisibleColumns] = useState({
    paciente: true,
    convenioActual: true,
    titular: true,
    fecha: true,
    beneficiario: true,
  });

  const columnLabels = {
    paciente: "Paciente",
    convenioActual: "Convenio actual",
    titular: "Titular",
    fecha: "Fecha",
    beneficiario: "Beneficiario",
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

  useEffect(() => {
    const fetchData = async () => {
      const tenantId = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";
      setLoading(true);
      try {
        // 1. Cargar Convenios registrados
        let listConv = [];
        try {
          const cfgConvenios = await getConfigItems(tenantId, "convenios", "convenios");
          if (Array.isArray(cfgConvenios) && cfgConvenios.length > 0) {
            listConv = cfgConvenios.map(c => ({
              id: c.id,
              nombre: c.nombre || c.name || c.nombreConvenio || "Sin nombre"
            }));
          }
        } catch (e) {}

        if (listConv.length === 0) {
          try {
            const { data } = await supabase
              .from("convenios")
              .select("*")
              .eq("tenant_id", tenantId);
            if (data && data.length > 0) {
              listConv = data.map(c => ({ id: c.id, nombre: c.nombre || c.name || "Sin nombre" }));
            }
          } catch (e) {}
        }
        setConveniosList(listConv);

        // 2. Cargar Pacientes
        let snapPacientes = [];
        try {
          const { data } = await supabase
            .from("pacientes")
            .select("*")
            .eq("tenant_id", tenantId);
          if (data) snapPacientes = data;
        } catch (e) {}

        const listPacs = (snapPacientes || []).map(p => {
          const nom = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || 'Sin nombre';
          const doc = p.documento || p.nroDocumento || p.identificacion || '';
          return {
            id: p.id,
            nombre: nom,
            documento: doc,
            convenio: p.convenio || p.convenio_beneficio || p.convenio_pago || p.convenioActual || p.convenioNombre || "",
            titular: p.titular || p.nombreTitular || (p.esTitular ? nom : "—"),
            beneficiario: p.beneficiario ? (typeof p.beneficiario === 'boolean' ? (p.beneficiario ? 'Sí' : 'No') : p.beneficiario) : (p.parentesco || 'No'),
            fecha: p.fechaAfiliacion || p.fecha_afiliacion || p.created_at || p.fecha || new Date().toISOString()
          };
        });
        setPacientesList(listPacs);

        // 3. Cargar registros de convenios desde pacientes y planes de tratamiento
        const listRecords = [];

        // Pacientes con convenio registrado
        listPacs.forEach(p => {
          if (p.convenio && p.convenio !== "—" && p.convenio !== "") {
            listRecords.push({
              id: `pac_${p.id}`,
              paciente: p.nombre,
              documento: p.documento,
              convenioActual: p.convenio,
              titular: p.titular || p.nombre,
              fecha: p.fecha,
              beneficiario: p.beneficiario || "No"
            });
          }
        });

        // Planes de tratamiento con convenio
        try {
          const { data: snapPlanes } = await supabase
            .from("treatment_plans")
            .select("*")
            .eq("tenant_id", tenantId);

          (snapPlanes || []).forEach(p => {
            if (p.convenio || p.convenioNombre || p.convenioId) {
              const convNom = p.convenio || p.convenioNombre || "Convenio Institucional";
              const pacNom = p.patientName || p.nombrePaciente || "Paciente";
              // Evitar duplicar si ya existe
              const exists = listRecords.some(r => r.paciente.toLowerCase() === pacNom.toLowerCase() && r.convenioActual.toLowerCase() === convNom.toLowerCase());
              if (!exists) {
                listRecords.push({
                  id: `plan_${p.id}`,
                  paciente: pacNom,
                  documento: p.patientDocument || p.identificacion || "—",
                  convenioActual: convNom,
                  titular: pacNom,
                  fecha: p.createdAt || p.created_at || new Date().toISOString(),
                  beneficiario: "No"
                });
              }
            }
          });
        } catch (e) {}

        listRecords.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
        setAllRecords(listRecords);

      } catch (error) {
        console.error("Error cargando reporte de convenios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  // Filtrado de pacientes solo cuando se escribe >= 2 letras (Requerimiento estricto del usuario)
  const filteredPatientSuggestions = useMemo(() => {
    const term = pacienteSearchTerm.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return pacientesList.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      p.documento.toLowerCase().includes(term)
    );
  }, [pacientesList, pacienteSearchTerm]);

  // Filtrado de convenios para el dropdown
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
      paciente: selectedPaciente
    });
  };

  // Filtrado de datos en base a los filtros aplicados
  const filteredData = useMemo(() => {
    if (!hasSearched) return [];

    return allRecords.filter(r => {
      // 1. Filtro por Fecha
      if (r.fecha) {
        const d = r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha);
        const rDate = format(d, "yyyy-MM-dd");
        if (appliedFilters.fechaInicial && rDate < appliedFilters.fechaInicial) return false;
        if (appliedFilters.fechaFinal && rDate > appliedFilters.fechaFinal) return false;
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

      // 4. Búsqueda rápida en tabla
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const match =
          (r.paciente && r.paciente.toLowerCase().includes(term)) ||
          (r.convenioActual && r.convenioActual.toLowerCase().includes(term)) ||
          (r.titular && r.titular.toLowerCase().includes(term)) ||
          (r.beneficiario && r.beneficiario.toLowerCase().includes(term));
        if (!match) return false;
      }

      // 5. Filtros por columna individuales
      if (columnFilters.paciente && !r.paciente.toLowerCase().includes(columnFilters.paciente.toLowerCase())) return false;
      if (columnFilters.convenioActual && !r.convenioActual.toLowerCase().includes(columnFilters.convenioActual.toLowerCase())) return false;
      if (columnFilters.titular && !r.titular.toLowerCase().includes(columnFilters.titular.toLowerCase())) return false;
      if (columnFilters.fecha) {
        const d = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
        const rDate = d ? format(d, "yyyy-MM-dd") : "";
        if (!rDate.includes(columnFilters.fecha)) return false;
      }
      if (columnFilters.beneficiario && columnFilters.beneficiario !== "Todo") {
        if (r.beneficiario !== columnFilters.beneficiario) return false;
      }

      return true;
    });
  }, [allRecords, hasSearched, appliedFilters, tableSearchTerm, columnFilters]);

  // Exportar a Excel respetando columnas visibles (1:1 OralDrive)
  const handleExportExcel = () => {
    const rows = filteredData.map(r => {
      const formatDateStr = (d) => {
        if (!d) return "";
        const dt = d.toDate ? d.toDate() : new Date(d);
        return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy");
      };

      const rowObj = {};
      if (visibleColumns.paciente) rowObj["Paciente"] = r.paciente || "";
      if (visibleColumns.convenioActual) rowObj["Convenio actual"] = r.convenioActual || "";
      if (visibleColumns.titular) rowObj["Titular"] = r.titular || "";
      if (visibleColumns.fecha) rowObj["Fecha"] = formatDateStr(r.fecha);
      if (visibleColumns.beneficiario) rowObj["Beneficiario"] = r.beneficiario || "No";

      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte de convenios");
    XLSX.writeFile(workbook, `Reporte_de_convenios_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  const formatDateDisplay = (d) => {
    if (!d) return "—";
    const dt = d.toDate ? d.toDate() : new Date(d);
    return isNaN(dt.getTime()) ? "—" : format(dt, "dd/MM/yyyy");
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f6f9] overflow-hidden font-sans text-slate-700">
      
      {/* ─── HEADER & BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">Reporte convenios</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>-</span>
            <span className="text-slate-500">Reportes convenios</span>
          </div>
        </div>

        {/* Botón Generar reporte en Excel (Azul OralDrive) */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <FiDownload size={14} />
          <span>Generar reporte en excel</span>
        </button>
      </div>

      {/* ─── FILTROS SUPERIORES (1:1 ORALDRIVE) ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0">
        
        {/* Fila 1: Fecha inicial y Fecha final con datepickers y botones de calendario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha inicial</label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fechaInicial}
                onChange={(e) => setFechaInicial(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all pr-10"
                max="9999-12-31"
                min="1900-01-01"
              />
              <button
                type="button"
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 pointer-events-none"
              >
                📅
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha final</label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-sky-500 transition-all pr-10"
                max="9999-12-31"
                min="1900-01-01"
              />
              <button
                type="button"
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 pointer-events-none"
              >
                📅
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Convenio / Paciente / Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          
          {/* Convenio */}
          <div className="md:col-span-5 relative" ref={convenioInputRef}>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Convenio</label>
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

            {/* Dropdown Convenios */}
            {showConvenioDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConvenio("");
                    setConvenioSearchTerm("");
                    setShowConvenioDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg transition-colors uppercase"
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
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors uppercase truncate block"
                  >
                    {c.nombre}
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

          {/* Paciente (SOLO busca cuando el usuario escribe >= 2 caracteres) */}
          <div className="md:col-span-5 relative" ref={pacienteInputRef}>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Paciente</label>
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

            {/* Dropdown Pacientes (SOLO aparece al escribir al menos 2 letras) */}
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

          {/* Botón Buscar (Verde OralDrive #7cb342) */}
          <div className="md:col-span-2">
            <button
              onClick={handleSearchClick}
              className="w-full h-9 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Buscar</span>
            </button>
          </div>

        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS DATAGRID (SÓLO TRAS DAR CLIC EN BUSCAR) ─── */}
      {hasSearched && (
        <div className="mx-6 my-4 flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col min-h-0 overflow-hidden animate-fadeIn">
          
          {/* Barra de herramientas / Agrupación OralDrive */}
          <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 shrink-0">
            <span className="text-xs text-slate-400 font-medium italic">
              Arrastra una columna aquí para agrupar por ella
            </span>

            <div className="flex items-center gap-2">
              {/* Botón Exportar Excel */}
              <button
                onClick={handleExportExcel}
                title="Exportar a Excel"
                className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
              >
                <FiDownload size={14} />
              </button>

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
                  <div className="absolute right-0 top-8 z-30 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
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

              {/* Botón Filtros avanzados */}
              <button title="Filtros avanzados" className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors cursor-pointer">
                <FiFilter size={14} />
              </button>
              
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
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-bold">Cargando reporte de convenios...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  {/* Fila 1: Títulos de columna */}
                  <tr>
                    {visibleColumns.paciente && (
                      <th className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap">
                        Paciente
                      </th>
                    )}
                    {visibleColumns.convenioActual && (
                      <th className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap">
                        Convenio actual
                      </th>
                    )}
                    {visibleColumns.titular && (
                      <th className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap">
                        Titular
                      </th>
                    )}
                    {visibleColumns.fecha && (
                      <th className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap">
                        Fecha
                      </th>
                    )}
                    {visibleColumns.beneficiario && (
                      <th className="px-3.5 py-2 whitespace-nowrap">
                        Beneficiario
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
                            className="w-full h-6 pl-6 pr-6 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:bg-white"
                          />
                          <span className="absolute right-1.5 text-[10px] text-slate-400">📅</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.beneficiario && (
                      <th className="p-1">
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
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredData.map((r) => (
                    <tr key={r.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.paciente && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-semibold text-slate-800 uppercase">
                          {r.paciente}
                        </td>
                      )}
                      {visibleColumns.convenioActual && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-bold text-sky-700 uppercase">
                          {r.convenioActual}
                        </td>
                      )}
                      {visibleColumns.titular && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700 uppercase">
                          {r.titular || "—"}
                        </td>
                      )}
                      {visibleColumns.fecha && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-slate-600">
                          {formatDateDisplay(r.fecha)}
                        </td>
                      )}
                      {visibleColumns.beneficiario && (
                        <td className="px-3.5 py-2 text-slate-700">
                          {r.beneficiario}
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredData.length === 0 && (
                    <tr>
                      <td
                        colSpan={Object.values(visibleColumns).filter(Boolean).length || 1}
                        className="px-6 py-12 text-center text-slate-400 font-medium text-xs"
                      >
                        Sin datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla con totalizadores en tiempo real (1:1 OralDrive) */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0 font-medium">
            <span>
              Total registros: <strong>{filteredData.length}</strong>
            </span>
            <span className="font-bold text-slate-800">
              Total convenios: $ 0
            </span>
          </div>

        </div>
      )}

    </div>
  );
}

