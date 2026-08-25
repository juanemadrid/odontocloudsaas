import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { calculateAgeStr } from "../../../utils/formatters";
import { FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReportePacientes() {
  const { userProfile } = useAuth();
  const [allPacientes, setAllPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros principales (formulario superior)
  const [selectedYearMonth, setSelectedYearMonth] = useState(format(new Date(), "yyyy/MM"));
  const [selectedProfesional, setSelectedProfesional] = useState("TODOS");
  const [filtroFechaTipo, setFiltroFechaTipo] = useState("creacion"); // "creacion" | "ingreso"

  // Estado de si se ha presionado Buscar (inicia en false para no cargar hasta que el usuario busque)
  const [hasSearched, setHasSearched] = useState(false);
  const [expandAllGroups, setExpandAllGroups] = useState(true);

  const monthPickerRef = React.useRef(null);
  const tableContainerRef = React.useRef(null);

  // Filtros aplicados al presionar "Buscar"
  const [appliedFilters, setAppliedFilters] = useState({
    yearMonth: format(new Date(), "yyyy/MM"),
    profesional: "TODOS",
    fechaTipo: "creacion"
  });

  // Filtro de búsqueda rápida global en la tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  // Filtros individuales por columna
  const [columnFilters, setColumnFilters] = useState({});

  // Control de selector de columnas visibles
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Definición completa de columnas disponibles (1:1 con OralDrive)
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
    fechaNacimiento: true,
    edad: true,
    paisNacimiento: true,
    ciudadNacimiento: true,
    direccion: true,
    paisDomicilio: true,
    ciudadDomicilio: true,
    lugarExpedicion: true,
    barrio: true,
    estrato: true,
    zonaResidencial: true,
    celular: true,
    telefono: true,
    telefonoOficina: true,
    extensionOficina: true,
    correo: true,
    ocupacion: true,
    nombreResponsable: true,
    relacionResponsable: true,
    celularResponsable: true,
    telefonoResponsable: true,
    correoResponsable: true,
    nombreAcompanante: true,
    telefonoAcompanante: true,
    convenio: true,
    tipoAfiliacion: true,
    eps: true,
    polizaSalud: true,
    sgsss: true,
    tipoPaciente: true,
    convenioBeneficio: true,
    convenioPago: true,
    comoNosConocio: true,
    campana: true,
    remitidoPor: true,
    asesorComercial: true,
    presupuestos: true,
    tratamientosIniciados: true,
    tratamientosNoIniciados: true,
    tratamientosFinalizados: true,
    citas: true,
    profesionales: true,
    proximaCita: true
  });

  const columnLabels = {
    fechaIngreso: "Fecha hora ingreso",
    fechaCreacion: "Fecha hora creación",
    tipoDocumento: "Tipo de documento",
    documento: "Documento",
    numeroHistoria: "Número Historia",
    nombre: "Nombre",
    apellido: "Apellido",
    genero: "Género",
    rh: "RH",
    estadoCivil: "Estado civil",
    fechaNacimiento: "Fecha de nacimiento",
    edad: "Edad",
    paisNacimiento: "País de nacimiento",
    ciudadNacimiento: "Ciudad de nacimiento",
    direccion: "Dirección",
    paisDomicilio: "País de domicilio",
    ciudadDomicilio: "Ciudad de domicilio",
    lugarExpedicion: "Lugar de expedición del documento",
    barrio: "Barrio",
    estrato: "Estrato",
    zonaResidencial: "Zona residencial",
    celular: "Celular",
    telefono: "Teléfono",
    telefonoOficina: "Teléfono oficina",
    extensionOficina: "Extensión oficina",
    correo: "Correo",
    ocupacion: "Ocupación",
    nombreResponsable: "Nombre del responsable",
    relacionResponsable: "Relación con responsable",
    celularResponsable: "Celular responsable",
    telefonoResponsable: "Teléfono responsable",
    correoResponsable: "Correo responsable",
    nombreAcompanante: "Nombre acompañante",
    telefonoAcompanante: "Teléfono acompañante",
    convenio: "Convenio",
    tipoAfiliacion: "Tipo de afiliación",
    eps: "EPS",
    polizaSalud: "Póliza de salud",
    sgsss: "SGSSS",
    tipoPaciente: "Tipo de paciente",
    convenioBeneficio: "Convenio beneficio",
    convenioPago: "Convenio de pago",
    comoNosConocio: "Cómo nos conoció",
    campana: "Campaña",
    remitidoPor: "Remitido por",
    asesorComercial: "Asesor comercial",
    presupuestos: "Presupuestos",
    tratamientosIniciados: "Tratamientos iniciados",
    tratamientosNoIniciados: "Tratamientos no iniciados",
    tratamientosFinalizados: "Tratamientos finalizados",
    citas: "Citas",
    profesionales: "Profesionales",
    proximaCita: "Próxima Cita"
  };

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllColumns = (val) => {
    const updated = {};
    Object.keys(visibleColumns).forEach((k) => {
      updated[k] = val;
    });
    setVisibleColumns(updated);
  };

  // Carga de datos desde Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.inquilino) return;
      setLoading(true);
      try {
        const tenantId = userProfile?.inquilino || userProfile?.tenant_id;

        // 1. Cargar pacientes
        let dataPacientes = [];
        try {
          const { data, error } = await supabase
            .from("pacientes")
            .select("*")
            .eq("tenant_id", tenantId);
          if (!error && data) dataPacientes = data;
        } catch (e) {
          console.warn("Error consultando pacientes:", e);
        }

        // 2. Cargar citas para calcular la Próxima Cita real y conteo de citas
        let snapCitas = [];
        try {
          const { data: cData } = await supabase
            .from("citas")
            .select("*")
            .eq("tenant_id", tenantId);
          if (cData) snapCitas = cData;
        } catch (e) {
          console.warn("Error consultando citas:", e);
        }

        // 3. Cargar planes de tratamiento para calcular presupuestos y tratamientos
        let snapPlanes = [];
        try {
          const { data: plData } = await supabase
            .from("treatment_plans")
            .select("*")
            .eq("tenant_id", tenantId);
          if (plData) snapPlanes = plData;
        } catch (e) {
          console.warn("Error consultando planes:", e);
        }

        // 4. Cargar usuarios / doctores para el filtro
        let snapshotUsuarios = [];
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", tenantId);
          if (data) snapshotUsuarios = data;
        } catch (e) {}

        const listProfs = [];
        (snapshotUsuarios || []).forEach((u) => {
          if (isDoctorUser(u)) {
            const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || u.email || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;

            listProfs.push({
              id: u.id,
              nombre: nombreCompleto,
              rawName: primerNombre,
              rawLastName: primerApellido,
              allNames: [
                u.id,
                nombreCompleto.toLowerCase(),
                primerNombre.toLowerCase(),
                primerApellido.toLowerCase(),
                (u.email || "").toLowerCase()
              ].filter(Boolean)
            });
          }
        });
        setProfesionales(listProfs);

        // Fecha de hoy a medianoche para filtrar citas futuras
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        // Normalización uniforme de campos de pacientes con datos clínicos en tiempo real
        const normalized = (dataPacientes || []).map((p) => {
          const fn = p.fecha_nacimiento || p.fechaNacimiento || "";
          const calculatedAge = fn ? calculateAgeStr(fn) : (p.edad || "");
          const pDocStr = String(p.documento || p.nroDocumento || p.identificacion || "").trim();

          // Citas de este paciente
          const patientCitas = (snapCitas || []).filter(c => {
            const cPacId = c.paciente_id || c.pacienteId || c.paciente;
            const cDoc = String(c.paciente_documento || c.pacienteDocumento || c.documento || "").trim();
            return (cPacId && cPacId === p.id) || (cDoc && pDocStr && cDoc === pDocStr);
          });

          // Próxima Cita (cita futura más cercana no cancelada)
          const futureCitas = patientCitas.filter(c => {
            const estado = (c.estado || "").toLowerCase();
            if (estado === "cancelada" || estado === "anulada" || estado === "no_asistio") return false;

            const rawD = c.fecha || c.fecha_inicio || c.start || c.fechaCita;
            if (!rawD) return false;
            const hora = c.hora || c.hora_inicio || "00:00";
            const citaDt = new Date(rawD.includes("T") ? rawD : `${rawD}T${hora}:00`);
            return !isNaN(citaDt.getTime()) && citaDt.getTime() >= todayMidnight.getTime();
          });

          futureCitas.sort((a, b) => {
            const dtA = new Date(a.fecha ? `${a.fecha}T${a.hora || '00:00'}:00` : (a.fecha_inicio || a.start || 0));
            const dtB = new Date(b.fecha ? `${b.fecha}T${b.hora || '00:00'}:00` : (b.fecha_inicio || b.start || 0));
            return dtA - dtB;
          });

          const nextCita = futureCitas[0];
          let proximaCitaVal = "";
          if (nextCita) {
            proximaCitaVal = nextCita.fecha 
              ? `${nextCita.fecha}${nextCita.hora ? 'T' + nextCita.hora : ''}` 
              : (nextCita.fecha_inicio || nextCita.start);
          } else {
            proximaCitaVal = p.proximaCita || p.proxima_cita || "";
          }

          // Planes de tratamiento de este paciente
          const patientPlans = (snapPlanes || []).filter(pl => {
            const plPacId = pl.paciente_id || pl.pacienteId || pl.patientId;
            const plDoc = String(pl.documento || pl.pacienteDocumento || "").trim();
            return (plPacId && plPacId === p.id) || (plDoc && pDocStr && plDoc === pDocStr);
          });

          let presupuestosCount = 0;
          let tratIniciadosCount = 0;
          let tratNoIniciadosCount = 0;
          let tratFinalizadosCount = 0;

          patientPlans.forEach(pl => {
            const d = pl.detalles || {};
            const status = String(pl.estado || d.estado || "").toLowerCase();
            const type = String(pl.type || d.type || pl.tipo || "").toLowerCase();

            if (type.includes("presupuesto") || status === "draft" || status === "borrador" || status === "pending") {
              presupuestosCount++;
            } else if (status === "finalizado" || status === "completado" || status === "terminado") {
              tratFinalizadosCount++;
            } else if (status === "iniciado" || status === "approved" || status === "activo" || status === "en_progreso") {
              tratIniciadosCount++;
            } else {
              tratNoIniciadosCount++;
            }
          });

          // Profesional asignado
          const doctorName = p.profesional_nombre || p.profesionalNombre || p.profesionalAsignado || p.profesional || p.odontologo || p.doctor || p.medicoTratante || (Array.isArray(p.historial_medico?.profesionales) ? p.historial_medico.profesionales.map(x => x.nombre).join(", ") : "") || (nextCita?.doctor || nextCita?.profesional_nombre || "");
          const doctorId = p.profesional_id || p.profesionalId || p.odontologo_id || p.odontologoId || p.doctor_id || p.doctorId || nextCita?.doctor_id || "";

          return {
            id: p.id,
            raw: p,
            fechaIngreso: p.fecha_ingreso || p.fechaIngreso || p.created_at || p.createdAt || p.fechaCreacion,
            fechaCreacion: p.created_at || p.fechaCreacion || p.createdAt || p.fecha_creacion,
            tipoDocumento: p.tipo_documento || p.tipoDocumento || p.tipoIdentificacion || "Cédula de ciudadanía",
            documento: p.documento || p.nroDocumento || p.identificacion || "",
            numeroHistoria: p.nro_historia || p.nroHistoria || p.numeroHistoria || p.documento || p.nroDocumento || p.identificacion || "",
            nombre: p.nombres || p.nombre || "",
            apellido: p.apellidos || p.apellido || "",
            genero: p.genero || p.sexo || "Femenino",
            rh: p.rh || p.grupo_sanguineo || "—",
            estadoCivil: p.estado_civil || p.estadoCivil || "1",
            fechaNacimiento: fn,
            edad: calculatedAge,
            paisNacimiento: p.pais_nacimiento || p.paisNacimiento || "Colombia",
            ciudadNacimiento: p.ciudad_nacimiento || p.ciudadNacimiento || "",
            direccion: p.lugar_residencia || p.lugarResidencia || p.direccion || "",
            paisDomicilio: p.pais_domicilio || p.paisDomicilio || "Colombia",
            ciudadDomicilio: p.ciudad_domicilio || p.ciudadDomicilio || p.ciudad || "",
            lugarExpedicion: p.lugar_expedicion || p.lugarExpedicion || "",
            barrio: p.barrio || "",
            estrato: p.estrato || "1",
            zonaResidencial: p.zona_residencial || p.zonaResidencial || p.zona || "1",
            celular: p.telefono || p.celular || "",
            telefono: p.telefono_domicilio || p.telDomicilio || p.telefono || "",
            telefonoOficina: p.telefono_oficina || p.telOficina || "",
            extensionOficina: p.extension || p.extensionOficina || "",
            correo: p.email || p.correo || "",
            ocupacion: p.ocupacion || "",
            nombreResponsable: p.nombre_responsable || p.nombreResponsable || "",
            relacionResponsable: p.parentesco || p.relacionResponsable || "",
            celularResponsable: p.celular_responsable || p.celularResponsable || "",
            telefonoResponsable: p.telefono_responsable || p.telefonoResponsable || "",
            correoResponsable: p.email_responsable || p.correoResponsable || "",
            nombreAcompanante: p.nombre_acompanante || p.nombreAcompanante || "",
            telefonoAcompanante: p.telefono_acompanante || p.telefonoAcompanante || "",
            convenio: p.plan_nombre || p.planNombre || p.convenio || "",
            tipoAfiliacion: p.tipo_afiliacion || p.tipoVinculacion || p.tipoAfiliacion || "",
            eps: p.eps || p.nombre_eps || p.nombreEps || "",
            polizaSalud: p.poliza_salud || p.polizaSalud || "",
            sgsss: p.sgsss || "",
            tipoPaciente: p.tipo_paciente || p.tipoPaciente || "",
            convenioBeneficio: p.convenio_beneficio || p.convenioBeneficio || "",
            convenioPago: p.convenio_pago || p.convenioPago || "",
            comoNosConocio: p.como_conocio || p.comoConocio || p.comoNosConocio || "",
            campana: p.campania || p.campana || "",
            remitidoPor: p.remitido_por_value || p.remitidoPorValue || p.remitidoPor || "",
            asesorComercial: p.asesor_comercial_value || p.asesorComercialValue || p.asesorComercial || "",
            presupuestos: presupuestosCount || (p.presupuestosCount ?? (p.presupuestos?.length || 0)),
            tratamientosIniciados: tratIniciadosCount || (p.tratamientosIniciadosCount ?? 0),
            tratamientosNoIniciados: tratNoIniciadosCount || (p.tratamientosNoIniciadosCount ?? 0),
            tratamientosFinalizados: tratFinalizadosCount || (p.tratamientosFinalizadosCount ?? 0),
            citas: patientCitas.length || (p.citasCount ?? 0),
            profesionales: doctorName,
            profesionalId: doctorId,
            proximaCita: proximaCitaVal
          };
        });

        const sortedPacientes = normalized.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
        setAllPacientes(sortedPacientes);
      } catch (error) {
        console.error("Error cargando reporte de pacientes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino]);

  // Formateadores de fecha auxiliares
  const formatDateTime = (dateVal) => {
    if (!dateVal) return "";
    if (dateVal?.toDate) return format(dateVal.toDate(), "dd/MM/yyyy HH:mm");
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? String(dateVal) : format(d, "dd/MM/yyyy HH:mm");
  };

  const formatDateOnly = (dateVal) => {
    if (!dateVal) return "";
    if (dateVal?.toDate) return format(dateVal.toDate(), "dd/MM/yyyy");
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? String(dateVal) : format(d, "dd/MM/yyyy");
  };

  // Filtrado principal y de columnas
  const filteredData = useMemo(() => {
    return allPacientes.filter((p) => {
      // 1. Filtro superior: Año/Mes
      const rawYm = (appliedFilters.yearMonth || "").trim();
      const ymInput = rawYm.replace(/\D/g, ""); // normalizar números (ej. 202608)
      if (ymInput.length >= 4) {
        const targetDateRaw = appliedFilters.fechaTipo === "creacion" 
          ? (p.fechaCreacion || p.raw?.created_at || p.raw?.createdAt)
          : (p.fechaIngreso || p.raw?.fecha_ingreso || p.raw?.fechaIngreso || p.fechaCreacion || p.raw?.created_at);

        if (targetDateRaw) {
          const d = targetDateRaw?.toDate ? targetDateRaw.toDate() : new Date(targetDateRaw);
          if (!isNaN(d.getTime())) {
            const formattedYM = format(d, "yyyyMM");
            if (!formattedYM.startsWith(ymInput)) return false;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }

      // 2. Filtro superior: Profesional
      if (appliedFilters.profesional && appliedFilters.profesional !== "TODOS") {
        const targetProf = appliedFilters.profesional.toLowerCase().trim();
        const profObj = profesionales.find(
          (pr) => pr.nombre === appliedFilters.profesional || pr.id === appliedFilters.profesional
        );
        
        // Colectar todos los campos del paciente donde pueda estar el doctor
        const candidateDoctorStrings = [
          p.profesionales,
          p.profesionalId,
          p.raw?.profesional_id,
          p.raw?.profesionalId,
          p.raw?.profesional_nombre,
          p.raw?.profesionalNombre,
          p.raw?.profesionalAsignado,
          p.raw?.profesional,
          p.raw?.odontologo,
          p.raw?.doctor,
          p.raw?.medicoTratante
        ].map(v => String(v || "").toLowerCase().trim()).filter(Boolean);

        let matchesDoctor = false;
        if (profObj && profObj.allNames) {
          matchesDoctor = candidateDoctorStrings.some(pDocVal =>
            profObj.allNames.some(nameVariant => 
              pDocVal === nameVariant || pDocVal.includes(nameVariant) || nameVariant.includes(pDocVal)
            )
          );
        } else {
          matchesDoctor = candidateDoctorStrings.some(pDocVal => 
            pDocVal === targetProf || pDocVal.includes(targetProf) || targetProf.includes(pDocVal)
          );
        }

        if (!matchesDoctor) return false;
      }

      // 3. Búsqueda rápida global de tabla
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const matchesGlobal =
          p.nombre.toLowerCase().includes(term) ||
          p.apellido.toLowerCase().includes(term) ||
          p.documento.toLowerCase().includes(term) ||
          p.numeroHistoria.toLowerCase().includes(term) ||
          p.correo.toLowerCase().includes(term) ||
          p.celular.toLowerCase().includes(term) ||
          p.ciudadDomicilio.toLowerCase().includes(term) ||
          p.barrio.toLowerCase().includes(term);
        if (!matchesGlobal) return false;
      }

      // 4. Filtros individuales por columna
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal || filterVal.trim() === "") continue;
        const search = filterVal.toLowerCase().trim();

        let cellValue = "";
        if (colKey === "fechaIngreso") cellValue = formatDateTime(p.fechaIngreso);
        else if (colKey === "fechaCreacion") cellValue = formatDateTime(p.fechaCreacion);
        else if (colKey === "fechaNacimiento") cellValue = formatDateOnly(p.fechaNacimiento);
        else if (colKey === "proximaCita") cellValue = `${formatDateOnly(p.proximaCita)} ${formatDateTime(p.proximaCita)} ${p.proximaCita || ""}`;
        else cellValue = String(p[colKey] || "");

        if (!cellValue.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [allPacientes, appliedFilters, tableSearchTerm, columnFilters, profesionales]);

  // Manejar clic en "Buscar"
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      yearMonth: selectedYearMonth,
      profesional: selectedProfesional,
      fechaTipo: filtroFechaTipo
    });
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  };

  // Manejar cambio de filtro individual por columna
  const handleColumnFilterChange = (colKey, val) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colKey]: val
    }));
  };

  // Exportar reporte a Excel (respeta estrictamente las columnas visibles en el selector)
  const handleExportExcel = () => {
    const rows = filteredData.map((p) => {
      const rowObj = {};
      if (visibleColumns.fechaIngreso) rowObj["Fecha hora ingreso"] = formatDateTime(p.fechaIngreso);
      if (visibleColumns.fechaCreacion) rowObj["Fecha hora creación"] = formatDateTime(p.fechaCreacion);
      if (visibleColumns.tipoDocumento) rowObj["Tipo de documento"] = p.tipoDocumento || "";
      if (visibleColumns.documento) rowObj["Documento"] = p.documento || "";
      if (visibleColumns.numeroHistoria) rowObj["Número Historia"] = p.numeroHistoria || "";
      if (visibleColumns.nombre) rowObj["Nombre"] = p.nombre || "";
      if (visibleColumns.apellido) rowObj["Apellido"] = p.apellido || "";
      if (visibleColumns.genero) rowObj["Genero"] = p.genero || "";
      if (visibleColumns.rh) rowObj["RH"] = p.rh || "";
      if (visibleColumns.estadoCivil) rowObj["Estado civil"] = p.estadoCivil || "";
      if (visibleColumns.fechaNacimiento) rowObj["Fecha de nacimiento"] = formatDateOnly(p.fechaNacimiento);
      if (visibleColumns.edad) rowObj["Edad"] = p.edad || "";
      if (visibleColumns.paisNacimiento) rowObj["País de nacimiento"] = p.paisNacimiento || "";
      if (visibleColumns.ciudadNacimiento) rowObj["Ciudad de nacimiento"] = p.ciudadNacimiento || "";
      if (visibleColumns.direccion) rowObj["Dirección"] = p.direccion || "";
      if (visibleColumns.paisDomicilio) rowObj["País de domicilio"] = p.paisDomicilio || "";
      if (visibleColumns.ciudadDomicilio) rowObj["Ciudad de domicilio"] = p.ciudadDomicilio || "";
      if (visibleColumns.lugarExpedicion) rowObj["Lugar de expedición del documento"] = p.lugarExpedicion || "";
      if (visibleColumns.barrio) rowObj["Barrio"] = p.barrio || "";
      if (visibleColumns.estrato) rowObj["Estrato"] = p.estrato || "";
      if (visibleColumns.zonaResidencial) rowObj["Zona residencial"] = p.zonaResidencial || "";
      if (visibleColumns.celular) rowObj["Celular"] = p.celular || "";
      if (visibleColumns.telefono) rowObj["Teléfono"] = p.telefono || "";
      if (visibleColumns.telefonoOficina) rowObj["Teléfono oficina"] = p.telefonoOficina || "";
      if (visibleColumns.extensionOficina) rowObj["Extensión oficina"] = p.extensionOficina || "";
      if (visibleColumns.correo) rowObj["Correo"] = p.correo || "";
      if (visibleColumns.ocupacion) rowObj["Ocupación"] = p.ocupacion || "";
      if (visibleColumns.nombreResponsable) rowObj["Nombre del responsable"] = p.nombreResponsable || "";
      if (visibleColumns.relacionResponsable) rowObj["Relación con responsable"] = p.relacionResponsable || "";
      if (visibleColumns.celularResponsable) rowObj["Celular responsable"] = p.celularResponsable || "";
      if (visibleColumns.telefonoResponsable) rowObj["Teléfono responsable"] = p.telefonoResponsable || "";
      if (visibleColumns.correoResponsable) rowObj["Correo responsable"] = p.correoResponsable || "";
      if (visibleColumns.nombreAcompanante) rowObj["Nombre acompañante"] = p.nombreAcompanante || "";
      if (visibleColumns.telefonoAcompanante) rowObj["Teléfono acompañante"] = p.telefonoAcompanante || "";
      if (visibleColumns.convenio) rowObj["Convenio"] = p.convenio || "";
      if (visibleColumns.tipoAfiliacion) rowObj["Tipo de afiliación"] = p.tipoAfiliacion || "";
      if (visibleColumns.eps) rowObj["Eps"] = p.eps || "";
      if (visibleColumns.polizaSalud) rowObj["Poliza de salud"] = p.polizaSalud || "";
      if (visibleColumns.sgsss) rowObj["Sgsss"] = p.sgsss || "";
      if (visibleColumns.tipoPaciente) rowObj["Tipo de paciente"] = p.tipoPaciente || "";
      if (visibleColumns.convenioBeneficio) rowObj["Convenio beneficio"] = p.convenioBeneficio || "";
      if (visibleColumns.convenioPago) rowObj["Convenio de pago"] = p.convenioPago || "";
      if (visibleColumns.comoNosConocio) rowObj["Cómo nos conoció"] = p.comoNosConocio || "";
      if (visibleColumns.campana) rowObj["Campaña"] = p.campana || "";
      if (visibleColumns.remitidoPor) rowObj["Remitido por"] = p.remitidoPor || "";
      if (visibleColumns.asesorComercial) rowObj["Asesor comercial"] = p.asesorComercial || "";
      if (visibleColumns.presupuestos) rowObj["Presupuestos"] = p.presupuestos || 0;
      if (visibleColumns.tratamientosIniciados) rowObj["Tratamientos iniciados"] = p.tratamientosIniciados || 0;
      if (visibleColumns.tratamientosNoIniciados) rowObj["Tratamientos no iniciados"] = p.tratamientosNoIniciados || 0;
      if (visibleColumns.tratamientosFinalizados) rowObj["Tratamientos finalizados"] = p.tratamientosFinalizados || 0;
      if (visibleColumns.citas) rowObj["Citas"] = p.citas || 0;
      if (visibleColumns.profesionales) rowObj["Profesionales"] = p.profesionales || "";
      if (visibleColumns.proximaCita) rowObj["Próxima Cita"] = formatDateOnly(p.proximaCita);
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Pacientes");
    
    const fileNameSuffix = (appliedFilters.yearMonth || "Completo").replace(/[/\\?%*:|"<>]/g, "-");
    XLSX.writeFile(workbook, `Reporte_Pacientes_${fileNameSuffix}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f4f7fb] font-sans text-slate-700 pb-12">
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-slate-800 tracking-tight">Reporte pacientes</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>-</span>
            <span className="text-slate-500">Reporte pacientes</span>
          </div>
        </div>

        {/* Botón Generar reporte en Excel (Azul Vibrante OralDrive) */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-5 py-2 bg-[#009beb] hover:bg-[#0087cd] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl shadow-sm transition-all cursor-pointer"
        >
          <FiDownload size={14} />
          <span>Generar reporte en excel</span>
        </button>
      </div>

      {/* ─── CONTENEDOR DE FILTROS SUPERIOR (1:1 CON ORALDRIVE) ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          {/* Año/Mes con selector de calendario real */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Año/Mes</label>
            <div className="relative flex items-center">
              <input
                type="month"
                ref={monthPickerRef}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedYearMonth(e.target.value.replace("-", "/"));
                  }
                }}
              />
              <input
                type="text"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                placeholder="2026/08"
                className="w-36 h-8 pl-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium cursor-pointer"
                onClick={() => {
                  try {
                    monthPickerRef.current?.showPicker?.();
                  } catch (err) {
                    monthPickerRef.current?.focus?.();
                  }
                }}
              />
              <button
                type="button"
                title="Abrir calendario"
                onClick={() => {
                  try {
                    monthPickerRef.current?.showPicker?.();
                  } catch (err) {
                    monthPickerRef.current?.focus?.();
                  }
                }}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer rounded hover:bg-slate-100 transition-colors"
              >
                📅
              </button>
            </div>
          </div>

          {/* Profesional */}
          <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-[420px]">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
            >
              <option value="TODOS">Seleccione...</option>
              {profesionales.map((prof) => (
                <option key={prof.id} value={prof.nombre}>
                  {prof.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Buscar (Verde Oliva OralDrive) */}
          <div>
            <button
              onClick={handleSearchClick}
              className="h-8 px-7 bg-[#8bc34a] hover:bg-[#7cb342] active:scale-[0.98] text-white font-bold text-xs rounded shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              <span>Buscar</span>
            </button>
          </div>
        </div>

        {/* Radio Opciones: Mostrar (Fecha de creación / Fecha de ingreso) */}
        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <span className="text-slate-500 font-medium min-w-[60px]">Mostrar</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="filtroFechaTipo"
              checked={filtroFechaTipo === "creacion"}
              onChange={() => setFiltroFechaTipo("creacion")}
              className="text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Filtro por fecha de creación</span>
            <span
              className="text-slate-400 text-[11px] cursor-help"
              title="Filtra por la fecha en la que se registró el paciente en el sistema"
            >
              ⓘ
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none ml-2">
            <input
              type="radio"
              name="filtroFechaTipo"
              checked={filtroFechaTipo === "ingreso"}
              onChange={() => setFiltroFechaTipo("ingreso")}
              className="text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Filtro por fecha de ingreso</span>
            <span
              className="text-slate-400 text-[11px] cursor-help"
              title="Filtra por la fecha de ingreso clínica del paciente"
            >
              ⓘ
            </span>
          </label>
        </div>
      </div>

      {/* ─── TABLA DE RESULTADOS CON TODAS LAS COLUMNAS Y FILTROS POR COLUMNA ─── */}
      {hasSearched && (
        <div className="mx-6 my-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[480px] overflow-hidden">
          {/* Barra superior de la tabla con tags de agrupación OralDrive */}
          <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={expandAllGroups}
                  onChange={(e) => setExpandAllGroups(e.target.checked)}
                  className="rounded text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
                />
                <span>Expandir todos los grupos</span>
              </label>

              {/* Tags de agrupación OralDrive */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-200">
                  Fecha ingreso <span className="text-[10px] text-slate-400">↑</span>
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-200">
                  Profesional <span className="text-[10px] text-slate-400">↑</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 relative">
              {/* Botón Guardar / Exportar rápido */}
              <button
                onClick={handleExportExcel}
                title="Exportar a Excel"
                className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <FiDownload size={15} />
              </button>

              {/* Botón Selector de Columnas */}
              <div className="relative">
                <button
                  title="Selector de columnas"
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    showColumnSelector ? "bg-sky-100 text-sky-700" : "hover:bg-slate-100 text-slate-500"
                  }`}
                >
                  <FiFileText size={15} />
                </button>

                {/* Popover de Selección de Columnas */}
                {showColumnSelector && (
                  <div className="absolute right-0 top-9 z-40 w-72 bg-white border border-slate-300 rounded-xl shadow-2xl p-3">
                    <div className="text-xs font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                      <span>Columnas del reporte</span>
                      <button
                        onClick={() => setShowColumnSelector(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#009beb] mb-2 px-1">
                      <button
                        onClick={() => toggleAllColumns(true)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FiCheck size={12} /> Seleccionar todas
                      </button>
                      <button
                        onClick={() => toggleAllColumns(false)}
                        className="hover:underline text-slate-500 hover:text-red-500 flex items-center gap-1 cursor-pointer"
                      >
                        <FiX size={12} /> Deseleccionar todas
                      </button>
                    </div>

                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                      {Object.keys(columnLabels).map((key) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 text-xs text-slate-600 hover:bg-slate-50 p-1 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={!!visibleColumns[key]}
                            onChange={() => toggleColumn(key)}
                            className="rounded text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="truncate">{columnLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Filtros */}
              <button
                title="Limpiar filtros de columna"
                onClick={() => setColumnFilters({})}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <FiFilter size={15} />
              </button>

              {/* Campo Buscar rápido */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-300 rounded text-xs outline-none focus:border-sky-500 transition-all font-normal"
                />
              </div>
            </div>
          </div>

          {/* Contenedor con Scroll Horizontal y Vertical de la Tabla */}
          <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[620px] min-h-[360px] custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <div className="w-7 h-7 border-2 border-[#009beb] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-semibold">Cargando reporte de pacientes...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                <thead className="bg-[#fcfdfe] sticky top-0 z-20 border-b border-slate-300 text-slate-600 font-bold shadow-xs">
                  {/* Fila 1: Títulos de Columnas */}
                  <tr>
                    {Object.keys(columnLabels).map((key) => {
                      if (!visibleColumns[key]) return null;
                      return (
                        <th
                          key={key}
                          className="px-3.5 py-2 border-r border-slate-200 text-slate-700 text-xs font-bold select-none bg-slate-50"
                        >
                          {columnLabels[key]}
                        </th>
                      );
                    })}
                  </tr>

                  {/* Fila 2: Inputs de Búsqueda y Filtro por Columna */}
                  <tr className="bg-white border-b border-slate-200">
                    {Object.keys(columnLabels).map((key) => {
                      if (!visibleColumns[key]) return null;
                      const isDate = key === "fechaIngreso" || key === "fechaCreacion" || key === "fechaNacimiento" || key === "proximaCita";
                      return (
                        <th key={`filter-${key}`} className="px-2 py-1 border-r border-slate-200 font-normal">
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-slate-400 text-[10px] pointer-events-none">
                              {isDate ? "📅" : "🔍"}
                            </span>
                            <input
                              type="text"
                              value={columnFilters[key] || ""}
                              onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                              placeholder=""
                              className="w-full h-5 pl-5 pr-1 text-[10px] border border-slate-200 rounded outline-none focus:border-sky-500 text-slate-700 bg-white"
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {filteredData.map((p) => (
                    <tr key={p.id} className="hover:bg-sky-50/50 transition-colors">
                      {visibleColumns.fechaIngreso && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {formatDateTime(p.fechaIngreso)}
                        </td>
                      )}
                      {visibleColumns.fechaCreacion && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {formatDateTime(p.fechaCreacion)}
                        </td>
                      )}
                      {visibleColumns.tipoDocumento && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.tipoDocumento}</td>
                      )}
                      {visibleColumns.documento && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-[#009beb] font-semibold hover:underline cursor-pointer">
                          {p.documento || "—"}
                        </td>
                      )}
                      {visibleColumns.numeroHistoria && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-[#009beb] font-semibold hover:underline cursor-pointer">
                          {p.numeroHistoria || "—"}
                        </td>
                      )}
                      {visibleColumns.nombre && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-medium uppercase text-slate-800">
                          {p.nombre || "—"}
                        </td>
                      )}
                      {visibleColumns.apellido && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-medium uppercase text-slate-800">
                          {p.apellido || "—"}
                        </td>
                      )}
                      {visibleColumns.genero && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.genero}</td>
                      )}
                      {visibleColumns.rh && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-medium">{p.rh}</td>
                      )}
                      {visibleColumns.estadoCivil && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.estadoCivil}</td>
                      )}
                      {visibleColumns.fechaNacimiento && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{formatDateOnly(p.fechaNacimiento)}</td>
                      )}
                      {visibleColumns.edad && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.edad}</td>
                      )}
                      {visibleColumns.paisNacimiento && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.paisNacimiento}</td>
                      )}
                      {visibleColumns.ciudadNacimiento && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.ciudadNacimiento}</td>
                      )}
                      {visibleColumns.direccion && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.direccion}</td>
                      )}
                      {visibleColumns.paisDomicilio && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.paisDomicilio}</td>
                      )}
                      {visibleColumns.ciudadDomicilio && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.ciudadDomicilio}</td>
                      )}
                      {visibleColumns.lugarExpedicion && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.lugarExpedicion}</td>
                      )}
                      {visibleColumns.barrio && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.barrio}</td>
                      )}
                      {visibleColumns.estrato && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.estrato}</td>
                      )}
                      {visibleColumns.zonaResidencial && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.zonaResidencial}</td>
                      )}
                      {visibleColumns.celular && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.celular}</td>
                      )}
                      {visibleColumns.telefono && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.telefono}</td>
                      )}
                      {visibleColumns.telefonoOficina && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.telefonoOficina}</td>
                      )}
                      {visibleColumns.extensionOficina && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.extensionOficina}</td>
                      )}
                      {visibleColumns.correo && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-[#009beb] lowercase">{p.correo}</td>
                      )}
                      {visibleColumns.ocupacion && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.ocupacion}</td>
                      )}
                      {visibleColumns.nombreResponsable && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.nombreResponsable}</td>
                      )}
                      {visibleColumns.relacionResponsable && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.relacionResponsable}</td>
                      )}
                      {visibleColumns.celularResponsable && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.celularResponsable}</td>
                      )}
                      {visibleColumns.telefonoResponsable && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.telefonoResponsable}</td>
                      )}
                      {visibleColumns.correoResponsable && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.correoResponsable}</td>
                      )}
                      {visibleColumns.nombreAcompanante && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.nombreAcompanante}</td>
                      )}
                      {visibleColumns.telefonoAcompanante && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.telefonoAcompanante}</td>
                      )}
                      {visibleColumns.convenio && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.convenio}</td>
                      )}
                      {visibleColumns.tipoAfiliacion && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.tipoAfiliacion}</td>
                      )}
                      {visibleColumns.eps && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.eps}</td>
                      )}
                      {visibleColumns.polizaSalud && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.polizaSalud}</td>
                      )}
                      {visibleColumns.sgsss && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.sgsss}</td>
                      )}
                      {visibleColumns.tipoPaciente && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.tipoPaciente}</td>
                      )}
                      {visibleColumns.convenioBeneficio && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.convenioBeneficio}</td>
                      )}
                      {visibleColumns.convenioPago && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.convenioPago}</td>
                      )}
                      {visibleColumns.comoNosConocio && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.comoNosConocio}</td>
                      )}
                      {visibleColumns.campana && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.campana}</td>
                      )}
                      {visibleColumns.remitidoPor && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.remitidoPor}</td>
                      )}
                      {visibleColumns.asesorComercial && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.asesorComercial}</td>
                      )}
                      {visibleColumns.presupuestos && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.presupuestos}</td>
                      )}
                      {visibleColumns.tratamientosIniciados && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.tratamientosIniciados}</td>
                      )}
                      {visibleColumns.tratamientosNoIniciados && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.tratamientosNoIniciados}</td>
                      )}
                      {visibleColumns.tratamientosFinalizados && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.tratamientosFinalizados}</td>
                      )}
                      {visibleColumns.citas && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">{p.citas}</td>
                      )}
                      {visibleColumns.profesionales && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{p.profesionales}</td>
                      )}
                      {visibleColumns.proximaCita && (
                        <td className="px-3.5 py-2 border-r border-slate-100">{formatDateOnly(p.proximaCita)}</td>
                      )}
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td
                        colSpan={Object.values(visibleColumns).filter(Boolean).length || 1}
                        className="px-6 py-12 text-center text-slate-400 font-medium text-xs"
                      >
                        No se encontraron registros de pacientes para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla con totalizador */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>
              Total de registros: <strong>{filteredData.length}</strong> de <strong>{allPacientes.length}</strong> pacientes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
