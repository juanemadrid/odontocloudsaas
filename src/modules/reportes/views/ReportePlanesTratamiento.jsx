import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReportePlanesTratamiento() {
  const { userProfile } = useAuth();
  const [allPlans, setAllPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2025-09-22");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedProfesional, setSelectedProfesional] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);
  const [tipoPlan, setTipoPlan] = useState("Plan de tratamiento"); // "Plan de tratamiento" | "Presupuesto"
  const [filtroFechaTipo, setFiltroFechaTipo] = useState("creacion"); // "creacion" | "realizado"
  const [pendientesFacturar, setPendientesFacturar] = useState(false);

  // Estado de filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2025-09-22",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    profesional: "",
    paciente: "",
    tipoPlan: "Plan de tratamiento",
    fechaTipo: "creacion",
    pendientesFacturar: false
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    fechaHoraCreacion: true,
    paciente: true,
    profesional: true,
    titulo: true,
    tipo: true,
    total: true,
    pagado: true,
    saldo: true,
    estado: true,
  });

  const columnLabels = {
    fechaHoraCreacion: "Fecha hora creación",
    paciente: "Paciente",
    profesional: "Profesional",
    titulo: "Título / Nombre Plan",
    tipo: "Tipo de plan",
    total: "Total",
    pagado: "Pagado",
    saldo: "Saldo",
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
        // Cargar Planes / Presupuestos
        const qPlanes = query(
          collection(db, "planes"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapPlanes = await getDocs(qPlanes);
        const listPlanes = [];
        snapPlanes.forEach(doc => {
          listPlanes.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar por fecha descendente
        listPlanes.sort((a, b) => {
          const dateA = a.createdAt?.seconds || (a.date ? new Date(a.date).getTime() / 1000 : 0);
          const dateB = b.createdAt?.seconds || (b.date ? new Date(b.date).getTime() / 1000 : 0);
          return dateB - dateA;
        });
        setAllPlans(listPlanes);

        // Cargar Doctores / Profesionales
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
          listPacs.push({ id: doc.id, nombre: nom });
        });
        setPacientesList(listPacs);

        // Aplicar filtro inicial
        filterPlans(listPlanes, appliedFilters, "");

      } catch (error) {
        console.error("Error cargando reporte de planes de tratamiento:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  const filterPlans = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(p => {
      // Tipo de plan ("Plan de tratamiento" => p.type === 'plan', "Presupuesto" => p.type === 'presupuesto' o no definido)
      if (filters.tipoPlan === "Plan de tratamiento" && p.type && p.type !== "plan") {
        return false;
      }
      if (filters.tipoPlan === "Presupuesto" && p.type === "plan") {
        return false;
      }

      // Filtro por Fechas
      const targetDate = p.date ? new Date(p.date) : (p.createdAt?.toDate ? p.createdAt.toDate() : null);
      if (targetDate) {
        const init = new Date(filters.fechaInicial + "T00:00:00");
        const end = new Date(filters.fechaFinal + "T23:59:59");
        if (targetDate < init || targetDate > end) return false;
      }

      // Filtro por Profesional
      if (filters.profesional) {
        const profTarget = filters.profesional.toLowerCase();
        const pProf = (p.profesionalId || p.profesional || "").toLowerCase();
        if (!pProf.includes(profTarget) && !profTarget.includes(pProf)) return false;
      }

      // Filtro por Paciente
      if (filters.paciente) {
        const pacTarget = filters.paciente.toLowerCase();
        const pPac = (p.patientName || p.nombrePaciente || p.patientId || "").toLowerCase();
        if (!pPac.includes(pacTarget) && !pacTarget.includes(pPac)) return false;
      }

      // Pendientes por facturar
      if (filters.pendientesFacturar) {
        const total = Number(p.total || 0);
        const pagado = Number(p.pagado || p.montoPagado || 0);
        if (total - pagado <= 0) return false;
      }

      return true;
    });

    // Búsqueda rápida
    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(p => (
        (p.title && p.title.toLowerCase().includes(term)) ||
        (p.patientName && p.patientName.toLowerCase().includes(term)) ||
        (p.profesional && p.profesional.toLowerCase().includes(term))
      ));
    }

    setFilteredPlans(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      profesional: selectedProfesional,
      paciente: selectedPaciente,
      tipoPlan,
      fechaTipo: filtroFechaTipo,
      pendientesFacturar
    };
    setAppliedFilters(newFilters);
    filterPlans(allPlans, newFilters, tableSearchTerm);
  };

  const handleExportExcel = () => {
    const rows = filteredPlans.map(p => {
      const formatDateStr = (d) => {
        if (!d) return "";
        const dt = d.toDate ? d.toDate() : new Date(d);
        return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
      };

      const total = Number(p.total || 0);
      const pagado = Number(p.pagado || p.montoPagado || 0);

      return {
        "Fecha hora creación": formatDateStr(p.date || p.createdAt),
        "Paciente": p.patientName || p.nombrePaciente || "—",
        "Profesional": p.profesionalId || p.profesional || "—",
        "Título / Nombre Plan": p.title || p.nombre || "—",
        "Tipo de plan": p.type === 'plan' ? "Plan de tratamiento" : "Presupuesto",
        "Total": total,
        "Pagado": pagado,
        "Saldo": total - pagado,
        "Estado": p.status || "Activo",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PlanesTratamiento");
    XLSX.writeFile(workbook, `Reporte_Planes_Tratamiento_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte planes de tratamiento</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte planes de tratamiento</span>
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

        {/* Fila 2: Profesional / Paciente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="">Seleccione...</option>
              {profesionales.map(prof => (
                <option key={prof.id} value={prof.nombre}>{prof.nombre}</option>
              ))}
            </select>
          </div>

          {/* Paciente (Buscador dinámico / Autocompletado) */}
          <div className="relative">
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
        </div>

        {/* Fila 3: Tipo de plan + Botón Buscar */}
        <div className="flex flex-wrap md:flex-nowrap items-end justify-between gap-6 mb-4">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tipo de plan</label>
            <select
              value={tipoPlan}
              onChange={(e) => setTipoPlan(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
            >
              <option value="Plan de tratamiento">Plan de tratamiento</option>
              <option value="Presupuesto">Presupuesto</option>
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

        {/* Fila 4: Radios */}
        <div className="flex items-center justify-center gap-8 pt-3 border-t border-slate-50 text-[11px] text-slate-600 font-medium">
          <span className="font-bold text-slate-400 text-[10px]">Mostrar</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="filtroFechaTipoPlan"
              checked={filtroFechaTipo === "creacion"}
              onChange={() => setFiltroFechaTipo("creacion")}
              className="text-sky-600 focus:ring-sky-500"
            />
            <span>Filtro por fecha de creación</span>
            <span className="text-slate-400 text-[10px] cursor-help" title="Filtra por la fecha de creación del plan">ⓘ</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="filtroFechaTipoPlan"
              checked={filtroFechaTipo === "realizado"}
              onChange={() => setFiltroFechaTipo("realizado")}
              className="text-sky-600 focus:ring-sky-500"
            />
            <span>Filtro por fecha de realizado</span>
            <span className="text-slate-400 text-[10px] cursor-help" title="Filtra por la fecha en la que se realizaron los procedimientos">ⓘ</span>
          </label>
        </div>

        {/* Fila 5: Switch "Pendientes por facturar" */}
        <div className="flex items-center justify-start gap-3 mt-4 pt-3 border-t border-slate-50 text-[11px]">
          <span className="font-bold text-slate-500">Pendientes por facturar</span>
          <button
            type="button"
            onClick={() => setPendientesFacturar(!pendientesFacturar)}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${pendientesFacturar ? 'bg-sky-500 justify-end' : 'bg-slate-300 justify-start'}`}
          >
            <div className="w-4 h-4 bg-white rounded-full shadow-md" />
          </button>
          <span className="text-slate-400 text-[10px] cursor-help" title="Filtra los planes que tienen saldos pendientes de pago/facturación">ⓘ</span>
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
                  filterPlans(allPlans, appliedFilters, e.target.value);
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
              <span className="text-[11px] font-bold">Cargando planes de tratamiento...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {visibleColumns.fechaHoraCreacion && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha hora creación</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.paciente && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Paciente</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.profesional && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Profesional</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.titulo && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Título / Nombre Plan</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.tipo && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Tipo</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.total && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Total</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.pagado && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Pagado</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.saldo && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-right">
                      <div>Saldo</div>
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
                {filteredPlans.map((p) => {
                  const formatDateStr = (d) => {
                    if (!d) return "";
                    const dt = d.toDate ? d.toDate() : new Date(d);
                    return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy HH:mm");
                  };

                  const total = Number(p.total || 0);
                  const pagado = Number(p.pagado || p.montoPagado || 0);
                  const saldo = total - pagado;

                  return (
                    <tr key={p.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.fechaHoraCreacion && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {formatDateStr(p.date || p.createdAt)}
                        </td>
                      )}
                      {visibleColumns.paciente && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-800 uppercase whitespace-nowrap">
                          {p.patientName || p.nombrePaciente || "—"}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3 py-2 border-r border-slate-100 uppercase whitespace-nowrap">
                          {p.profesionalId || p.profesional || "—"}
                        </td>
                      )}
                      {visibleColumns.titulo && (
                        <td className="px-3 py-2 border-r border-slate-100 font-semibold text-sky-600 whitespace-nowrap">
                          {p.title || p.nombre || "—"}
                        </td>
                      )}
                      {visibleColumns.tipo && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.type === 'plan' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {p.type === 'plan' ? 'Plan Tratamiento' : 'Presupuesto'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.total && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono font-bold text-right whitespace-nowrap">
                          $ {total.toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.pagado && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono text-emerald-600 font-bold text-right whitespace-nowrap">
                          $ {pagado.toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.saldo && (
                        <td className="px-3 py-2 border-r border-slate-100 font-mono text-rose-500 font-bold text-right whitespace-nowrap">
                          $ {saldo.toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className="uppercase text-[10px] font-black text-slate-500">
                            {p.status || "Activo"}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No se encontraron planes de tratamiento para los filtros seleccionados.
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
