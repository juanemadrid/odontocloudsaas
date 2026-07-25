import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
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

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("TODAS");
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "TODAS",
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

        // Cargar Doctores
        const qUsuarios = query(
          collection(db, "usuarios"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapUsuarios = await getDocs(qUsuarios);
        const listProfs = [];
        snapUsuarios.forEach(doc => {
          const u = doc.data();
          const role = (u.rol || u.role || "").toLowerCase();
          if (role === "odontologo" || role === "doctor" || role === "odontóloga" || role === "doctores" || u.esOdontologo === true) {
            const primerNombre = u.nombre || u.nombres || u.displayName || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
            listProfs.push({ id: doc.id, nombre: nombreCompleto });
          }
        });
        setProfesionales(listProfs);

        // Cargar Recetas / Prescripciones / Formulaciones
        const qFormulaciones = query(
          collection(db, "formulaciones"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapFormulaciones = await getDocs(qFormulaciones);
        const listMeds = [];

        snapFormulaciones.forEach(doc => {
          const f = doc.data();
          const items = f.medicamentos || f.items || [f];
          items.forEach(m => {
            listMeds.push({
              id: `${doc.id}_${m.nombre || m.medicamento}`,
              fechaCreacion: f.fecha || f.createdAt,
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
          const dateA = a.fechaCreacion?.seconds || (a.fechaCreacion ? new Date(a.fechaCreacion).getTime() / 1000 : 0);
          const dateB = b.fechaCreacion?.seconds || (b.fechaCreacion ? new Date(b.fechaCreacion).getTime() / 1000 : 0);
          return dateB - dateA;
        });

        setAllMedicines(listMeds);
        filterData(listMeds, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de medicamentos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(m => {
      // Filtro por Fechas
      const targetDate = m.fechaCreacion ? (m.fechaCreacion.toDate ? m.fechaCreacion.toDate() : new Date(m.fechaCreacion)) : null;
      if (targetDate) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (targetDate < init || targetDate > end) return false;
      }

      // Filtro por Profesional
      if (filters.profesional !== "Todos") {
        const profTarget = filters.profesional.toLowerCase();
        const mProf = (m.profesional || "").toLowerCase();
        if (!mProf.includes(profTarget) && !profTarget.includes(mProf)) return false;
      }

      return true;
    });

    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(m => (
        (m.principioActivo && m.principioActivo.toLowerCase().includes(term)) ||
        (m.paciente && m.paciente.toLowerCase().includes(term)) ||
        (m.profesional && m.profesional.toLowerCase().includes(term)) ||
        (m.codigo && m.codigo.toLowerCase().includes(term))
      ));
    }

    setFilteredMedicines(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

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
        const dt = d.toDate ? d.toDate() : new Date(d);
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
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte medicamentos</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte medicamentos</span>
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

        {/* Fila 2: Oficina / Profesional + Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Oficina</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="TODAS">TODAS LAS OFICINAS / SUCURSALES</option>
              {sucursalesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
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
              {profesionales.map(prof => (
                <option key={prof.id} value={prof.nombre}>{prof.nombre}</option>
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
                        <div>Fecha Creación</div>
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
                    {visibleColumns.principioActivo && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Principio activo</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.codigo && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Código</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.dosis && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div>Dosis</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.cantidad && (
                      <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-center">
                        <div>Cantidad</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
                    )}
                    {visibleColumns.recomendacion && (
                      <th className="px-3 py-2 whitespace-nowrap">
                        <div>Recomendación</div>
                        <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                      </th>
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
