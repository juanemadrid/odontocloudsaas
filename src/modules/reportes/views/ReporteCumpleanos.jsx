import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter, FiGift } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteCumpleanos() {
  const { userProfile } = useAuth();
  const [allCumpleanos, setAllCumpleanos] = useState([]);
  const [filteredCumpleanos, setFilteredCumpleanos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-07-21");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-07-21",
    fechaFinal: format(new Date(), "yyyy-MM-dd")
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaCumpleanos: true,
    edad: true,
    paciente: true,
    documento: true,
    telefono: true,
    correo: true,
  });

  const columnLabels = {
    fechaCumpleanos: "Fecha de cumpleaños",
    edad: "Edad",
    paciente: "Paciente",
    documento: "Documento",
    telefono: "Teléfono",
    correo: "Correo",
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        const qPacientes = query(
          collection(db, "pacientes"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapPacientes = await getDocs(qPacientes);
        const listCumple = [];

        snapPacientes.forEach(doc => {
          const p = doc.data();
          if (p.fechaNacimiento) {
            const dateBirth = new Date(p.fechaNacimiento);
            if (!isNaN(dateBirth.getTime())) {
              const today = new Date();
              let age = today.getFullYear() - dateBirth.getFullYear();
              const m = today.getMonth() - dateBirth.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < dateBirth.getDate())) {
                age--;
              }

              const nom = `${p.nombre || p.nombres || ''} ${p.apellido || p.apellidos || ''}`.trim() || p.nombreCompleto || 'Sin nombre';

              listCumple.push({
                id: doc.id,
                fechaNacimientoRaw: dateBirth,
                fechaCumpleanos: format(dateBirth, "dd/MM/yyyy"),
                edad: `${age} años`,
                paciente: nom,
                documento: p.identificacion || p.nroDocumento || "—",
                telefono: p.celular || p.telefono || "—",
                correo: p.email || p.correo || "—",
                monthDay: format(dateBirth, "MM-dd")
              });
            }
          }
        });

        listCumple.sort((a, b) => a.monthDay.localeCompare(b.monthDay));
        setAllCumpleanos(listCumple);
        filterData(listCumple, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de cumpleaños:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(c => {
      if (!c.fechaNacimientoRaw) return false;

      // Extraer mes y día del paciente (1-indexed)
      const bMonth = c.fechaNacimientoRaw.getMonth() + 1;
      const bDay = c.fechaNacimientoRaw.getDate();

      // Convertir a número ordenable MMSS (ej: 0721 para 21 de julio)
      const bValue = bMonth * 100 + bDay;

      // Obtener rango ingresado en los filtros
      if (filters.fechaInicial && filters.fechaFinal) {
        const dInit = new Date(filters.fechaInicial + "T00:00:00");
        const dEnd = new Date(filters.fechaFinal + "T23:59:59");

        const initVal = (dInit.getMonth() + 1) * 100 + dInit.getDate();
        const endVal = (dEnd.getMonth() + 1) * 100 + dEnd.getDate();

        if (initVal <= endVal) {
          if (bValue < initVal || bValue > endVal) return false;
        } else {
          // Rango que cruza fin de año (ej: 15 de dic a 15 de ene)
          if (bValue < initVal && bValue > endVal) return false;
        }
      }

      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(c => (
        c.paciente.toLowerCase().includes(term) ||
        c.documento.toLowerCase().includes(term) ||
        c.telefono.toLowerCase().includes(term) ||
        c.correo.toLowerCase().includes(term)
      ));
    }

    setFilteredCumpleanos(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal
    };
    setAppliedFilters(newFilters);
    filterData(allCumpleanos, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredCumpleanos.map(c => ({
      "Fecha de cumpleaños": c.fechaCumpleanos,
      "Edad": c.edad,
      "Paciente": c.paciente,
      "Documento": c.documento,
      "Teléfono": c.telefono,
      "Correo": c.correo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cumpleaños");
    XLSX.writeFile(workbook, `Reporte_Cumpleanos_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  // Función para determinar si el cumpleaños es HOY (resaltar en verde claro como OralDrive)
  const isBirthdayToday = (dateBirth) => {
    if (!dateBirth) return false;
    const today = new Date();
    return dateBirth.getMonth() === today.getMonth() && dateBirth.getDate() === today.getDate();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte cumpleaños</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte cumpleaños</span>
          </div>
        </div>

        {/* Botón Generar reporte en Excel (Azul OralDrive) */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all"
        >
          <span>Generar reporte en excel</span>
        </button>
      </div>

      {/* ─── ÁREA DE FILTROS (DISEÑO EXACTO ORALDRIVE) ─── */}
      <div className="mx-5 mt-3 p-5 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
        
        {/* Fila: Fecha inicial / Fecha final + Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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
                  filterData(allCumpleanos, appliedFilters, e.target.value);
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
              <span className="text-[11px] font-bold">Cargando reporte de cumpleaños...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {visibleColumns.fechaCumpleanos && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha de cumpleaños</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.edad && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-center">
                      <div>Edad</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
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
                  {visibleColumns.telefono && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Teléfono</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.correo && (
                    <th className="px-3 py-2 whitespace-nowrap">
                      <div>Correo</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCumpleanos.map((c) => {
                  const todayMatch = isBirthdayToday(c.fechaNacimientoRaw);
                  
                  return (
                    <tr 
                      key={c.id} 
                      className={`transition-colors ${todayMatch ? 'bg-[#dcedc8] text-slate-900 font-medium' : 'hover:bg-sky-50/40'}`}
                    >
                      {visibleColumns.fechaCumpleanos && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {c.fechaCumpleanos}
                        </td>
                      )}
                      {visibleColumns.edad && (
                        <td className="px-3 py-2 border-r border-slate-100 text-center whitespace-nowrap font-semibold">
                          {c.edad}
                        </td>
                      )}
                      {visibleColumns.paciente && (
                        <td className={`px-3 py-2 border-r border-slate-100 font-bold uppercase whitespace-nowrap ${todayMatch ? 'text-emerald-950' : 'text-sky-600'}`}>
                          {c.paciente}
                        </td>
                      )}
                      {visibleColumns.documento && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono whitespace-nowrap">
                          {c.documento}
                        </td>
                      )}
                      {visibleColumns.telefono && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {c.telefono}
                        </td>
                      )}
                      {visibleColumns.correo && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          {c.correo}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredCumpleanos.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No se encontraron cumpleaños registrados para las fechas seleccionadas.
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
