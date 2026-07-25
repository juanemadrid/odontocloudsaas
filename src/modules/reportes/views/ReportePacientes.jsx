import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FiSearch, FiFileText, FiFilter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReportePacientes() {
  const { userProfile } = useAuth();
  const [allPacientes, setAllPacientes] = useState([]);
  const [filteredPacientes, setFilteredPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros de estado de los inputs
  const [selectedYearMonth, setSelectedYearMonth] = useState(format(new Date(), "yyyy/MM"));
  const [selectedProfesional, setSelectedProfesional] = useState("TODOS");
  const [filtroFechaTipo, setFiltroFechaTipo] = useState("creacion"); // "creacion" | "ingreso"
  const [filtroUltimaCitaEstado, setFiltroUltimaCitaEstado] = useState("atendida"); // "atendida" | "cualquiera"
  
  // Filtros aplicados al presionar el botón "Buscar"
  const [appliedFilters, setAppliedFilters] = useState({
    yearMonth: format(new Date(), "yyyy/MM"),
    profesional: "TODOS",
    fechaTipo: "creacion",
    ultimaCitaEstado: "atendida"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        // Cargar Pacientes
        const qPacientes = query(
          collection(db, "pacientes"), 
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapshotPacientes = await getDocs(qPacientes);
        const dataPacientes = [];
        snapshotPacientes.forEach(doc => {
          dataPacientes.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar desc por fecha
        dataPacientes.sort((a, b) => {
          const dateA = a.fechaCreacion?.seconds || (a.fechaCreacion ? new Date(a.fechaCreacion).getTime() / 1000 : 0);
          const dateB = b.fechaCreacion?.seconds || (b.fechaCreacion ? new Date(b.fechaCreacion).getTime() / 1000 : 0);
          return dateB - dateA;
        });
        setAllPacientes(dataPacientes);

        // Cargar ÚNICAMENTE doctores / odontólogos para la lista de profesionales
        const qUsuarios = query(
          collection(db, "usuarios"),
          where("inquilino", "==", userProfile.inquilino)
        );
        const snapshotUsuarios = await getDocs(qUsuarios);
        const listProfs = [];
        snapshotUsuarios.forEach(doc => {
          const u = doc.data();
          const role = (u.rol || u.role || "").toLowerCase();
          // Filtrar estrictamente solo si es doctor u odontólogo
          if (role === "odontologo" || role === "doctor" || role === "odontóloga" || role === "doctores" || u.esOdontologo === true) {
            const primerNombre = u.nombre || u.nombres || u.displayName || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
            
            listProfs.push({ 
              id: doc.id, 
              nombre: nombreCompleto,
              rawName: u.nombre || u.nombres || u.displayName || "",
              rawLastName: u.apellido || u.apellidos || "",
              allNames: [
                doc.id,
                nombreCompleto.toLowerCase(),
                primerNombre.toLowerCase(),
                primerApellido.toLowerCase(),
                (u.email || "").toLowerCase(),
                (u.displayName || "").toLowerCase()
              ].filter(Boolean)
            });
          }
        });
        setProfesionales(listProfs);

        // Aplicar filtrado inicial
        filterData(dataPacientes, {
          yearMonth: format(new Date(), "yyyy/MM"),
          profesional: "TODOS",
          fechaTipo: "creacion"
        }, "");

      } catch (error) {
        console.error("Error cargando reporte de pacientes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  // Función encargada de filtrar los pacientes con los criterios confirmados
  const filterData = (sourceList, filters, quickSearch) => {
    let result = sourceList.filter(p => {
      // Filtro por fecha (Año/Mes)
      const targetDateRaw = filters.fechaTipo === "creacion" ? (p.fechaCreacion || p.createdAt) : (p.fechaIngreso || p.fechaCreacion);
      if (filters.yearMonth && targetDateRaw) {
        let dObj = null;
        if (targetDateRaw?.toDate) dObj = targetDateRaw.toDate();
        else dObj = new Date(targetDateRaw);
        if (!isNaN(dObj.getTime())) {
          const pYm = format(dObj, "yyyy/MM");
          if (pYm !== filters.yearMonth) return false;
        }
      }

      // Filtro por Profesional (Doctor)
      if (filters.profesional !== "TODOS") {
        const profObj = profesionales.find(pr => pr.nombre === filters.profesional || pr.id === filters.profesional);
        
        // Extraer todos los valores posibles de profesional dentro del registro del paciente
        const pValues = [
          p.profesionalAsignado,
          p.profesional,
          p.odontologo,
          p.doctor,
          p.profesionalId,
          p.odontologoId,
          p.doctorId,
          p.odontologoAsignado,
          p.medicoTratante
        ].map(v => String(v || "").toLowerCase().trim()).filter(Boolean);

        let isMatch = false;

        if (profObj && profObj.allNames) {
          // Si tenemos el objeto del profesional seleccionado con sus variantes
          isMatch = pValues.some(pVal => 
            profObj.allNames.some(nameVariant => 
              pVal === nameVariant || pVal.includes(nameVariant) || nameVariant.includes(pVal)
            )
          );
        } else {
          // Comparación fallback con el string seleccionado
          const targetProfStr = String(filters.profesional).toLowerCase().trim();
          isMatch = pValues.some(pVal => pVal === targetProfStr || pVal.includes(targetProfStr) || targetProfStr.includes(pVal));
        }

        if (!isMatch) return false;
      }

      return true;
    });

    // Filtro rápido de tabla
    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase();
      result = result.filter(p => (
        (p.nombre && p.nombre.toLowerCase().includes(term)) ||
        (p.apellido && p.apellido.toLowerCase().includes(term)) ||
        (p.identificacion && p.identificacion.toLowerCase().includes(term)) ||
        (p.numeroHistoria && p.numeroHistoria.toString().toLowerCase().includes(term)) ||
        (p.email && p.email.toLowerCase().includes(term)) ||
        (p.celular && p.celular.toLowerCase().includes(term))
      ));
    }

    setFilteredPacientes(result);
  };

  const [hasSearched, setHasSearched] = useState(false);

  // Disparar búsqueda al hacer click en "Buscar"
  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      yearMonth: selectedYearMonth,
      profesional: selectedProfesional,
      fechaTipo: filtroFechaTipo
    };
    setAppliedFilters(newFilters);
    filterData(allPacientes, newFilters, tableSearchTerm);
  };

  // Al cambiar la búsqueda rápida en la tabla
  const handleQuickSearchChange = (term) => {
    setTableSearchTerm(term);
    filterData(allPacientes, appliedFilters, term);
  };

  // Generar reporte en Excel idéntico al xlsx de OralDrive
  const handleExportExcel = () => {
    const rows = filteredPacientes.map(p => {
      const formatDateStr = (dateVal) => {
        if (!dateVal) return "";
        if (dateVal.toDate) return format(dateVal.toDate(), "dd/MM/yyyy HH:mm");
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? String(dateVal) : format(d, "dd/MM/yyyy HH:mm");
      };

      return {
        "Fecha hora ingreso": formatDateStr(p.fechaIngreso || p.fechaCreacion),
        "Fecha hora creación": formatDateStr(p.fechaCreacion || p.createdAt),
        "Tipo de documento": p.tipoDocumento || p.tipoIdentificacion || "Documento Nacional de Identidad",
        "Documento": p.identificacion || p.nroDocumento || "",
        "Número Historia": p.numeroHistoria || p.identificacion || "",
        "Nombre": p.nombre || p.nombres || "",
        "Apellido": p.apellido || p.apellidos || "",
        "Genero": p.genero || p.sexo || "Masculino",
        "RH": p.rh || "",
        "Estado civil": p.estadoCivil || "1",
        "Fecha de nacimiento": p.fechaNacimiento ? format(new Date(p.fechaNacimiento), "dd/MM/yyyy") : "",
        "Edad": p.edad || "",
        "País de nacimiento": p.paisNacimiento || "Colombia",
        "Ciudad de nacimiento": p.ciudadNacimiento || "",
        "Dirección": p.direccion || "",
        "País de domicilio": p.paisDomicilio || "Colombia",
        "Ciudad de domicilio": p.ciudadDomicilio || "",
        "Lugar de expedición del documento": p.lugarExpedicion || "",
        "Barrio": p.barrio || "",
        "Estrato": p.estrato || "",
        "Zona residencial": p.zonaResidencial || "1",
        "Celular": p.celular || p.telefono || "",
        "Teléfono": p.telefono || "",
        "Teléfono oficina": p.telefonoOficina || "",
        "Extensión oficina": p.extensionOficina || "",
        "Correo": p.email || p.correo || "",
        "Ocupación": p.ocupacion || "",
        "Nombre del responsable": p.nombreResponsable || "",
        "Relación con responsable": p.relacionResponsable || "",
        "Celular responsable": p.celularResponsable || "",
        "Teléfono responsable": p.telefonoResponsable || "",
        "Correo responsable": p.correoResponsable || "",
        "Nombre acompañante": p.nombreAcompanante || "",
        "Teléfono acompañante": p.telefonoAcompanante || "",
        "Convenio": p.convenio || "",
        "Tipo de afiliación": p.tipoAfiliacion || "",
        "Eps": p.eps || "",
        "Poliza de salud": p.polizaSalud || "",
        "Sgsss": p.sgsss || "",
        "Tipo de paciente": p.tipoPaciente || "",
        "Convenio beneficio": p.convenioBeneficio || "",
        "Convenio de pago": p.convenioPago || "",
        "Cómo nos conoció": p.comoNosConocio || "",
        "Campaña": p.campana || "",
        "Remitido por": p.remitidoPor || "",
        "Asesor comercial": p.asesorComercial || "",
        "Presupuestos": p.presupuestosCount ?? 0,
        "Tratamientos iniciados": p.tratamientosIniciadosCount ?? 0,
        "Tratamientos no iniciados": p.tratamientosNoIniciadosCount ?? 0,
        "Tratamientos finalizados": p.tratamientosFinalizadosCount ?? 0,
        "Citas": p.citasCount ?? 0,
        "Profesionales": p.profesionalAsignado || p.profesional || p.odontologo || p.doctor || userProfile?.displayName || "",
        "Proxima Cita": p.proximaCita ? format(new Date(p.proximaCita), "dd/MM/yyyy") : ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pacientes");
    XLSX.writeFile(workbook, `Reporte_Pacientes_${appliedFilters.yearMonth.replace('/', '-')}.xlsx`);
  };

  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    fechaIngreso: true,
    fechaCreacion: true,
    tipoDocumento: true,
    documento: true,
    numeroHistoria: true,
    nombre: true,
    apellido: true,
    genero: true,
    rh: true,
    estadoCivil: true,
  });

  const columnLabels = {
    fechaIngreso: "Fecha hora ingreso",
    fechaCreacion: "Fecha hora creación",
    tipoDocumento: "Tipo de documento",
    documento: "Documento",
    numeroHistoria: "Número Historia",
    nombre: "Nombre",
    apellido: "Apellido",
    genero: "Genero",
    rh: "RH",
    estadoCivil: "Estado civil",
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-800 tracking-tight">Reporte pacientes</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500 font-bold">Reporte pacientes</span>
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

      {/* ─── ÁREA DE FILTROS 1:1 CON ORALDRIVE ─── */}
      <div className="mx-5 mt-3 p-5 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          
          {/* Año/Mes */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Año/Mes</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                placeholder="YYYY/MM"
                className="w-full h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all"
              />
              <span className="absolute right-2.5 text-slate-400 text-xs pointer-events-none">📅</span>
            </div>
          </div>

          {/* Profesional */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 transition-all uppercase"
            >
              <option value="TODOS">Seleccione...</option>
              {profesionales.map(prof => (
                <option key={prof.id} value={prof.nombre}>{prof.nombre}</option>
              ))}
            </select>
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

        {/* Opciones de Radio 1: Mostrar (Filtro por fecha de creación / Filtro por fecha de ingreso) */}
        <div className="flex items-center gap-8 mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-600 font-semibold">
          <span className="text-slate-500 font-bold text-[11px] min-w-[120px]">Mostrar</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="filtroFechaTipo"
              checked={filtroFechaTipo === "creacion"}
              onChange={() => setFiltroFechaTipo("creacion")}
              className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
            />
            <span>Filtro por fecha de creación</span>
            <span className="text-slate-400 text-[10px] cursor-help" title="Filtra por la fecha en la que se creó el registro del paciente">ⓘ</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer ml-4">
            <input
              type="radio"
              name="filtroFechaTipo"
              checked={filtroFechaTipo === "ingreso"}
              onChange={() => setFiltroFechaTipo("ingreso")}
              className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
            />
            <span>Filtro por fecha de ingreso</span>
            <span className="text-slate-400 text-[10px] cursor-help" title="Filtra por la fecha en la que el paciente ingresó a la clínica">ⓘ</span>
          </label>
        </div>

        {/* Opciones de Radio 2: Última cita en estado (Estado atendida / Cualquier estado) */}
        <div className="flex items-center gap-8 mt-3 text-[11px] text-slate-600 font-semibold">
          <span className="text-slate-500 font-bold text-[11px] min-w-[120px]">Última cita en estado:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="filtroUltimaCitaEstado"
              checked={filtroUltimaCitaEstado === "atendida"}
              onChange={() => setFiltroUltimaCitaEstado("atendida")}
              className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
            />
            <span>Estado atendida</span>
            <span className="text-slate-400 text-[10px] cursor-help" title="Filtra pacientes cuya última cita estuvo en estado atendida">ⓘ</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer ml-4">
            <input
              type="radio"
              name="filtroUltimaCitaEstado"
              checked={filtroUltimaCitaEstado === "cualquiera"}
              onChange={() => setFiltroUltimaCitaEstado("cualquiera")}
              className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
            />
            <span>Cualquier estado</span>
            <span className="text-slate-400 text-[10px] cursor-help" title="Muestra pacientes sin importar el estado de su última cita">ⓘ</span>
          </label>
        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS Y BARRA DE HERRAMIENTAS DE TABLA (SÓLO TRAS DAR CLIC EN BUSCAR) ─── */}
      {hasSearched && (
        <div className="mx-5 my-3 flex-1 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden animate-fadeIn">
        
        {/* Barra superior de la tabla (Arrastre columna + Botones acción + Buscador rápido) */}
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

              {/* Popover de Selección de Columnas */}
              {showColumnSelector && (
                <div className="absolute right-0 top-9 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
                  <div className="text-[11px] font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                    <span>Seleccionar columnas</span>
                    <button 
                      onClick={() => setShowColumnSelector(false)} 
                      className="text-slate-400 hover:text-slate-600 text-[10px]"
                    >
                      ✕
                    </button>
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
            
            {/* Campo Buscar rápido en tabla */}
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Buscar..."
                value={tableSearchTerm}
                onChange={(e) => handleQuickSearchChange(e.target.value)}
                className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-200 rounded-md text-[11px] outline-none focus:border-sky-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contenido de la Tabla DataGrid */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-[11px] font-bold">Cargando pacientes...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {visibleColumns.documento && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Documento</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.correo && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Correo</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.fechaIngreso && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha hora ingreso</div>
                      <div className="mt-1 flex items-center justify-between">
                        <input type="text" className="w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                        <span className="ml-1 text-slate-400">📅</span>
                      </div>
                    </th>
                  )}
                  {visibleColumns.fechaCreacion && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Fecha hora creación</div>
                      <div className="mt-1 flex items-center justify-between">
                        <input type="text" className="w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                        <span className="ml-1 text-slate-400">📅</span>
                      </div>
                    </th>
                  )}
                  {visibleColumns.tipoDocumento && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Tipo de documento</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.numeroHistoria && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Número Historia</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.nombre && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Nombre</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.apellido && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Apellido</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.genero && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>Genero</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.rh && (
                    <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div>RH</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                  {visibleColumns.estadoCivil && (
                    <th className="px-3 py-2 whitespace-nowrap">
                      <div>Estado civil</div>
                      <input type="text" className="mt-1 w-full h-5 px-1 text-[10px] border border-slate-200 rounded font-normal" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPacientes.map((p) => {
                  const formatDateStr = (dateVal) => {
                    if (!dateVal) return "";
                    if (dateVal.toDate) return format(dateVal.toDate(), "dd/MM/yyyy HH:mm");
                    const d = new Date(dateVal);
                    return isNaN(d.getTime()) ? String(dateVal) : format(d, "dd/MM/yyyy HH:mm");
                  };

                  return (
                    <tr key={p.id} className="hover:bg-sky-50/40 transition-colors">
                      {visibleColumns.documento && (
                        <td className="px-3 py-2 border-r border-slate-100 font-bold text-sky-600 whitespace-nowrap">
                          {p.identificacion || p.nroDocumento || "—"}
                        </td>
                      )}
                      {visibleColumns.correo && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap text-sky-700">
                          {p.email || p.correo || "—"}
                        </td>
                      )}
                      {visibleColumns.fechaIngreso && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {formatDateStr(p.fechaIngreso || p.fechaCreacion)}
                        </td>
                      )}
                      {visibleColumns.fechaCreacion && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {formatDateStr(p.fechaCreacion || p.createdAt)}
                        </td>
                      )}
                      {visibleColumns.tipoDocumento && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {p.tipoDocumento || p.tipoIdentificacion || "Cédula de ciudadanía"}
                        </td>
                      )}
                      {visibleColumns.numeroHistoria && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {p.numeroHistoria || p.identificacion || "—"}
                        </td>
                      )}
                      {visibleColumns.nombre && (
                        <td className="px-3 py-2 border-r border-slate-100 font-semibold whitespace-nowrap uppercase">
                          {p.nombre || p.nombres || "—"}
                        </td>
                      )}
                      {visibleColumns.apellido && (
                        <td className="px-3 py-2 border-r border-slate-100 font-semibold whitespace-nowrap uppercase">
                          {p.apellido || p.apellidos || "—"}
                        </td>
                      )}
                      {visibleColumns.genero && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {p.genero || p.sexo || "Masculino"}
                        </td>
                      )}
                      {visibleColumns.rh && (
                        <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                          {p.rh || "—"}
                        </td>
                      )}
                      {visibleColumns.estadoCivil && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          {p.estadoCivil || "1"}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredPacientes.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No se encontraron registros de pacientes para los filtros seleccionados.
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
