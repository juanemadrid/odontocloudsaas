import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter, FiSend, FiClock } from "react-icons/fi";
import { format, differenceInDays } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteOportunidadCitas() {
  const { userProfile } = useAuth();
  const [citasList, setCitasList] = useState([]);
  const [filteredCitas, setFilteredCitas] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("Todas las oficinas");

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "Todas las oficinas"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

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

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        // Cargar Sucursales
        const qSucursales = query(
          collection(db, "sucursales"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapSuc = await getDocs(qSucursales);
        const listSuc = [];
        snapSuc.forEach(doc => {
          listSuc.push({ id: doc.id, nombre: doc.data().nombre || doc.id });
        });
        setSucursalesList(listSuc);

        // Cargar Citas de Agenda
        const qCitas = query(
          collection(db, "agenda"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapCitas = await getDocs(qCitas);
        const listCitas = [];

        snapCitas.forEach(doc => {
          const c = doc.data();
          const fSolicitud = c.createdAt?.toDate ? c.createdAt.toDate() : (c.fechaCreacion ? new Date(c.fechaCreacion) : new Date());
          const fAsignada = c.fecha ? new Date(`${c.fecha}T${c.hora || '08:00'}`) : fSolicitud;

          let diffDays = 0;
          if (fSolicitud && fAsignada && !isNaN(fSolicitud.getTime()) && !isNaN(fAsignada.getTime())) {
            diffDays = Math.max(0, differenceInDays(fAsignada, fSolicitud));
          }

          listCitas.push({
            id: doc.id,
            paciente: c.nombrePaciente || "—",
            documento: c.pacienteIdentificacion || c.documento || "—",
            fechaSolicitud: fSolicitud,
            fechaAsignada: fAsignada,
            diasOportunidad: `${diffDays} días`,
            especialidad: c.motivo || c.servicio || "Consulta Odontológica",
            profesional: c.dentista || c.profesional || "—",
            sucursal: c.sucursal || c.oficina || "ATM CENTRO DEL DOLOR OROFACIAL",
            estado: c.estado || "Programada"
          });
        });

        listCitas.sort((a, b) => {
          const dateA = a.fechaAsignada?.getTime() || 0;
          const dateB = b.fechaAsignada?.getTime() || 0;
          return dateB - dateA;
        });

        setCitasList(listCitas);
        filterData(listCitas, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de oportunidad de citas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(c => {
      // Filtro por Fechas
      const targetDate = c.fechaAsignada;
      if (targetDate && !isNaN(targetDate.getTime())) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (targetDate < init || targetDate > end) return false;
      }

      // Filtro por Oficina / Sucursal
      if (filters.oficina !== "Todas las oficinas") {
        const targetOficina = filters.oficina.toLowerCase();
        const cSuc = (c.sucursal || "").toLowerCase();
        if (!cSuc.includes(targetOficina) && !targetOficina.includes(cSuc)) return false;
      }

      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(c => (
        c.paciente.toLowerCase().includes(term) ||
        c.documento.toLowerCase().includes(term) ||
        c.profesional.toLowerCase().includes(term) ||
        c.especialidad.toLowerCase().includes(term)
      ));
    }

    setFilteredCitas(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      oficina
    };
    setAppliedFilters(newFilters);
    filterData(citasList, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredCitas.map(c => ({
      "Paciente": c.paciente,
      "Documento": c.documento,
      "Fecha solicitud cita": c.fechaSolicitud ? format(c.fechaSolicitud, "dd/MM/yyyy HH:mm") : "",
      "Fecha cita asignada": c.fechaAsignada ? format(c.fechaAsignada, "dd/MM/yyyy HH:mm") : "",
      "Días de oportunidad": c.diasOportunidad,
      "Especialidad / Motivo": c.especialidad,
      "Profesional": c.profesional,
      "Oficina / Sucursal": c.sucursal,
      "Estado": c.estado,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OportunidadCitas");
    XLSX.writeFile(workbook, `Reporte_Oportunidad_Citas_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB CON BOTONES VERDES (Zip + Enviar) ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte de oportunidad de citas</h2>
          <span className="text-slate-400 text-xs cursor-help" title="Mide los días entre la solicitud de la cita y la fecha de atención asignada">ⓘ</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium ml-2">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte de oportunidad de citas</span>
          </div>
        </div>

        {/* Botones Verdes OralDrive (Zip + Enviar) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7cb342] hover:bg-[#689f38] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all"
          >
            <FiFileText size={13} />
            <span>Zip</span>
          </button>

          <button
            onClick={() => alert("Generando reporte de oportunidad de citas...")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7cb342] hover:bg-[#689f38] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all"
          >
            <FiSend size={13} />
            <span>Enviar</span>
          </button>
        </div>
      </div>

      {/* ─── ÁREA DE FILTROS (DISEÑO EXACTO ORALDRIVE) ─── */}
      <div className="mx-5 mt-3 p-5 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
        
        {/* Fila 1: Fecha inicial / Fecha final */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha inicial</label>
            <input
              type="date"
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha final</label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        {/* Fila 2: Oficina + Botón Buscar */}
        <div className="flex flex-wrap md:flex-nowrap items-end justify-between gap-6">
          <div className="w-full md:w-3/4">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Oficina</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="Todas las oficinas">Todas las oficinas</option>
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleSearchClick}
              className="h-9 px-8 bg-[#7cb342] hover:bg-[#689f38] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <span>Buscar</span>
            </button>
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
                  filterData(citasList, appliedFilters, e.target.value);
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
              <span className="text-[11px] font-bold">Cargando oportunidad de citas...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {visibleColumns.paciente && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Paciente</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.documento && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Documento</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.fechaSolicitud && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha solicitud cita</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.fechaAsignada && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha cita asignada</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.diasOportunidad && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-center">
                      <div>Días de oportunidad</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.especialidad && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Especialidad / Motivo</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.profesional && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Profesional</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.sucursal && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Oficina / Sucursal</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.estado && (
                    <th className="px-3 py-2 whitespace-nowrap text-center">
                      <div>Estado</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCitas.map((c) => (
                  <tr key={c.id} className="hover:bg-sky-50/40 transition-colors">
                    {visibleColumns.paciente && (
                      <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 uppercase whitespace-nowrap">
                        {c.paciente}
                      </td>
                    )}
                    {visibleColumns.documento && (
                      <td className="px-3 py-2 border-r border-slate-100 font-mono whitespace-nowrap">
                        {c.documento}
                      </td>
                    )}
                    {visibleColumns.fechaSolicitud && (
                      <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                        {c.fechaSolicitud ? format(c.fechaSolicitud, "dd/MM/yyyy HH:mm") : "—"}
                      </td>
                    )}
                    {visibleColumns.fechaAsignada && (
                      <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                        {c.fechaAsignada ? format(c.fechaAsignada, "dd/MM/yyyy HH:mm") : "—"}
                      </td>
                    )}
                    {visibleColumns.diasOportunidad && (
                      <td className="px-3 py-2 border-r border-slate-100 text-center whitespace-nowrap font-black text-slate-800">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {c.diasOportunidad}
                        </span>
                      </td>
                    )}
                    {visibleColumns.especialidad && (
                      <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                        {c.especialidad}
                      </td>
                    )}
                    {visibleColumns.profesional && (
                      <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                        {c.profesional}
                      </td>
                    )}
                    {visibleColumns.sucursal && (
                      <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                        {c.sucursal}
                      </td>
                    )}
                    {visibleColumns.estado && (
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className="uppercase text-[10px] font-black text-slate-500">
                          {c.estado}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredCitas.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No se encontraron registros de oportunidad de citas para los filtros seleccionados.
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
