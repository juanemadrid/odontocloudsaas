import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteConsultas() {
  const { userProfile } = useAuth();
  const [consultasList, setConsultasList] = useState([]);
  const [filteredConsultas, setFilteredConsultas] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [profesionalesList, setProfesionalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive (Fecha Inicial, Fecha Final, Oficina, Profesional)
  const [fechaInicial, setFechaInicial] = useState("2026-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("");
  const [selectedProfesional, setSelectedProfesional] = useState("TODOS");

  const [hasSearched, setHasSearched] = useState(false);

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2026-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "",
    profesional: "TODOS"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaConsulta: true,
    profesional: true,
    sucursal: true,
    tipoDocPaciente: true,
    numDocPaciente: true,
    nombrePaciente: true,
    acciones: true
  });

  const columnLabels = {
    fechaConsulta: "Fecha Consulta",
    profesional: "Profesional",
    sucursal: "Sucursal",
    tipoDocPaciente: "T. Doc. Paciente",
    numDocPaciente: "Num. Doc. Paciente",
    nombrePaciente: "Nombre paciente",
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

        // 2. Cargar Profesionales/Odontólogos reales
        const qUsers = query(
          collection(db, "usuarios"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapUsers = await getDocs(qUsers);
        const listProf = [];
        snapUsers.forEach(doc => {
          const u = doc.data();
          const name = u.nombre || u.name || doc.id;
          listProf.push({ id: doc.id, nombre: name });
        });
        setProfesionalesList(listProf);

        // 3. Cargar Consultas / Citas / Atenciones de la Agenda en Firestore
        const qCitas = query(
          collection(db, "agenda"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapCitas = await getDocs(qCitas);
        const listCitas = [];

        snapCitas.forEach(doc => {
          const c = doc.data();
          const dateObj = c.fecha ? new Date(`${c.fecha}T${c.hora || "08:00"}:00`) : (c.createdAt?.toDate ? c.createdAt.toDate() : new Date());

          listCitas.push({
            id: doc.id,
            fechaHoraRaw: dateObj,
            fechaHoraStr: isNaN(dateObj.getTime()) ? (c.fecha || "") : format(dateObj, "dd/MM/yyyy HH:mm"),
            paciente: c.pacienteNombre || c.paciente || "—",
            documento: c.pacienteDocumento || c.documento || "—",
            profesional: c.odontologo || c.profesional || c.doctor || "—",
            motivoConsulta: c.motivo || c.motivoConsulta || c.procedimiento || "Consulta Odontológica General",
            diagnostico: c.diagnostico || c.cie10 || "Valoración de ingreso",
            oficina: c.sucursal || c.oficina || listSuc[0]?.nombre || "ATM CENTRO DEL DOLOR OROFACIAL",
            estado: c.estado || "Atendida"
          });
        });

        listCitas.sort((a, b) => b.fechaHoraRaw - a.fechaHoraRaw);
        setConsultasList(listCitas);
        filterData(listCitas, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de consultas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(c => {
      // Filtro por Fecha
      if (filters.fechaInicial && filters.fechaFinal) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (c.fechaHoraRaw < init || c.fechaHoraRaw > end) return false;
      }

      // Filtro por Oficina / Sucursal
      if (filters.oficina && filters.oficina !== "TODAS") {
        const targetOf = filters.oficina.toLowerCase();
        const cOf = (c.oficina || "").toLowerCase();
        if (!cOf.includes(targetOf) && !targetOf.includes(cOf)) return false;
      }

      // Filtro por Profesional
      if (filters.profesional && filters.profesional !== "TODOS") {
        const targetProf = filters.profesional.toLowerCase();
        const cProf = (c.profesional || "").toLowerCase();
        if (!cProf.includes(targetProf) && !targetProf.includes(cProf)) return false;
      }

      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(c => (
        c.paciente.toLowerCase().includes(term) ||
        c.documento.toLowerCase().includes(term) ||
        c.profesional.toLowerCase().includes(term) ||
        c.motivoConsulta.toLowerCase().includes(term)
      ));
    }

    setFilteredConsultas(result);
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
    filterData(consultasList, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredConsultas.map(c => ({
      "Fecha hora consulta": c.fechaHoraStr,
      "Paciente": c.paciente,
      "Documento": c.documento,
      "Profesional": c.profesional,
      "Motivo de consulta": c.motivoConsulta,
      "Diagnóstico": c.diagnostico,
      "Oficina / Sucursal": c.oficina,
      "Estado": c.estado
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Consultas");
    XLSX.writeFile(workbook, `Reporte_Consultas_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB (1:1 ORALDRIVE) ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte de consultas</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium ml-2">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte de consultas</span>
          </div>
        </div>

        {/* Botón Excel */}
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
              <option value="TODOS">TODOS LOS PROFESIONALES</option>
              {profesionalesList.map(p => (
                <option key={p.id} value={p.nombre}>{p.nombre}</option>
              ))}
              {profesionalesList.length === 0 && (
                <option value="ELIECER JOSE HERNANDEZ DEL CARMEN">ELIECER JOSE HERNANDEZ DEL CARMEN</option>
              )}
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
                    filterData(consultasList, appliedFilters, e.target.value);
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
                <span className="text-[11px] font-bold">Cargando reporte de consultas...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.fechaConsulta && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Fecha Consulta</div>
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
                    {visibleColumns.acciones && (
                      <th className="px-3 py-2 whitespace-nowrap text-center">
                        <div>Acciones</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredConsultas.map((c) => (
                    <tr key={c.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fechaConsulta && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {c.fechaHoraStr}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {c.profesional}
                        </td>
                      )}
                      {visibleColumns.sucursal && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {c.oficina}
                        </td>
                      )}
                      {visibleColumns.tipoDocPaciente && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          CC
                        </td>
                      )}
                      {visibleColumns.numDocPaciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono whitespace-nowrap">
                          {c.documento}
                        </td>
                      )}
                      {visibleColumns.nombrePaciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 uppercase whitespace-nowrap">
                          {c.paciente}
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
                  {filteredConsultas.length === 0 && (
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
