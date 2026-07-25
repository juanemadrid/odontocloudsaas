import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
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
  const [oficina, setOficina] = useState("");
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  const [hasSearched, setHasSearched] = useState(false);

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2026-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "",
    profesional: "Todos"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaHora: true,
    profesional: true,
    sucursal: true,
    tipoDocPaciente: true,
    numDocPaciente: true,
    nombrePaciente: true,
    evolucion: true,
    acciones: true
  });

  const columnLabels = {
    fechaHora: "Fecha Hora Evolución",
    profesional: "Profesional",
    sucursal: "Sucursal",
    tipoDocPaciente: "T. Doc. Paciente",
    numDocPaciente: "Num. Doc. Paciente",
    nombrePaciente: "Nombre paciente",
    evolucion: "Evolución / Nota clínica",
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
        // 1. Cargar Sucursales reales
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
        if (listSuc.length > 0) setOficina(listSuc[0].nombre);

        // 2. Cargar Odontólogos / Profesionales
        const qUsers = query(
          collection(db, "usuarios"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapUsers = await getDocs(qUsers);
        const listProf = [];
        snapUsers.forEach(doc => {
          const u = doc.data();
          listProf.push({ id: doc.id, nombre: u.nombre || u.nombres || u.displayName || doc.id });
        });
        setProfesionalesList(listProf);

        // 3. Cargar Evoluciones reales en Firestore
        const qEvoluciones = query(
          collection(db, "evoluciones"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapEvo = await getDocs(qEvoluciones);
        const listEvo = [];

        snapEvo.forEach(doc => {
          const e = doc.data();
          const dateObj = e.createdAt?.toDate ? e.createdAt.toDate() : (e.fecha ? new Date(e.fecha) : new Date());

          listEvo.push({
            id: doc.id,
            fechaHoraRaw: dateObj,
            fechaHoraStr: isNaN(dateObj.getTime()) ? (e.fecha || "") : format(dateObj, "dd/MM/yyyy HH:mm"),
            profesional: e.profesionalNombre || e.odontologo || e.doctor || "—",
            sucursal: e.sucursal || e.oficina || listSuc[0]?.nombre || "ATM CENTRO DEL DOLOR OROFACIAL",
            tipoDocPaciente: e.tipoDocPaciente || "CC",
            numDocPaciente: e.pacienteDocumento || e.documento || "—",
            nombrePaciente: e.pacienteNombre || e.paciente || "—",
            evolucion: e.descripcion || e.nota || e.evolucion || "Evolución clínica realizada"
          });
        });

        listEvo.sort((a, b) => b.fechaHoraRaw - a.fechaHoraRaw);
        setEvolucionesList(listEvo);
        filterData(listEvo, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de evoluciones:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(e => {
      // Filtro de fecha
      if (filters.fechaInicial && filters.fechaFinal) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (e.fechaHoraRaw < init || e.fechaHoraRaw > end) return false;
      }

      // Filtro de Oficina
      if (filters.oficina && filters.oficina !== "TODAS") {
        const targetOf = filters.oficina.toLowerCase();
        const eOf = (e.sucursal || "").toLowerCase();
        if (!eOf.includes(targetOf) && !targetOf.includes(eOf)) return false;
      }

      // Filtro de Profesional
      if (filters.profesional !== "Todos") {
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
        e.evolucion.toLowerCase().includes(term)
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
    filterData(evolucionesList, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredEvoluciones.map(e => ({
      "Fecha Hora Evolución": e.fechaHoraStr,
      "Profesional": e.profesional,
      "Sucursal": e.sucursal,
      "T. Doc. Paciente": e.tipoDocPaciente,
      "Num. Doc. Paciente": e.numDocPaciente,
      "Nombre paciente": e.nombrePaciente,
      "Evolución / Nota": e.evolucion
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Evoluciones");
    XLSX.writeFile(workbook, `Reporte_Evoluciones_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB (1:1 ORALDRIVE) ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte de evoluciones</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium ml-2">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte de evoluciones</span>
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

      {/* ─── ÁREA DE FILTROS (REPLICADO 1:1 DE ORALDRIVE) ─── */}
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

        {/* Fila 2: Oficina + Profesional + Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Oficina</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
              {sucursalesList.length === 0 && (
                <option value="ATM CENTRO DEL DOLOR OROFACIAL">ATM CENTRO DEL DOLOR OROFACIAL</option>
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="Todos">Todos</option>
              {profesionalesList.map(p => (
                <option key={p.id} value={p.nombre}>{p.nombre}</option>
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
                    filterData(evolucionesList, appliedFilters, e.target.value);
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
                <span className="text-[11px] font-bold">Cargando reporte de evoluciones...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fechaHora && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Fecha Hora Evolución</div>
                        <div className="mt-1 flex items-center justify-between">
                          <input type="text" className="w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                          <span className="ml-1 text-slate-400">📅</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.profesional && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>↑ Profesional</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.sucursal && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Sucursal</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.tipoDocPaciente && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>T. Doc. Paciente</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.numDocPaciente && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Num. Doc. Paciente</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.nombrePaciente && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Nombre paciente</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.evolucion && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Evolución / Nota clínica</div>
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
                  {filteredEvoluciones.map((e) => (
                    <tr key={e.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fechaHora && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {e.fechaHoraStr}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {e.profesional}
                        </td>
                      )}
                      {visibleColumns.sucursal && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {e.sucursal}
                        </td>
                      )}
                      {visibleColumns.tipoDocPaciente && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {e.tipoDocPaciente}
                        </td>
                      )}
                      {visibleColumns.numDocPaciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono whitespace-nowrap">
                          {e.numDocPaciente}
                        </td>
                      )}
                      {visibleColumns.nombrePaciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 uppercase whitespace-nowrap">
                          {e.nombrePaciente}
                        </td>
                      )}
                      {visibleColumns.evolucion && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap max-w-xs truncate">
                          {e.evolucion}
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
                  {filteredEvoluciones.length === 0 && (
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
