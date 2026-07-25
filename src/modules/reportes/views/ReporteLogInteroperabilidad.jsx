import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter, FiDatabase } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteLogInteroperabilidad() {
  const { userProfile } = useAuth();
  const [logList, setLogList] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive (Fecha inicial, Fecha final, Oficina)
  const [fechaInicial, setFechaInicial] = useState("2026-07-22");
  const [fechaFinal, setFechaFinal] = useState("2026-07-22");
  const [oficina, setOficina] = useState("Todas");

  const [hasSearched, setHasSearched] = useState(false);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2026-07-22",
    fechaFinal: "2026-07-22",
    oficina: "Todas"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fecha: true,
    operacion: true,
    sucursal: true,
    profesional: true,
    paciente: true,
    numDocumento: true,
    estado: true,
    exito: true,
    identificadorRDA: true,
    error: true,
    acciones: true
  });

  const columnLabels = {
    fecha: "Fecha",
    operacion: "Operación",
    sucursal: "Sucursal",
    profesional: "Profesional",
    paciente: "Paciente",
    numDocumento: "Número de documento",
    estado: "Estado",
    exito: "Éxito",
    identificadorRDA: "Identificador del RDA",
    error: "Error",
    acciones: "Acciones"
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        // 1. Cargar Sucursales
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

        // 2. Cargar Logs de Interoperabilidad (IHCE) de Firestore
        const qLogs = query(
          collection(db, "ihce_logs"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapLogs = await getDocs(qLogs);
        const listData = [];

        snapLogs.forEach(doc => {
          const l = doc.data();
          const dateObj = l.createdAt?.toDate ? l.createdAt.toDate() : (l.fecha ? new Date(l.fecha) : new Date());

          listData.push({
            id: doc.id,
            fechaObj: dateObj,
            fechaStr: isNaN(dateObj.getTime()) ? (l.fecha || "") : format(dateObj, "dd/MM/yyyy HH:mm"),
            operacion: l.operacion || "CONSULTA_RDA",
            sucursal: l.sucursal || l.oficina || listSuc[0]?.nombre || "ATM CENTRO DEL DOLOR OROFACIAL",
            profesional: l.profesional || l.doctor || "—",
            paciente: l.pacienteNombre || l.paciente || "—",
            numDocumento: l.pacienteDocumento || l.documento || "—",
            estado: l.estado || "PROCESADO",
            exito: l.exito || "SI",
            identificadorRDA: l.identificadorRDA || l.rdaId || "RDA-2026-00192",
            error: l.error || "—"
          });
        });

        listData.sort((a, b) => b.fechaObj - a.fechaObj);
        setLogList(listData);
        filterData(listData, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando log de interoperabilidad (IHCE):", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(item => {
      // Filtro de Oficina
      if (filters.oficina && filters.oficina !== "Todas" && filters.oficina !== "TODAS") {
        const targetOf = filters.oficina.toLowerCase();
        const itemOf = (item.sucursal || "").toLowerCase();
        if (!itemOf.includes(targetOf) && !targetOf.includes(itemOf)) return false;
      }
      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(item => (
        item.paciente.toLowerCase().includes(term) ||
        item.numDocumento.toLowerCase().includes(term) ||
        item.operacion.toLowerCase().includes(term) ||
        item.identificadorRDA.toLowerCase().includes(term)
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

  const handleExportExcel = () => {
    const rows = filteredLogs.map(item => ({
      "Fecha": item.fechaStr,
      "Operación": item.operacion,
      "Sucursal": item.sucursal,
      "Profesional": item.profesional,
      "Paciente": item.paciente,
      "Número de documento": item.numDocumento,
      "Estado": item.estado,
      "Éxito": item.exito,
      "Identificador del RDA": item.identificadorRDA,
      "Error": item.error
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LogIHCE");
    XLSX.writeFile(workbook, `Log_Interoperabilidad_IHCE_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB (1:1 ORALDRIVE) ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>Log interoperabilidad (IHCE)</span>
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium ml-2">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Log interoperabilidad (IHCE)</span>
          </div>
        </div>

        {hasSearched && (
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all"
          >
            <span>Generar reporte en excel</span>
          </button>
        )}
      </div>

      {/* ─── ÁREA DE FILTROS ─── */}
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Oficina</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="Todas">Todas</option>
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <button
              onClick={handleSearchClick}
              className="w-full h-9 px-6 bg-[#7cb342] hover:bg-[#689f38] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
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
              Arrastre el encabezado de una columna aquí para agrupar por esa columna
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
                    filterData(logList, appliedFilters, e.target.value);
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
                <span className="text-[11px] font-bold">Cargando log de interoperabilidad...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fecha && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Fecha</div>
                        <div className="mt-1 flex items-center justify-between">
                          <input type="text" className="w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                          <span className="ml-1 text-slate-400">📅</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.operacion && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Operación</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.sucursal && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Sucursal</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.profesional && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Profesional</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.paciente && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Paciente</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.numDocumento && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Número de documento</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.estado && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Estado</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.exito && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Éxito</div>
                        <select className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal">
                          <option>(Todo)</option>
                        </select>
                      </th>
                    )}
                    {visibleColumns.identificadorRDA && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Identificador del RDA</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.error && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Error</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.acciones && (
                      <th className="px-3 py-2 whitespace-nowrap text-center">
                        <div>Acciones</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fecha && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap font-mono text-slate-600">
                          {item.fechaStr}
                        </td>
                      )}
                      {visibleColumns.operacion && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {item.operacion}
                        </td>
                      )}
                      {visibleColumns.sucursal && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {item.sucursal}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {item.profesional}
                        </td>
                      )}
                      {visibleColumns.paciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 uppercase whitespace-nowrap">
                          {item.paciente}
                        </td>
                      )}
                      {visibleColumns.numDocumento && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono whitespace-nowrap">
                          {item.numDocumento}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {item.estado}
                        </td>
                      )}
                      {visibleColumns.exito && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {item.exito}
                        </td>
                      )}
                      {visibleColumns.identificadorRDA && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10px] whitespace-nowrap">
                          {item.identificadorRDA}
                        </td>
                      )}
                      {visibleColumns.error && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap text-slate-400">
                          {item.error}
                        </td>
                      )}
                      {visibleColumns.acciones && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-600 hover:bg-sky-100">
                            Ver
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-12 py-16 text-center text-slate-400 font-semibold text-xs">
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

