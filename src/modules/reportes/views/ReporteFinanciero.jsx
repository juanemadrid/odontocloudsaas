import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { FiDollarSign, FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

const TIPO_MOVIMIENTO_OPTIONS = [
  "Todos",
  "CxC",
  "Factura de Compra",
  "Egreso-",
  "Recibo de caja+",
  "Nota crédito-",
  "Nota débito+",
  "Traslado Destino+",
  "Traslado Origen-",
  "Factura",
  "Factura Electrónica",
  "Consumo saldo a favor"
];

export default function ReporteFinanciero() {
  const { userProfile } = useAuth();
  const [allFacturas, setAllFacturas] = useState([]);
  const [filteredFacturas, setFilteredFacturas] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-07-01");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("OFICINA PRINCIPAL");
  const [tipoMovimiento, setTipoMovimiento] = useState("Todos");
  const [informacionContable, setInformacionContable] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  // Estado de filtros aplicados al dar clic en Buscar
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-07-01",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "OFICINA PRINCIPAL",
    tipoMovimiento: "Todos",
    informacionContable: false,
    profesional: "Todos"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fecha: true,
    documento: true,
    paciente: true,
    profesional: true,
    tipoMovimiento: true,
    descripcion: true,
    monto: true,
    estado: true,
  });

  const columnLabels = {
    fecha: "Fecha",
    documento: "No. Documento / Factura",
    paciente: "Paciente",
    profesional: "Profesional",
    tipoMovimiento: "Tipo de Movimiento",
    descripcion: "Descripción",
    monto: "Monto",
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
        // Cargar Facturas / Transacciones
        let snapFacturas = [];
        try {
          const { data } = await supabase.from("facturas").select("*").eq("tenant_id", userProfile.inquilino);
          if (data) snapFacturas = data;
        } catch (e) {}
        const listFacturas = (snapFacturas || []).map(d => ({ ...d }));

        // Cargar Pagos / Recibos de caja adicionales si existen
        let snapPagos = [];
        try {
          const { data } = await supabase.from("pagos").select("*").eq("tenant_id", userProfile.inquilino);
          if (data) snapPagos = data;
        } catch (e) {}

        (snapPagos || []).forEach(p => {
          listFacturas.push({
            id: p.id,
            idFactura: p.nroRecibo || `REC-${(p.id || "").slice(0, 6)}`,
            pacienteNombre: p.patientName || p.nombrePaciente || "—",
            descripcion: p.concepto || "Recibo de caja",
            monto: p.monto || p.valor || 0,
            estado: p.estado || "Pagada",
            tipoMovimiento: "Recibo de caja+",
            fecha: p.fecha || p.created_at,
            profesional: p.profesional || p.odontologo || ""
          });
        });

        listFacturas.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
        setAllFacturas(listFacturas);

        // Cargar Profesionales / Doctores
        let snapUsuarios = [];
        try {
          const { data } = await supabase.from("profiles").select("*").eq("tenant_id", userProfile.inquilino);
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

        // Aplicar filtro inicial
        filterData(listFacturas, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de facturación:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(f => {
      // Filtro por Fechas
      const targetDate = f.fecha ? (f.fecha.toDate ? f.fecha.toDate() : new Date(f.fecha)) : null;
      if (targetDate) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (targetDate < init || targetDate > end) return false;
      }

      // Filtro por Tipo de Movimiento
      if (filters.tipoMovimiento !== "Todos") {
        const movType = (f.tipoMovimiento || f.tipo || "Factura").toLowerCase();
        if (!movType.includes(filters.tipoMovimiento.toLowerCase())) return false;
      }

      // Filtro por Profesional
      if (filters.profesional !== "Todos") {
        const profTarget = filters.profesional.toLowerCase();
        const fProf = (f.profesional || f.profesionalAsignado || f.odontologo || "").toLowerCase();
        if (!fProf.includes(profTarget) && !profTarget.includes(fProf)) return false;
      }

      return true;
    });

    // Búsqueda rápida en tabla
    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(f => (
        (f.idFactura && f.idFactura.toLowerCase().includes(term)) ||
        (f.pacienteNombre && f.pacienteNombre.toLowerCase().includes(term)) ||
        (f.descripcion && f.descripcion.toLowerCase().includes(term))
      ));
    }

    setFilteredFacturas(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      oficina,
      tipoMovimiento,
      informacionContable,
      profesional: selectedProfesional
    };
    setAppliedFilters(newFilters);
    filterData(allFacturas, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredFacturas.map(f => {
      const formatDateStr = (d) => {
        if (!d) return "";
        const dt = d.toDate ? d.toDate() : new Date(d);
        return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
      };

      return {
        "Fecha": formatDateStr(f.fecha),
        "No. Documento / Factura": f.idFactura || f.id || "—",
        "Paciente": f.pacienteNombre || "—",
        "Profesional": f.profesional || f.profesionalAsignado || "—",
        "Tipo de Movimiento": f.tipoMovimiento || "Factura",
        "Descripción": f.descripcion || "Facturación médica",
        "Monto": Number(f.monto || 0),
        "Estado": f.estado || "Pagada",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación");
    XLSX.writeFile(workbook, `Reporte_Facturacion_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte facturación</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte facturación</span>
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
             max="9999-12-31" min="1900-01-01" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha final</label>
            <input
              type="date"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
             max="9999-12-31" min="1900-01-01" />
          </div>
        </div>

        {/* Fila 2: Oficina / Tipo de movimiento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Oficina</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="OFICINA PRINCIPAL">OFICINA PRINCIPAL / CLINICA DENTAL</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tipo de movimiento</label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            >
              {TIPO_MOVIMIENTO_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 3: Información contable + Profesionales + Botón Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          
          {/* Switch Información contable */}
          <div className="flex items-center gap-3 h-9">
            <span className="font-bold text-[11px] text-slate-500">Información contable</span>
            <button
              type="button"
              onClick={() => setInformacionContable(!informacionContable)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${informacionContable ? 'bg-sky-500 justify-end' : 'bg-slate-300 justify-start'}`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-md" />
            </button>
            <span className="text-slate-400 text-[10px] cursor-help" title="Muestra desgloses contables adicionales">ⓘ</span>
          </div>

          {/* Profesionales */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Profesionales</label>
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

          {/* Botón Buscar */}
          <div>
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
                  filterData(allFacturas, appliedFilters, e.target.value);
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
              <span className="text-[11px] font-bold">Cargando reporte de facturación...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {visibleColumns.fecha && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha</div>                    </th>
                  )}
                  {visibleColumns.documento && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>No. Documento / Factura</div>                    </th>
                  )}
                  {visibleColumns.paciente && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Paciente</div>                    </th>
                  )}
                  {visibleColumns.profesional && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Profesional</div>                    </th>
                  )}
                  {visibleColumns.tipoMovimiento && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Tipo de movimiento</div>                    </th>
                  )}
                  {visibleColumns.descripcion && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Descripción</div>                    </th>
                  )}
                  {visibleColumns.monto && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Monto</div>                    </th>
                  )}
                  {visibleColumns.estado && (
                    <th className="px-3 py-2 whitespace-nowrap text-center">
                      <div>Estado</div>                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredFacturas.map((f) => {
                  const formatDateStr = (d) => {
                    if (!d) return "";
                    const dt = d.toDate ? d.toDate() : new Date(d);
                    return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
                  };

                  const monto = Number(f.monto || 0);

                  return (
                    <tr key={f.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fecha && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {formatDateStr(f.fecha)}
                        </td>
                      )}
                      {visibleColumns.documento && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 whitespace-nowrap">
                          {f.idFactura || f.id || "—"}
                        </td>
                      )}
                      {visibleColumns.paciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-800 uppercase whitespace-nowrap">
                          {f.pacienteNombre || "—"}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {f.profesional || f.profesionalAsignado || "—"}
                        </td>
                      )}
                      {visibleColumns.tipoMovimiento && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {f.tipoMovimiento || "Factura"}
                          </span>
                        </td>
                      )}
                      {visibleColumns.descripcion && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {f.descripcion || "Facturación médica"}
                        </td>
                      )}
                      {visibleColumns.monto && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono font-bold text-emerald-600 text-right whitespace-nowrap">
                          $ {monto.toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${f.estado === "Pagada" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                            {f.estado || "Pagada"}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredFacturas.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No se encontraron transacciones para los filtros seleccionados.
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
