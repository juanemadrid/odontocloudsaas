import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReporteConvenios() {
  const { userProfile } = useAuth();
  const [allRecords, setAllRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [conveniosList, setConveniosList] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-09-22");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedConvenio, setSelectedConvenio] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [showConvenioDropdown, setShowConvenioDropdown] = useState(false);
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);

  // Estado de filtros aplicados al hacer clic en Buscar
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-09-22",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    convenio: "",
    paciente: ""
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fecha: true,
    convenio: true,
    paciente: true,
    documento: true,
    servicio: true,
    montoOriginal: true,
    descuentoConvenio: true,
    totalPagar: true,
    estado: true,
  });

  const columnLabels = {
    fecha: "Fecha hora",
    convenio: "Convenio",
    paciente: "Paciente",
    documento: "No. Documento / Historia",
    servicio: "Tratamiento / Servicio",
    montoOriginal: "Monto tarifa base",
    descuentoConvenio: "Descuento convenio",
    totalPagar: "Total a pagar",
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
        // Cargar Convenios registrados
        const qConvenios = query(
          collection(db, "convenios"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapConvenios = await getDocs(qConvenios);
        const listConv = [];
        snapConvenios.forEach(doc => {
          const c = doc.data();
          listConv.push({ id: doc.id, nombre: c.nombre || c.name || "Sin nombre" });
        });
        setConveniosList(listConv);

        // Cargar Pacientes
        const qPacientes = query(
          collection(db, "pacientes"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapPacientes = await getDocs(qPacientes);
        const listPacs = [];
        snapPacientes.forEach(doc => {
          const p = doc.data();
          const nom = `${p.nombre || p.nombres || ''} ${p.apellido || p.apellidos || ''}`.trim() || p.nombreCompleto || 'Sin nombre';
          listPacs.push({ id: doc.id, nombre: nom, documento: p.identificacion || p.nroDocumento || '' });
        });
        setPacientesList(listPacs);

        // Cargar Planes / Facturas asociadas a Convenios
        const qPlanes = query(
          collection(db, "planes"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapPlanes = await getDocs(qPlanes);
        const listRecords = [];

        snapPlanes.forEach(doc => {
          const p = doc.data();
          if (p.convenio || p.convenioNombre || p.convenioId) {
            const total = Number(p.total || 0);
            const desc = Number(p.descuentoConvenio || p.descuento || 0);
            listRecords.push({
              id: doc.id,
              fecha: p.createdAt || p.date,
              convenio: p.convenio || p.convenioNombre || "Convenio Institucional",
              paciente: p.patientName || p.nombrePaciente || "—",
              documento: p.patientDocument || p.identificacion || "—",
              servicio: p.title || p.nombre || "Plan de tratamiento con convenio",
              montoOriginal: total + desc,
              descuentoConvenio: desc,
              totalPagar: total,
              estado: p.status || "Activo"
            });
          }
        });

        listRecords.sort((a, b) => {
          const dateA = a.fecha?.seconds || (a.fecha ? new Date(a.fecha).getTime() / 1000 : 0);
          const dateB = b.fecha?.seconds || (b.fecha ? new Date(b.fecha).getTime() / 1000 : 0);
          return dateB - dateA;
        });

        setAllRecords(listRecords);

        // Aplicar filtrado inicial
        filterData(listRecords, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de convenios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(r => {
      // Filtro por Fechas
      const targetDate = r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null;
      if (targetDate) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (targetDate < init || targetDate > end) return false;
      }

      // Filtro por Convenio
      if (filters.convenio) {
        const convTarget = filters.convenio.toLowerCase();
        const rConv = (r.convenio || "").toLowerCase();
        if (!rConv.includes(convTarget) && !convTarget.includes(rConv)) return false;
      }

      // Filtro por Paciente
      if (filters.paciente) {
        const pacTarget = filters.paciente.toLowerCase();
        const rPac = (r.paciente || "").toLowerCase();
        if (!rPac.includes(pacTarget) && !pacTarget.includes(rPac)) return false;
      }

      return true;
    });

    // Buscador rápido en tabla
    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(r => (
        (r.convenio && r.convenio.toLowerCase().includes(term)) ||
        (r.paciente && r.paciente.toLowerCase().includes(term)) ||
        (r.servicio && r.servicio.toLowerCase().includes(term)) ||
        (r.documento && r.documento.toLowerCase().includes(term))
      ));
    }

    setFilteredRecords(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      convenio: selectedConvenio,
      paciente: selectedPaciente
    };
    setAppliedFilters(newFilters);
    filterData(allRecords, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredRecords.map(r => {
      const formatDateStr = (d) => {
        if (!d) return "";
        const dt = d.toDate ? d.toDate() : new Date(d);
        return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
      };

      return {
        "Fecha hora": formatDateStr(r.fecha),
        "Convenio": r.convenio || "—",
        "Paciente": r.paciente || "—",
        "No. Documento / Historia": r.documento || "—",
        "Tratamiento / Servicio": r.servicio || "—",
        "Monto tarifa base": Number(r.montoOriginal || 0),
        "Descuento convenio": Number(r.descuentoConvenio || 0),
        "Total a pagar": Number(r.totalPagar || 0),
        "Estado": r.estado || "Activo",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Convenios");
    XLSX.writeFile(workbook, `Reporte_Convenios_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte convenios</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte convenios</span>
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

        {/* Fila 2: Convenio (Buscador / Autocompletado) / Paciente (Autocompletado) + Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          
          {/* Convenio */}
          <div className="md:col-span-2 relative">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Convenio</label>
            <input
              type="text"
              placeholder="Buscar convenio..."
              value={selectedConvenio}
              onChange={(e) => {
                setSelectedConvenio(e.target.value);
                setShowConvenioDropdown(true);
              }}
              onFocus={() => setShowConvenioDropdown(true)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            />

            {showConvenioDropdown && (
              <div className="absolute left-0 right-0 top-16 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConvenio("");
                    setShowConvenioDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg transition-colors uppercase"
                >
                  -- TODOS LOS CONVENIOS --
                </button>
                {conveniosList
                  .filter(c => c.nombre.toLowerCase().includes(selectedConvenio.toLowerCase()))
                  .map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedConvenio(c.nombre);
                        setShowConvenioDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors uppercase truncate block"
                    >
                      {c.nombre}
                    </button>
                  ))}
                {conveniosList.filter(c => c.nombre.toLowerCase().includes(selectedConvenio.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 font-medium text-center">
                    No se encontraron convenios
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paciente */}
          <div className="md:col-span-2 relative">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Paciente</label>
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={selectedPaciente}
              onChange={(e) => {
                setSelectedPaciente(e.target.value);
                setShowPacienteDropdown(true);
              }}
              onFocus={() => setShowPacienteDropdown(true)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            />

            {showPacienteDropdown && (
              <div className="absolute left-0 right-0 top-16 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaciente("");
                    setShowPacienteDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg transition-colors uppercase"
                >
                  -- TODOS LOS PACIENTES --
                </button>
                {pacientesList
                  .filter(pac => pac.nombre.toLowerCase().includes(selectedPaciente.toLowerCase()))
                  .map(pac => (
                    <button
                      key={pac.id}
                      type="button"
                      onClick={() => {
                        setSelectedPaciente(pac.nombre);
                        setShowPacienteDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors uppercase truncate block"
                    >
                      {pac.nombre}
                    </button>
                  ))}
                {pacientesList.filter(pac => pac.nombre.toLowerCase().includes(selectedPaciente.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 font-medium text-center">
                    No se encontraron pacientes
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón Buscar */}
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
                  filterData(allRecords, appliedFilters, e.target.value);
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
              <span className="text-[11px] font-bold">Cargando reporte de convenios...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {visibleColumns.fecha && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha hora</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.convenio && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Convenio</div>
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
                      <div>No. Documento / Historia</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.servicio && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Tratamiento / Servicio</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.montoOriginal && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Monto tarifa base</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.descuentoConvenio && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Descuento convenio</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.totalPagar && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Total a pagar</div>
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
                {filteredRecords.map((r) => {
                  const formatDateStr = (d) => {
                    if (!d) return "";
                    const dt = d.toDate ? d.toDate() : new Date(d);
                    return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
                  };

                  return (
                    <tr key={r.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fecha && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {formatDateStr(r.fecha)}
                        </td>
                      )}
                      {visibleColumns.convenio && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 uppercase whitespace-nowrap">
                          {r.convenio || "—"}
                        </td>
                      )}
                      {visibleColumns.paciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-800 uppercase whitespace-nowrap">
                          {r.paciente || "—"}
                        </td>
                      )}
                      {visibleColumns.documento && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {r.documento || "—"}
                        </td>
                      )}
                      {visibleColumns.servicio && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {r.servicio || "—"}
                        </td>
                      )}
                      {visibleColumns.montoOriginal && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono text-right whitespace-nowrap">
                          $ {Number(r.montoOriginal || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.descuentoConvenio && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono text-emerald-600 font-bold text-right whitespace-nowrap">
                          -$ {Number(r.descuentoConvenio || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.totalPagar && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                          $ {Number(r.totalPagar || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className="uppercase text-[10px] font-black text-slate-500">
                            {r.estado || "Activo"}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No se encontraron registros de convenios para los filtros seleccionados.
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
