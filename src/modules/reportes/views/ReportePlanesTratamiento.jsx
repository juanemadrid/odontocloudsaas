import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function ReportePlanesTratamiento() {
  const { userProfile } = useAuth();
  const [allItemRows, setAllItemRows] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros del formulario superior (1:1 con OralDrive)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [selectedProfesional, setSelectedProfesional] = useState("");
  const [selectedPacienteTerm, setSelectedPacienteTerm] = useState("");
  const [selectedPacienteId, setSelectedPacienteId] = useState("");
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);
  const [tipoPlan, setTipoPlan] = useState("TODOS"); // "TODOS" | "Plan de tratamiento" | "Presupuesto"
  const [filtroFechaTipo, setFiltroFechaTipo] = useState("creacion"); // "creacion" | "realizado"
  const [pendientesFacturar, setPendientesFacturar] = useState(false);

  // Agrupamiento y expansión
  const [expandAllGroups, setExpandAllGroups] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const pacienteDropdownRef = useRef(null);

  // Estado de búsqueda: inicia en false hasta que el usuario hace clic en "Buscar"
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros aplicados al presionar "Buscar"
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    profesional: "",
    pacienteId: "",
    pacienteTerm: "",
    tipoPlan: "TODOS",
    fechaTipo: "creacion",
    pendientesFacturar: false
  });

  // Búsqueda rápida global en tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  // Filtros individuales por columna
  const [columnFilters, setColumnFilters] = useState({});

  // Control selector de columnas
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // 25 Columnas completas 1:1 con OralDrive
  const [visibleColumns, setVisibleColumns] = useState({
    historia: true,
    prestacion: true,
    codigoCups: true,
    realizada: true,
    pagada: true,
    facturada: true,
    valorPagado: true,
    valorPrestacion: true,
    valorLiquidado: true,
    profesional: true,
    emailPaciente: true,
    fechaCreacionPrestacion: true,
    fechaRealizado: true,
    estado: true,
    valorPlanTratamiento: true,
    egresos: true,
    proximaCita: true,
    orden: true,
    tarifa: true,
    valorTarifa: true,
    entidad: true,
    finalizado: true,
    facturaEntidad: true,
    compensadoNC: true,
    categoria: true
  });

  const columnLabels = {
    historia: "Historia",
    prestacion: "Prestación",
    codigoCups: "Código CUPS",
    realizada: "Realizada",
    pagada: "Pagada",
    facturada: "Facturada",
    valorPagado: "Valor pagado",
    valorPrestacion: "Valor prestación",
    valorLiquidado: "Valor liquidado",
    profesional: "Profesional",
    emailPaciente: "Email paciente",
    fechaCreacionPrestacion: "Fecha creación prestación",
    fechaRealizado: "Fecha realizado",
    estado: "Estado",
    valorPlanTratamiento: "Valor plan de tratamiento",
    egresos: "Egresos",
    proximaCita: "Próxima cita",
    orden: "Orden",
    tarifa: "Tarifa",
    valorTarifa: "Valor tarifa",
    entidad: "Entidad",
    finalizado: "Finalizado",
    facturaEntidad: "Factura a entidad",
    compensadoNC: "Compensado NC",
    categoria: "Categoría"
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllColumns = (val) => {
    const updated = {};
    Object.keys(visibleColumns).forEach((k) => {
      updated[k] = val;
    });
    setVisibleColumns(updated);
  };

  // Cerrar dropdown de paciente al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pacienteDropdownRef.current && !pacienteDropdownRef.current.contains(event.target)) {
        setShowPacienteDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar datos reales desde Supabase
  useEffect(() => {
    const fetchData = async () => {
      const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
      if (!tenantId) return;
      setLoading(true);
      try {
        // 1. Cargar Pacientes reales
        let snapPacientes = [];
        try {
          const { data, error } = await supabase
            .from("pacientes")
            .select("*")
            .eq("tenant_id", tenantId);
          if (!error && data) snapPacientes = data;
        } catch (e) {
          console.warn("Error cargando pacientes:", e);
        }

        const pacDict = {};
        const listPacs = (snapPacientes || []).map(p => {
          const nombreCompleto = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || p.documento || p.nroDocumento || 'Paciente sin nombre';
          const pacObj = {
            id: p.id,
            nombre: nombreCompleto,
            documento: p.documento || p.nroDocumento || p.identificacion || '',
            telefono: p.telefono || p.celular || '',
            email: p.email || p.correo || '',
            eps: p.eps || p.nombreEps || p.convenio || ''
          };
          pacDict[p.id] = pacObj;
          if (p.documento) pacDict[p.documento] = pacObj;
          if (p.nroDocumento) pacDict[p.nroDocumento] = pacObj;
          return pacObj;
        });
        setPacientesList(listPacs);

        // 2. Cargar Doctores reales
        let snapUsuarios = [];
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", tenantId);
          if (data) snapUsuarios = data;
        } catch (e) {}

        const listProfs = [];
        (snapUsuarios || []).forEach(u => {
          if (isDoctorUser(u)) {
            const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
            const primerApellido = u.apellido || u.apellidos || "";
            const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
            listProfs.push({
              id: u.id,
              nombre: nombreCompleto,
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

        // 3. Cargar Pagos reales
        let pagosMap = {};
        try {
          const { data: snapPagos } = await supabase
            .from("pagos")
            .select("id, paciente_id, monto, valor, plan_id, estado, created_at")
            .eq("tenant_id", tenantId);
          
          (snapPagos || []).forEach(pago => {
            const isVoided = (pago.estado || "").toLowerCase() === "anulado";
            if (!isVoided) {
              const val = Number(pago.monto || pago.valor || 0);
              if (pago.plan_id) {
                pagosMap[pago.plan_id] = (pagosMap[pago.plan_id] || 0) + val;
              }
            }
          });
        } catch (e) {}

        // 4. Cargar Treatment Plans y desglosar por prestación (items)
        let snapPlanes = [];
        try {
          const { data, error } = await supabase
            .from("treatment_plans")
            .select("*")
            .eq("tenant_id", tenantId);
          if (!error && data) snapPlanes = data;
        } catch (e) {
          console.warn("Error cargando treatment_plans:", e);
        }

        const flattenedRows = [];

        (snapPlanes || []).forEach(p => {
          const d = p.detalles || {};
          const items = Array.isArray(d) ? d : (d.items && Array.isArray(d.items) ? d.items : []);
          
          const pacId = p.paciente_id || p.pacienteId || p.patientId || p.patient_id || p.paciente || d.paciente_id || d.pacienteId || d.patientId;
          const pac = pacDict[pacId] || (p.documento ? pacDict[p.documento] : {}) || {};
          const pacName = pac.nombre || d.pacienteNombre || d.patientName || p.paciente_nombre || p.pacienteNombre || p.nombrePaciente || p.paciente || "Paciente";
          const pacDoc = pac.documento || d.pacienteDocumento || d.patientDocument || p.pacienteDocumento || p.documento || "";
          const pacEmail = pac.email || d.pacienteEmail || d.email || p.email || "";
          
          const planTotal = Number(p.total || d.total || d.costoTotal || 0);
          const rawType = String(d.type || p.type || p.tipo || p.estado || "").toLowerCase();
          const isPlanTratamiento = rawType.includes("plan") || rawType === "approved" || rawType === "finalizado";
          const planTitle = p.nombre || d.nombre || d.title || (isPlanTratamiento ? "Plan de Tratamiento" : "Presupuesto");

          const docName = d.profesional || d.profesionalNombre || p.profesional || p.profesional_nombre || p.doctor || p.odontologo || "";
          const docId = d.profesionalId || p.profesional_id || p.doctor_id || "";

          const planPaid = pagosMap[p.id] || Number(p.pagado || d.pagado || 0);
          const planBalance = Math.max(0, planTotal - planPaid);

          if (items.length > 0) {
            items.forEach((it, idx) => {
              const itemPrice = Number(it.precio || it.valor || it.valorPrestacion || it.costo || 0);
              const itemPaid = Number(it.pagado || it.valorPagado || (it.pagada ? itemPrice : 0));
              const itemLiquidated = Number(it.liquidado || it.valorLiquidado || 0);
              const isDone = it.realizada === true || it.realizado === true || it.estado === 'completado' || it.estado === 'realizado';
              const isPaid = it.pagada === true || itemPaid >= itemPrice || planBalance <= 0;
              const isBilled = it.facturada === true || it.facturado === true;

              flattenedRows.push({
                id: `${p.id}_${idx}`,
                planId: p.id,
                planTitle: planTitle,
                planType: isPlanTratamiento ? "plan" : "presupuesto",
                planTypeLabel: isPlanTratamiento ? "Plan de tratamiento" : "Presupuesto",
                planDate: p.created_at || d.date || p.date,
                patientId: pacId || p.paciente_id,
                historia: pacDoc || pacId || "",
                pacienteNombre: pacName,
                emailPaciente: pacEmail,
                prestacion: it.nombre || it.descripcion || it.procedimiento || it.prestacion || "Procedimiento Odontológico",
                codigoCups: it.codigo || it.cups || it.codigo_cups || "—",
                realizada: isDone ? "Sí" : "No",
                pagada: isPaid ? "Sí" : "No",
                facturada: isBilled ? "Sí" : "No",
                valorPagado: itemPaid,
                valorPrestacion: itemPrice,
                valorLiquidado: itemLiquidated,
                profesional: it.profesional || docName || "—",
                profesionalId: it.profesionalId || docId || "",
                fechaCreacionPrestacion: it.fechaCreacion || it.fecha || p.created_at,
                fechaRealizado: it.fechaRealizado || it.fecha_realizado || (isDone ? p.created_at : ""),
                estado: p.estado || d.estado || (isPlanTratamiento ? "Aprobado" : "Borrador"),
                valorPlanTratamiento: planTotal,
                saldoPlan: planBalance,
                egresos: Number(it.egresos || d.egresos || 0),
                proximaCita: it.proximaCita || "",
                orden: it.orden || idx + 1,
                tarifa: it.tarifa || d.tarifa || "Particular",
                valorTarifa: Number(it.valorTarifa || itemPrice),
                entidad: it.entidad || pac.eps || "—",
                finalizado: p.estado === 'Finalizado' || p.estado === 'approved' ? "Sí" : "No",
                facturaEntidad: it.facturaEntidad || "—",
                compensadoNC: it.compensadoNC || "No",
                categoria: it.categoria || d.categoria || "Odontología General"
              });
            });
          } else {
            flattenedRows.push({
              id: `${p.id}_0`,
              planId: p.id,
              planTitle: planTitle,
              planType: isPlanTratamiento ? "plan" : "presupuesto",
              planTypeLabel: isPlanTratamiento ? "Plan de tratamiento" : "Presupuesto",
              planDate: p.created_at || d.date || p.date,
              patientId: pacId || p.paciente_id,
              historia: pacDoc || pacId || "",
              pacienteNombre: pacName,
              emailPaciente: pacEmail,
              prestacion: planTitle,
              codigoCups: "—",
              realizada: p.estado === 'Finalizado' ? "Sí" : "No",
              pagada: planBalance <= 0 ? "Sí" : "No",
              facturada: "No",
              valorPagado: planPaid,
              valorPrestacion: planTotal,
              valorLiquidado: 0,
              profesional: docName || "—",
              profesionalId: docId || "",
              fechaCreacionPrestacion: p.created_at,
              fechaRealizado: "",
              estado: p.estado || (isPlanTratamiento ? "Aprobado" : "Borrador"),
              valorPlanTratamiento: planTotal,
              saldoPlan: planBalance,
              egresos: 0,
              proximaCita: "",
              orden: 1,
              tarifa: "Particular",
              valorTarifa: planTotal,
              entidad: pac.eps || "—",
              finalizado: p.estado === 'Finalizado' ? "Sí" : "No",
              facturaEntidad: "—",
              compensadoNC: "No",
              categoria: "Odontología General"
            });
          }
        });

        flattenedRows.sort((a, b) => new Date(b.fechaCreacionPrestacion || 0) - new Date(a.fechaCreacionPrestacion || 0));
        setAllItemRows(flattenedRows);

      } catch (error) {
        console.error("Error cargando reporte de planes de tratamiento:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.inquilino, userProfile?.tenant_id]);

  // Formateadores de fecha
  const formatDateTime = (dateVal) => {
    if (!dateVal) return "";
    const dt = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return isNaN(dt.getTime()) ? String(dateVal) : format(dt, "dd/MM/yyyy HH:mm");
  };

  const formatDateShort = (dateVal) => {
    if (!dateVal) return "";
    const dt = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return isNaN(dt.getTime()) ? String(dateVal) : format(dt, "dd/MM/yyyy");
  };

  // Filtrado reactivo de filas
  const filteredRows = useMemo(() => {
    return allItemRows.filter(row => {
      // 1. Filtro Tipo de plan
      if (appliedFilters.tipoPlan && appliedFilters.tipoPlan !== "TODOS" && appliedFilters.tipoPlan !== "") {
        const targetType = appliedFilters.tipoPlan.toLowerCase();
        const rowType = (row.planType || "").toLowerCase();
        const rowLabel = (row.planTypeLabel || "").toLowerCase();
        const rowTitle = (row.planTitle || "").toLowerCase();

        if (targetType.includes("plan") && !targetType.includes("presupuesto")) {
          if (!rowType.includes("plan") && !rowLabel.includes("plan") && !rowTitle.includes("plan")) {
            return false;
          }
        } else if (targetType.includes("presupuesto")) {
          if (!rowType.includes("presupuesto") && !rowLabel.includes("presupuesto") && !rowTitle.includes("presupuesto")) {
            return false;
          }
        }
      }

      // 2. Filtro Fechas
      if (appliedFilters.fechaInicial && appliedFilters.fechaInicial.trim() !== "") {
        const rawDate = appliedFilters.fechaTipo === "creacion" 
          ? row.fechaCreacionPrestacion 
          : (row.fechaRealizado || row.fechaCreacionPrestacion);

        if (rawDate) {
          const targetDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
          if (!isNaN(targetDate.getTime())) {
            const init = new Date(appliedFilters.fechaInicial + "T00:00:00");
            const endStr = appliedFilters.fechaFinal || appliedFilters.fechaInicial;
            const end = new Date(endStr + "T23:59:59");
            if (targetDate < init || targetDate > end) return false;
          }
        }
      }

      // 3. Filtro Profesional
      if (appliedFilters.profesional && appliedFilters.profesional.trim() !== "" && appliedFilters.profesional !== "TODOS") {
        const targetProf = appliedFilters.profesional.toLowerCase().trim();
        const profObj = profesionales.find(pr => pr.nombre === appliedFilters.profesional || pr.id === appliedFilters.profesional);
        const pProf = String(row.profesional || "").toLowerCase().trim();
        const pProfId = String(row.profesionalId || "").toLowerCase().trim();

        let matchesDoc = false;
        if (profObj && profObj.allNames) {
          matchesDoc = profObj.allNames.some(nameVariant => 
            pProf.includes(nameVariant) || pProfId === nameVariant || nameVariant.includes(pProf)
          );
        } else {
          matchesDoc = pProf.includes(targetProf) || pProfId.includes(targetProf) || targetProf.includes(pProf);
        }
        if (!matchesDoc) return false;
      }

      // 4. Filtro Paciente
      const pacSearchTerm = (appliedFilters.pacienteTerm || "").trim().toLowerCase();
      if (pacSearchTerm !== "") {
        const pNom = (row.pacienteNombre || "").toLowerCase();
        const pDoc = String(row.historia || "").toLowerCase();
        const pEmail = String(row.emailPaciente || "").toLowerCase();
        const isExactId = appliedFilters.pacienteId && row.patientId === appliedFilters.pacienteId;

        // Búsqueda por subpalabras (ej: "JUAN" o "PEREZ")
        const terms = pacSearchTerm.split(" ").filter(Boolean);
        const matchesAllSubterms = terms.every(t => pNom.includes(t) || pDoc.includes(t));

        if (!matchesAllSubterms && !pDoc.includes(pacSearchTerm) && !pEmail.includes(pacSearchTerm) && !isExactId) {
          return false;
        }
      }

      // 5. Switch Pendientes por facturar (Saldo > 0)
      if (appliedFilters.pendientesFacturar) {
        if (Number(row.saldoPlan || 0) <= 0) return false;
      }

      // 6. Búsqueda rápida global en tabla
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase();
        const matchesSearch =
          (row.pacienteNombre || "").toLowerCase().includes(term) ||
          (row.historia || "").toLowerCase().includes(term) ||
          (row.prestacion || "").toLowerCase().includes(term) ||
          (row.codigoCups || "").toLowerCase().includes(term) ||
          (row.profesional || "").toLowerCase().includes(term) ||
          (row.planTitle || "").toLowerCase().includes(term) ||
          (row.estado || "").toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // 7. Filtros individuales por columna
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal || filterVal === "TODO" || filterVal.trim() === "") continue;
        const search = filterVal.toLowerCase().trim();

        let cellValue = "";
        if (colKey === "fechaCreacionPrestacion") cellValue = formatDateTime(row.fechaCreacionPrestacion);
        else if (colKey === "fechaRealizado") cellValue = formatDateShort(row.fechaRealizado);
        else cellValue = String(row[colKey] || "");

        if (!cellValue.toLowerCase().includes(search)) return false;
      }

      return true;
    });
  }, [allItemRows, appliedFilters, tableSearchTerm, columnFilters, profesionales]);

  // Agrupamiento por Plan de tratamiento y Paciente
  const groupedData = useMemo(() => {
    const groups = {};
    filteredRows.forEach(row => {
      const groupKey = `${row.planTitle} — ${row.pacienteNombre} (${row.historia || 'Sin ID'})`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          title: row.planTitle,
          patientName: row.pacienteNombre,
          patientDoc: row.historia,
          planType: row.planTypeLabel,
          planTotal: row.valorPlanTratamiento,
          items: []
        };
      }
      groups[groupKey].items.push(row);
    });
    return groups;
  }, [filteredRows]);

  const toggleGroupCollapse = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Manejar clic en "Buscar"
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      profesional: selectedProfesional,
      pacienteId: selectedPacienteId,
      pacienteTerm: selectedPacienteTerm,
      tipoPlan,
      fechaTipo: filtroFechaTipo,
      pendientesFacturar
    });
  };

  // Manejar cambio de filtro individual de columna
  const handleColumnFilterChange = (colKey, val) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: val
    }));
  };

  // Autocomplete: filtra si el usuario escribió algo (ignora mayúsculas y acentos)
  const autocompletePacientes = useMemo(() => {
    const raw = (selectedPacienteTerm || "").trim();
    if (!raw) return [];
    const term = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return pacientesList.filter(pac => {
      const pNom = (pac.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const pDoc = String(pac.documento || "").toLowerCase().trim();
      return pNom.includes(term) || pDoc.includes(term);
    });
  }, [pacientesList, selectedPacienteTerm]);

  // Exportar reporte a Excel (respeta estrictamente las columnas visibles en el selector)
  const handleExportExcel = () => {
    const rows = filteredRows.map(r => {
      const rowObj = {};
      if (visibleColumns.historia) rowObj["Historia"] = r.historia || "";
      if (visibleColumns.prestacion) rowObj["Prestación"] = r.prestacion || "";
      if (visibleColumns.codigoCups) rowObj["Código CUPS"] = r.codigoCups || "";
      if (visibleColumns.realizada) rowObj["Realizada"] = r.realizada || "No";
      if (visibleColumns.pagada) rowObj["Pagada"] = r.pagada || "No";
      if (visibleColumns.facturada) rowObj["Facturada"] = r.facturada || "No";
      if (visibleColumns.valorPagado) rowObj["Valor pagado"] = Number(r.valorPagado || 0);
      if (visibleColumns.valorPrestacion) rowObj["Valor prestación"] = Number(r.valorPrestacion || 0);
      if (visibleColumns.valorLiquidado) rowObj["Valor liquidado"] = Number(r.valorLiquidado || 0);
      if (visibleColumns.profesional) rowObj["Profesional"] = r.profesional || "";
      if (visibleColumns.emailPaciente) rowObj["Email paciente"] = r.emailPaciente || "";
      if (visibleColumns.fechaCreacionPrestacion) rowObj["Fecha creación prestación"] = formatDateTime(r.fechaCreacionPrestacion);
      if (visibleColumns.fechaRealizado) rowObj["Fecha realizado"] = formatDateShort(r.fechaRealizado);
      if (visibleColumns.estado) rowObj["Estado"] = r.estado || "";
      if (visibleColumns.valorPlanTratamiento) rowObj["Valor plan de tratamiento"] = Number(r.valorPlanTratamiento || 0);
      if (visibleColumns.egresos) rowObj["Egresos"] = Number(r.egresos || 0);
      if (visibleColumns.proximaCita) rowObj["Próxima cita"] = formatDateShort(r.proximaCita);
      if (visibleColumns.orden) rowObj["Orden"] = r.orden || 1;
      if (visibleColumns.tarifa) rowObj["Tarifa"] = r.tarifa || "";
      if (visibleColumns.valorTarifa) rowObj["Valor tarifa"] = Number(r.valorTarifa || 0);
      if (visibleColumns.entidad) rowObj["Entidad"] = r.entidad || "";
      if (visibleColumns.finalizado) rowObj["Finalizado"] = r.finalizado || "No";
      if (visibleColumns.facturaEntidad) rowObj["Factura a entidad"] = r.facturaEntidad || "";
      if (visibleColumns.compensadoNC) rowObj["Compensado NC"] = r.compensadoNC || "No";
      if (visibleColumns.categoria) rowObj["Categoría"] = r.categoria || "";
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planes de Tratamiento");
    
    const fileNameSuffix = `${appliedFilters.fechaInicial || 'Inicio'}_al_${appliedFilters.fechaFinal || 'Fin'}`;
    XLSX.writeFile(workbook, `Reporte_Planes_Tratamiento_${fileNameSuffix}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f4f7fb] font-sans text-slate-700 pb-12">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-slate-800 tracking-tight">Reporte planes de tratamiento</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500">Reporte planes de tratamiento</span>
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

      {/* ─── ÁREA DE FILTROS 1:1 CON ORALDRIVE ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
        
        {/* Fila 1: Fecha inicial / Fecha final */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicial</label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fechaInicial}
                onChange={(e) => setFechaInicial(e.target.value)}
                className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
                max="9999-12-31" min="1900-01-01"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha final</label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
                max="9999-12-31" min="1900-01-01"
              />
            </div>
          </div>
        </div>

        {/* Fila 2: Profesional / Paciente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Profesional</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
            >
              <option value="">Seleccione...</option>
              {profesionales.map(prof => (
                <option key={prof.id} value={prof.nombre}>{prof.nombre}</option>
              ))}
            </select>
          </div>

          {/* Paciente: NO muestra lista al hacer click vacio, solo al escribir */}
          <div className="relative" ref={pacienteDropdownRef}>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paciente</label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Buscar paciente por nombre o documento..."
                value={selectedPacienteTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPacienteTerm(val);
                  setSelectedPacienteId("");
                  setShowPacienteDropdown(val.trim().length > 0);
                }}
                className="w-full h-8 px-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium uppercase"
              />
              {selectedPacienteTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPacienteTerm("");
                    setSelectedPacienteId("");
                    setShowPacienteDropdown(false);
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                  title="Limpiar paciente"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown que aparece UNICAMENTE cuando el usuario escribe */}
            {showPacienteDropdown && selectedPacienteTerm.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-14 z-50 bg-white border border-slate-300 rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPacienteTerm("");
                    setSelectedPacienteId("");
                    setShowPacienteDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-[#009beb] hover:bg-sky-50 rounded-lg transition-colors border-b border-slate-100 uppercase cursor-pointer"
                >
                  -- TODOS LOS PACIENTES --
                </button>
                {autocompletePacientes.map(pac => (
                  <button
                    key={pac.id}
                    type="button"
                    onClick={() => {
                      setSelectedPacienteTerm(pac.nombre);
                      setSelectedPacienteId(pac.id);
                      setShowPacienteDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-[#009beb] rounded-lg transition-colors uppercase block cursor-pointer"
                  >
                    <div className="font-semibold text-slate-800">{pac.nombre}</div>
                    {pac.documento && (
                      <div className="text-[10px] text-slate-400">Doc: {pac.documento}</div>
                    )}
                  </button>
                ))}
                {autocompletePacientes.length === 0 && (
                  <div className="px-3 py-3 text-xs text-slate-400 font-medium text-center">
                    No se encontraron pacientes para "{selectedPacienteTerm}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fila 3: Tipo de plan + Botón Buscar */}
        <div className="flex flex-wrap md:flex-nowrap items-end justify-between gap-6 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de plan</label>
            <select
              value={tipoPlan}
              onChange={(e) => setTipoPlan(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="Plan de tratamiento">Plan de tratamiento</option>
              <option value="Presupuesto">Presupuesto</option>
            </select>
          </div>

          <div>
            <button
              onClick={handleSearchClick}
              className="h-8 px-8 bg-[#8bc34a] hover:bg-[#7cb342] active:scale-[0.98] text-white font-bold text-xs rounded shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              <span>Buscar</span>
            </button>
          </div>
        </div>

        {/* Fila 4: Radios Mostrar */}
        <div className="flex items-center gap-6 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <span className="text-slate-500 font-medium min-w-[60px]">Mostrar</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="filtroFechaTipoPlan"
              checked={filtroFechaTipo === "creacion"}
              onChange={() => setFiltroFechaTipo("creacion")}
              className="text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Filtro por fecha de creación</span>
            <span className="text-slate-400 text-[11px] cursor-help" title="Filtra por la fecha de creación del plan">ⓘ</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none ml-2">
            <input
              type="radio"
              name="filtroFechaTipoPlan"
              checked={filtroFechaTipo === "realizado"}
              onChange={() => setFiltroFechaTipo("realizado")}
              className="text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Filtro por fecha de realizado</span>
            <span className="text-slate-400 text-[11px] cursor-help" title="Filtra por la fecha en la que se realizaron los procedimientos">ⓘ</span>
          </label>
        </div>

        {/* Fila 5: Switch Pendientes por facturar */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-600 font-medium">Pendientes por facturar</span>
          <button
            type="button"
            onClick={() => setPendientesFacturar(!pendientesFacturar)}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${pendientesFacturar ? 'bg-[#009beb] justify-end' : 'bg-slate-300 justify-start'}`}
          >
            <div className="w-4 h-4 bg-white rounded-full shadow-md" />
          </button>
          <span className="text-slate-400 text-[11px] cursor-help" title="Filtra los planes que tienen saldo pendiente de pago">ⓘ</span>
        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS DESGLOSADA POR PRESTACIÓN CON AGRUPAMIENTO ORALDRIVE ─── */}
      {hasSearched && (
        <div className="mx-6 my-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[480px] overflow-hidden">
        
        {/* Barra superior de la tabla con tags de agrupación OralDrive */}
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={expandAllGroups}
                onChange={(e) => {
                  setExpandAllGroups(e.target.checked);
                  if (e.target.checked) setCollapsedGroups({});
                }}
                className="rounded text-[#009beb] focus:ring-[#009beb] w-3.5 h-3.5 cursor-pointer"
              />
              <span>Expandir todos los grupos</span>
            </label>

            {/* Tags de agrupación */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-200">
                Plan de tratamiento <span className="text-[10px] text-slate-400">↑</span>
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-200">
                Nombre paciente <span className="text-[10px] text-slate-400">↑</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Botón Descargar Excel rápido */}
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
                className={`p-1.5 rounded transition-colors cursor-pointer ${showColumnSelector ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <FiFileText size={15} />
              </button>

              {showColumnSelector && (
                <div className="absolute right-0 top-9 z-40 w-64 bg-white border border-slate-300 rounded-xl shadow-2xl p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span>Columnas del reporte</span>
                    <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600 text-xs p-1">✕</button>
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
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {Object.keys(visibleColumns).map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs text-slate-600 hover:bg-slate-50 p-1 rounded cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={visibleColumns[key]}
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

            {/* Botón Reset Filtros */}
            <button
              title="Limpiar filtros de columna"
              onClick={() => setColumnFilters({})}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <FiFilter size={15} />
            </button>
            
            {/* Buscador rápido */}
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

        {/* Tabla completa con scroll horizontal y vertical con altura garantizada */}
        <div className="overflow-x-auto overflow-y-auto max-h-[620px] min-h-[380px] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <div className="w-7 h-7 border-2 border-[#009beb] border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs font-semibold">Cargando reporte de planes de tratamiento...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
              <thead className="bg-[#fcfdfe] sticky top-0 z-20 border-b border-slate-300 text-slate-600 font-bold shadow-xs">
                {/* Fila 1: Encabezados */}
                <tr>
                  <th className="w-8 px-2 py-2 border-r border-slate-200 text-center bg-slate-50">
                    <input type="checkbox" className="rounded text-[#009beb] w-3.5 h-3.5" />
                  </th>
                  {Object.keys(columnLabels).map((key) => {
                    if (!visibleColumns[key]) return null;
                    return (
                      <th
                        key={key}
                        className="px-3.5 py-2 border-r border-slate-200 text-slate-700 text-xs font-bold bg-slate-50 select-none"
                      >
                        {columnLabels[key]}
                      </th>
                    );
                  })}
                </tr>

                {/* Fila 2: Inputs de filtro por columna (incluyendo selects como Realizada, Pagada, Facturada) */}
                <tr className="bg-white border-b border-slate-200">
                  <th className="px-2 py-1 border-r border-slate-200 bg-white"></th>
                  {Object.keys(columnLabels).map((key) => {
                    if (!visibleColumns[key]) return null;
                    const isSelectFilter = key === "realizada" || key === "pagada" || key === "facturada" || key === "finalizado" || key === "compensadoNC";
                    const isDate = key === "fechaCreacionPrestacion" || key === "fechaRealizado" || key === "proximaCita";

                    return (
                      <th key={`filter-${key}`} className="px-2 py-1 border-r border-slate-200 font-normal">
                        {isSelectFilter ? (
                          <select
                            value={columnFilters[key] || "TODO"}
                            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                            className="w-full h-5 text-[10px] border border-slate-200 rounded outline-none focus:border-sky-500 text-slate-700 bg-white"
                          >
                            <option value="TODO">(Todo)</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                          </select>
                        ) : (
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-slate-400 text-[10px] pointer-events-none">
                              {isDate ? "📅" : "🔍"}
                            </span>
                            <input
                              type="text"
                              value={columnFilters[key] || ""}
                              onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                              className="w-full h-5 pl-5 pr-1 text-[10px] border border-slate-200 rounded outline-none focus:border-sky-500 text-slate-700 bg-white"
                            />
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {Object.keys(groupedData).map(groupKey => {
                  const group = groupedData[groupKey];
                  const isCollapsed = !expandAllGroups || !!collapsedGroups[groupKey];

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Fila de cabecera de grupo */}
                      <tr className="bg-slate-100/80 hover:bg-slate-200/70 font-bold text-xs text-slate-800 transition-colors border-y border-slate-200">
                        <td
                          colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => toggleGroupCollapse(groupKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <FiChevronRight size={14} className="text-slate-500" /> : <FiChevronDown size={14} className="text-slate-500" />}
                            <span className="text-[#009beb] font-black uppercase">{group.title}</span>
                            <span className="text-slate-400">—</span>
                            <span className="font-bold text-slate-700 uppercase">{group.patientName}</span>
                            {group.patientDoc && (
                              <span className="text-slate-400 text-[11px] font-normal">({group.patientDoc})</span>
                            )}
                            <span className="ml-auto text-xs font-semibold text-slate-600">
                              {group.items.length} prestación{group.items.length !== 1 ? 'es' : ''} | Total: ${group.planTotal.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Filas de prestaciones del grupo */}
                      {!isCollapsed && group.items.map(r => (
                        <tr key={r.id} className="hover:bg-sky-50/50 transition-colors">
                          <td className="px-2 py-2 border-r border-slate-100 text-center">
                            <input type="checkbox" className="rounded text-[#009beb] w-3.5 h-3.5 cursor-pointer" />
                          </td>
                          {visibleColumns.historia && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-[#009beb] font-semibold hover:underline cursor-pointer">
                              {r.historia || "—"}
                            </td>
                          )}
                          {visibleColumns.prestacion && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-semibold text-slate-800">
                              {r.prestacion}
                            </td>
                          )}
                          {visibleColumns.codigoCups && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-slate-600">
                              {r.codigoCups}
                            </td>
                          )}
                          {visibleColumns.realizada && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center font-bold">
                              <span className={r.realizada === 'Sí' ? 'text-emerald-600' : 'text-slate-400'}>
                                {r.realizada}
                              </span>
                            </td>
                          )}
                          {visibleColumns.pagada && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center font-bold">
                              <span className={r.pagada === 'Sí' ? 'text-emerald-600' : 'text-slate-400'}>
                                {r.pagada}
                              </span>
                            </td>
                          )}
                          {visibleColumns.facturada && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center font-bold">
                              <span className={r.facturada === 'Sí' ? 'text-emerald-600' : 'text-slate-400'}>
                                {r.facturada}
                              </span>
                            </td>
                          )}
                          {visibleColumns.valorPagado && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-emerald-600 font-bold text-right">
                              $ {Number(r.valorPagado || 0).toLocaleString('es-CO')}
                            </td>
                          )}
                          {visibleColumns.valorPrestacion && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono font-bold text-right text-slate-800">
                              $ {Number(r.valorPrestacion || 0).toLocaleString('es-CO')}
                            </td>
                          )}
                          {visibleColumns.valorLiquidado && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-600">
                              $ {Number(r.valorLiquidado || 0).toLocaleString('es-CO')}
                            </td>
                          )}
                          {visibleColumns.profesional && (
                            <td className="px-3.5 py-2 border-r border-slate-100 uppercase text-slate-700">
                              {r.profesional || "—"}
                            </td>
                          )}
                          {visibleColumns.emailPaciente && (
                            <td className="px-3.5 py-2 border-r border-slate-100 lowercase text-[#009beb]">
                              {r.emailPaciente || "—"}
                            </td>
                          )}
                          {visibleColumns.fechaCreacionPrestacion && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                              {formatDateTime(r.fechaCreacionPrestacion)}
                            </td>
                          )}
                          {visibleColumns.fechaRealizado && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                              {formatDateShort(r.fechaRealizado) || "—"}
                            </td>
                          )}
                          {visibleColumns.estado && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center">
                              <span className="uppercase text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {r.estado}
                              </span>
                            </td>
                          )}
                          {visibleColumns.valorPlanTratamiento && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-700">
                              $ {Number(r.valorPlanTratamiento || 0).toLocaleString('es-CO')}
                            </td>
                          )}
                          {visibleColumns.egresos && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-600">
                              $ {Number(r.egresos || 0).toLocaleString('es-CO')}
                            </td>
                          )}
                          {visibleColumns.proximaCita && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                              {formatDateShort(r.proximaCita) || "—"}
                            </td>
                          )}
                          {visibleColumns.orden && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center font-bold">
                              {r.orden}
                            </td>
                          )}
                          {visibleColumns.tarifa && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700">
                              {r.tarifa}
                            </td>
                          )}
                          {visibleColumns.valorTarifa && (
                            <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-700">
                              $ {Number(r.valorTarifa || 0).toLocaleString('es-CO')}
                            </td>
                          )}
                          {visibleColumns.entidad && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700">
                              {r.entidad}
                            </td>
                          )}
                          {visibleColumns.finalizado && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center font-bold">
                              {r.finalizado}
                            </td>
                          )}
                          {visibleColumns.facturaEntidad && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                              {r.facturaEntidad}
                            </td>
                          )}
                          {visibleColumns.compensadoNC && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center">
                              {r.compensadoNC}
                            </td>
                          )}
                          {visibleColumns.categoria && (
                            <td className="px-3.5 py-2 text-slate-700">
                              {r.categoria}
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                      className="px-6 py-12 text-center text-slate-400 font-medium text-xs"
                    >
                      No se encontraron registros de planes de tratamiento para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie de tabla con totalizadores */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 shrink-0 gap-3 font-medium">
          <span>
            Total de prestaciones: <strong>{filteredRows.length}</strong> | Planes únicos: <strong>{Object.keys(groupedData).length}</strong>
          </span>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span>Total Prestaciones: <strong className="text-slate-800">$ {filteredRows.reduce((sum, r) => sum + Number(r.valorPrestacion || 0), 0).toLocaleString('es-CO')}</strong></span>
            <span>Total Pagado: <strong className="text-emerald-600">$ {filteredRows.reduce((sum, r) => sum + Number(r.valorPagado || 0), 0).toLocaleString('es-CO')}</strong></span>
          </div>
        </div>

      </div>
      )}

    </div>
  );
}
