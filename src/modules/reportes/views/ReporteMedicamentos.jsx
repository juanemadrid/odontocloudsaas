import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getConfigItems } from "../../../services/configPersistenceService";
import { FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteMedicamentos() {
  const { userProfile } = useAuth();
  const [allMedicines, setAllMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-08-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("ATM CENTRO DEL DOLOR OROFACIAL");
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-08-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "ATM CENTRO DEL DOLOR OROFACIAL",
    profesional: "Todos"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaCreacion: true,
    sucursal: true,
    profesional: true,
    paciente: true,
    principioActivo: true,
    codigo: true,
    dosis: true,
    cantidad: true,
    recomendacion: true,
  });

  const columnLabels = {
    fechaCreacion: "Fecha Creación",
    sucursal: "Sucursal",
    profesional: "Profesional",
    paciente: "Paciente",
    principioActivo: "Principio activo",
    codigo: "Código",
    dosis: "Dosis",
    cantidad: "Cantidad",
    recomendacion: "Recomendación",
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      const tenantId = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";
      setLoading(true);
      try {
        let listSucursales = [];
        try {
          const cfgSucursales = await getConfigItems(tenantId, "sucursales", "sucursales");
          if (Array.isArray(cfgSucursales) && cfgSucursales.length > 0) {
            cfgSucursales.forEach(s => {
              const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
              if (name && !listSucursales.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
                listSucursales.push({ id: s.id, nombre: name });
              }
            });
          }
        } catch (e) {}

        if (listSucursales.length === 0) {
          listSucursales.push({ id: "PRINCIPAL", nombre: "ATM CENTRO DEL DOLOR OROFACIAL" });
        }
        setSucursalesList(listSucursales);
        if (listSucursales.length > 0) {
          setOficina(listSucursales[0].nombre);
        }

        let snapUsuarios = [];
        try {
          const { data } = await supabase.from("profiles").select("*").eq("tenant_id", tenantId);
          if (data) snapUsuarios = data;
        } catch (e) {}
        const listProfs = [];
        (snapUsuarios || []).forEach(u => {
          if (isDoctorUser(u)) {
            const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
            listProfs.push({ id: u.id, nombre: nombreCompleto });
          }
        });
        setProfesionales(listProfs);

        let snapFormulaciones = [];
        try {
          const { data } = await supabase.from("formulaciones").select("*").eq("tenant_id", tenantId);
          if (data) snapFormulaciones = data;
        } catch (e) {}
        const listMeds = [];

        (snapFormulaciones || []).forEach(f => {
          const items = f.medicamentos || f.items || [f];
          items.forEach(m => {
            listMeds.push({
              id: `${f.id}_${m.nombre || m.medicamento || Math.random()}`,
              fechaCreacion: f.fecha || f.created_at || f.createdAt,
              sucursal: f.sucursal || f.oficina || "ATM CENTRO DEL DOLOR OROFACIAL",
              profesional: f.profesionalNombre || f.doctor || f.profesional || "—",
              paciente: f.pacienteNombre || f.patientName || "—",
              principioActivo: m.principioActivo || m.nombre || m.medicamento || "—",
              codigo: m.codigo || m.codigoCUM || "—",
              dosis: m.dosis || m.posologia || "—",
              cantidad: m.cantidad || 1,
              recomendacion: m.indicaciones || m.recomendacion || f.observaciones || "—"
            });
          });
        });

        listMeds.sort((a, b) => {
          const dateA = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
          const dateB = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
          return dateB - dateA;
        });

        setAllMedicines(listMeds);
        filterData(listMeds, {
          fechaInicial,
          fechaFinal,
          oficina: listSucursales[0]?.nombre || "ATM CENTRO DEL DOLOR OROFACIAL",
          profesional: "Todos"
        }, "");

      } catch (error) {
        console.error("Error cargando reporte de medicamentos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  const filterData = (data, filters, search) => {
    let result = [...data];

    if (filters.fechaInicial) {
      const initDate = new Date(filters.fechaInicial + "T00:00:00");
      result = result.filter(m => {
        if (!m.fechaCreacion) return true;
        const itemDate = new Date(m.fechaCreacion);
        return itemDate >= initDate;
      });
    }

    if (filters.fechaFinal) {
      const endDate = new Date(filters.fechaFinal + "T23:59:59");
      result = result.filter(m => {
        if (!m.fechaCreacion) return true;
        const itemDate = new Date(m.fechaCreacion);
        return itemDate <= endDate;
      });
    }

    if (filters.oficina && filters.oficina !== "TODAS") {
      result = result.filter(m => 
        (m.sucursal || "").toLowerCase().includes(filters.oficina.toLowerCase())
      );
    }

    if (filters.profesional && filters.profesional !== "Todos") {
      result = result.filter(m => 
        (m.profesional || "").toLowerCase().includes(filters.profesional.toLowerCase())
      );
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(m => 
        m.paciente?.toLowerCase().includes(q) ||
        m.profesional?.toLowerCase().includes(q) ||
        m.principioActivo?.toLowerCase().includes(q) ||
        m.codigo?.toLowerCase().includes(q) ||
        m.sucursal?.toLowerCase().includes(q)
      );
    }

    setFilteredMedicines(result);
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
    filterData(allMedicines, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredMedicines.map(m => {
      const formatDateStr = (d) => {
        if (!d) return "";
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
      };

      return {
        "Fecha Creación": formatDateStr(m.fechaCreacion),
        "Sucursal": m.sucursal || "—",
        "Profesional": m.profesional || "—",
        "Paciente": m.paciente || "—",
        "Principio activo": m.principioActivo || "—",
        "Código": m.codigo || "—",
        "Dosis": m.dosis || "—",
        "Cantidad": m.cantidad || 0,
        "Recomendación": m.recomendacion || "—",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Medicamentos");
    XLSX.writeFile(workbook, `Reporte_Medicamentos_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f6f9] overflow-y-auto custom-scrollbar font-sans text-slate-700 pb-16">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Reporte medicamentos</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>-</span>
            <span className="text-slate-500 font-bold">Reporte medicamentos</span>
          </div>
        </div>

        {/* Botón Generar reporte en Excel (Azul OralDrive) */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#009beb] hover:bg-[#0087cd] text-white text-xs font-bold rounded shadow-2xs transition-all cursor-pointer"
        >
          <span>Generar reporte en excel</span>
        </button>
      </div>

      {/* ─── ÁREA DE FILTROS (DISEÑO 1:1 ORALDRIVE ALINEADO HORIZONTALMENTE) ─── */}
      <div className="mx-6 mt-4 p-6 bg-white rounded-xl border border-slate-200/80 shadow-2xs shrink-0">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {/* Fila 1: Fecha inicial y Fecha final */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            
            {/* Fecha inicial */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-normal text-slate-500 w-24 text-right shrink-0">Fecha inicial</label>
              <div className="relative flex items-center flex-1">
                <input
                  type="date"
                  value={fechaInicial}
                  onChange={(e) => setFechaInicial(e.target.value)}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all pr-8"
                  max="9999-12-31"
                  min="1900-01-01"
                />
              </div>
            </div>

            {/* Fecha final */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-normal text-slate-500 w-24 text-right shrink-0">Fecha final</label>
              <div className="relative flex items-center flex-1">
                <input
                  type="date"
                  value={fechaFinal}
                  onChange={(e) => setFechaFinal(e.target.value)}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all pr-8"
                  max="9999-12-31"
                  min="1900-01-01"
                />
              </div>
            </div>

          </div>

          {/* Fila 2: Oficina, Profesional y Botón Buscar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 items-center">
            
            {/* Oficina */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-normal text-slate-500 w-24 text-right shrink-0">Oficina</label>
              <select
                value={oficina}
                onChange={(e) => setOficina(e.target.value)}
                className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase cursor-pointer"
              >
                <option value="TODAS">TODAS</option>
                {sucursalesList.map(s => (
                  <option key={s.id} value={s.nombre}>{s.nombre}</option>
                ))}
              </select>
            </div>

            {/* Profesional + Botón Buscar */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-normal text-slate-500 w-24 text-right shrink-0">Profesional</label>
              <div className="flex items-center gap-3 flex-1">
                <select
                  value={selectedProfesional}
                  onChange={(e) => setSelectedProfesional(e.target.value)}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  {profesionales.map(prof => (
                    <option key={prof.id} value={prof.nombre}>{prof.nombre}</option>
                  ))}
                </select>
                <button
                  onClick={handleSearchClick}
                  className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs shrink-0"
                >
                  Buscar
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ─── TABLA DE RESULTADOS DATAGRID (SÓLO TRAS DAR CLIC EN BUSCAR) ─── */}
      {hasSearched && (
        <div className="mx-5 my-3 flex-1 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden animate-fadeIn">
          
          {/* Barra de herramientas */}
          <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 shrink-0 relative">
            <span className="text-[11px] text-slate-400 font-medium italic">
              Arrastre una columna aquí para agrupar por ella
            </span>

            <div className="flex items-center gap-2 relative">
              {/* Botón Selector de Columnas */}
              <div className="relative">
                <button 
                  title="Selector de columnas" 
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`p-1.5 rounded transition-colors ${showColumnSelector ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-200 text-slate-500'}`}
                >
                  <FiFileText size={15} />
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 top-9 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
                    <div className="text-[11px] font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                      <span>Seleccionar columnas</span>
                      <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
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

              <button title="Filtros avanzados" className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                <FiFilter size={15} />
              </button>
              
              {/* Buscador rápido */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={tableSearchTerm}
                  onChange={(e) => {
                    setTableSearchTerm(e.target.value);
                    filterData(allMedicines, appliedFilters, e.target.value);
                  }}
                  className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-200 rounded-md text-[11px] outline-none focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-[11px] font-bold">Cargando reporte de medicamentos...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fechaCreacion && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Fecha Creación</div>                      </th>
                    )}
                    {visibleColumns.sucursal && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Sucursal</div>                      </th>
                    )}
                    {visibleColumns.profesional && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Profesional</div>                      </th>
                    )}
                    {visibleColumns.paciente && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Paciente</div>                      </th>
                    )}
                    {visibleColumns.principioActivo && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Principio activo</div>                      </th>
                    )}
                    {visibleColumns.codigo && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Código</div>                      </th>
                    )}
                    {visibleColumns.dosis && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Dosis</div>                      </th>
                    )}
                    {visibleColumns.cantidad && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-center">
                        <div>Cantidad</div>                      </th>
                    )}
                    {visibleColumns.recomendacion && (
                      <th className="px-3 py-2 whitespace-nowrap">
                        <div>Recomendación</div>                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredMedicines.map((m) => {
                    const formatDateStr = (d) => {
                      if (!d) return "";
                      const dt = d.toDate ? d.toDate() : new Date(d);
                      return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
                    };

                    return (
                      <tr key={m.id} className="hover:bg-sky-50/40 transition-colors">
                        {visibleColumns.fechaCreacion && (
                          <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                            {formatDateStr(m.fechaCreacion)}
                          </td>
                        )}
                        {visibleColumns.sucursal && (
                          <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                            {m.sucursal}
                          </td>
                        )}
                        {visibleColumns.profesional && (
                          <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-800 uppercase whitespace-nowrap">
                            {m.profesional}
                          </td>
                        )}
                        {visibleColumns.paciente && (
                          <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 uppercase whitespace-nowrap">
                            {m.paciente}
                          </td>
                        )}
                        {visibleColumns.principioActivo && (
                          <td className="px-3 py-2 border-r border-slate-100 font-semibold whitespace-nowrap">
                            {m.principioActivo}
                          </td>
                        )}
                        {visibleColumns.codigo && (
                          <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap font-mono">
                            {m.codigo}
                          </td>
                        )}
                        {visibleColumns.dosis && (
                          <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                            {m.dosis}
                          </td>
                        )}
                        {visibleColumns.cantidad && (
                          <td className="px-3 py-2 border-r border-slate-100 text-center font-bold whitespace-nowrap">
                            {m.cantidad}
                          </td>
                        )}
                        {visibleColumns.recomendacion && (
                          <td className="px-3 py-2 whitespace-nowrap">
                            {m.recomendacion}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredMedicines.length === 0 && (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-12 text-center text-slate-400 font-semibold">
                        Sin datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
