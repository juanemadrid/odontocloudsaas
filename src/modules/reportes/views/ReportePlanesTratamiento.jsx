import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getDoctorsList } from "../../../services/supabaseServices";
import { FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX, FiChevronDown, FiChevronRight, FiRefreshCw } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

// Función auxiliar para traducir y normalizar estados en español
export const formatEstadoPlan = (raw) => {
  if (!raw) return "Borrador";
  const st = String(raw).toLowerCase().trim();
  if (st === "approved" || st === "aprobado") return "Aprobado";
  if (st === "accepted" || st === "aceptado") return "Aceptado";
  if (st === "draft" || st === "borrador") return "Borrador";
  if (st === "activo" || st === "active") return "Activo";
  if (st === "completed" || st === "completado" || st === "finalizado") return "Finalizado";
  if (st.includes("progreso") || st === "iniciado" || st === "in_progress") return "En progreso";
  if (st === "cancelled" || st === "cancelado" || st === "anulado") return "Cancelado";
  if (st === "rejected" || st === "rechazado") return "Rechazado";
  if (st === "pending" || st === "pendiente") return "Pendiente";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export default function ReportePlanesTratamiento() {
  const { userProfile } = useAuth();
  const [allItemRows, setAllItemRows] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [pacientesList, setPacientesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fechas por defecto: mes actual
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [isAllHistory, setIsAllHistory] = useState(false);

  // Filtros de selección
  const [selectedProfesional, setSelectedProfesional] = useState("TODOS");
  const [selectedPacienteTerm, setSelectedPacienteTerm] = useState("");
  const [selectedPacienteId, setSelectedPacienteId] = useState("");
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false);
  const [tipoPlan, setTipoPlan] = useState("TODOS"); // "TODOS" | "Plan de tratamiento" | "Presupuesto"
  const [filtroFechaTipo, setFiltroFechaTipo] = useState("creacion"); // "creacion" | "realizado"
  const [pendientesFacturar, setPendientesFacturar] = useState(false);

  // Agrupamiento y expansión (INICIA CERRADO / COLAPSADO POR DEFECTO A SOLICITUD DEL USUARIO)
  const [expandAllGroups, setExpandAllGroups] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const pacienteDropdownRef = useRef(null);

  // Estado de búsqueda
  const [hasSearched, setHasSearched] = useState(true);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    isAllHistory: false,
    profesional: "TODOS",
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

  // Cargar datos en paralelo optimizado desde el VPS
  const fetchData = useCallback(async () => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;
    setLoading(true);

    try {
      const [docsFromService, profilesRes, pacRes, pagosRes, planesRes] = await Promise.all([
        getDoctorsList(userProfile, null).catch(e => {
          console.warn("Aviso catálogo doctores:", e);
          return [];
        }),
        supabase.from("profiles").select("*").eq("tenant_id", tenantId),
        supabase.from("pacientes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("pagos").select("*").eq("tenant_id", tenantId),
        supabase.from("treatment_plans").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      ]);

      // 1. Armar diccionario de Pacientes
      const pacDict = {};
      const listPacs = (pacRes?.data || []).map(p => {
        const nombreCompleto = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || p.documento || p.nroDocumento || 'Paciente sin nombre';
        const doc = p.documento || p.nroDocumento || p.identificacion || p.nro_historia || '';
        const pacObj = {
          id: p.id,
          nombre: nombreCompleto,
          documento: doc,
          telefono: p.telefono || p.celular || '',
          email: p.email || p.correo || '',
          eps: p.eps || p.nombreEps || p.convenio || ''
        };
        pacDict[p.id] = pacObj;
        if (doc) pacDict[doc] = pacObj;
        return pacObj;
      });
      setPacientesList(listPacs);

      // 2. Armar Catálogo unificado de Profesionales
      const catalogProfs = Array.isArray(docsFromService) ? [...docsFromService] : [];
      (profilesRes?.data || []).forEach(u => {
        if (isDoctorUser(u)) {
          const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
          const primerApellido = u.apellido || u.apellidos || "";
          const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;
          if (!catalogProfs.some(d => String(d.id).toLowerCase() === String(u.id).toLowerCase())) {
            catalogProfs.push({
              id: u.id,
              nombre: nombreCompleto,
              nombreCompleto: nombreCompleto,
              email: u.email || "",
              especialidades: u.especialidades || []
            });
          }
        }
      });

      const docMap = new Map();
      catalogProfs.forEach(u => {
        const nom = (u.nombreCompleto || u.nombre || u.displayName || "").trim();
        const uid = String(u.id || "").toLowerCase().trim();
        const nomLower = nom.toLowerCase().trim();
        if (uid && nom) docMap.set(uid, nom);
        if (nomLower) docMap.set(nomLower, nom);
      });

      // 3. Mapear Pagos
      const pagosMap = {};
      (pagosRes?.data || []).forEach(pago => {
        const isVoided = (pago.estado || "").toLowerCase() === "anulado";
        if (!isVoided) {
          const val = Number(pago.monto || pago.valor || 0);
          if (pago.plan_id) {
            pagosMap[pago.plan_id] = (pagosMap[pago.plan_id] || 0) + val;
          }
        }
      });

      // 4. Procesar y Desglosar Treatment Plans por Prestación (Ítems)
      const snapPlanes = planesRes?.data || [];
      const flattenedRows = [];
      const doctorPlanCounts = {};

      const resolveDocName = (itemDoc, itemDocId, planDoc, planDocId) => {
        const candidates = [
          { val: itemDoc, isId: false },
          { val: itemDocId, isId: true },
          { val: planDoc, isId: false },
          { val: planDocId, isId: true }
        ];

        for (const c of candidates) {
          if (!c.val) continue;
          const str = String(c.val).trim();
          const strLower = str.toLowerCase();
          if (docMap.has(strLower)) return docMap.get(strLower);
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
          if (isUuid && docMap.has(strLower)) return docMap.get(strLower);
          if (!c.isId && str && !isUuid && str !== "—" && str !== "null" && str !== "undefined") {
            return str;
          }
        }
        return "Sin asignar";
      };

      snapPlanes.forEach(p => {
        let d = p.detalles || {};
        if (typeof d === "string") {
          try { d = JSON.parse(d); } catch (e) { d = {}; }
        }

        // Extraer ítems desde cualquier estructura soportada
        let items = [];
        if (Array.isArray(d)) items = d;
        else if (Array.isArray(d.items)) items = d.items;
        else if (Array.isArray(p.items)) items = p.items;
        else if (Array.isArray(d.procedimientos)) items = d.procedimientos;
        else if (Array.isArray(p.procedimientos)) items = p.procedimientos;
        else if (Array.isArray(d.prestaciones)) items = d.prestaciones;

        const pacId = p.paciente_id || p.pacienteId || p.patientId || p.patient_id || p.paciente || d.paciente_id || d.pacienteId;
        const pac = pacDict[pacId] || (p.documento ? pacDict[p.documento] : {}) || {};
        const pacName = pac.nombre || d.pacienteNombre || d.patientName || p.paciente_nombre || p.nombrePaciente || "Paciente";
        const pacDoc = pac.documento || d.pacienteDocumento || d.patientDocument || p.pacienteDocumento || p.documento || "";
        const pacEmail = pac.email || d.pacienteEmail || d.email || p.email || "";

        const planTotal = Number(p.total || d.total || d.costoTotal || 0);

        // Clasificación de Tipo de Plan
        const rawType = String(d.type || p.type || p.tipo || "").toLowerCase();
        const rawEstado = String(p.estado || d.estado || "").toLowerCase();

        const isBudget = rawType === "presupuesto" || rawType === "draft" || rawType === "borrador" || rawEstado === "draft" || rawEstado === "borrador";
        const isPlanTratamiento = !isBudget;

        const planTitle = p.nombre || d.nombre || d.title || (isPlanTratamiento ? "Plan de Tratamiento" : "Presupuesto");

        const planDocName = d.profesional || d.profesionalNombre || p.profesional || p.profesional_nombre || p.doctor || p.odontologo || "";
        const planDocId = d.profesionalId || p.profesional_id || p.doctor_id || "";

        const planPaid = pagosMap[p.id] || Number(p.pagado || d.pagado || 0);
        const planBalance = Math.max(0, planTotal - planPaid);

        // Estado garantizado en español
        const estadoFinalEspanol = formatEstadoPlan(p.estado || d.estado || (isPlanTratamiento ? "Aprobado" : "Borrador"));

        if (items.length > 0) {
          items.forEach((it, idx) => {
            const itemPrice = Number(it.amount || it.precio || it.valor || it.valorPrestacion || it.costo || 0);
            const itemPaid = Number(it.pagado || it.valorPagado || (it.pagada ? itemPrice : 0));
            const itemLiquidated = Number(it.liquidado || it.valorLiquidado || 0);
            const isDone = it.realizado === true || it.realizada === true || it.status === 'completed' || it.estado === 'completado' || it.estado === 'realizado';
            const isPaid = it.pagada === true || it.pagado === true || itemPaid >= itemPrice || (planTotal > 0 && planBalance <= 0);
            const isBilled = it.facturado === true || it.facturada === true;

            const docResolved = resolveDocName(it.profesional, it.profesionalId, planDocName, planDocId);
            const docIdResolved = it.profesionalId || planDocId || "";

            doctorPlanCounts[docResolved] = (doctorPlanCounts[docResolved] || 0) + 1;

            flattenedRows.push({
              id: `${p.id}_${idx}`,
              planId: p.id,
              planTitle: planTitle,
              planType: isPlanTratamiento ? "plan" : "presupuesto",
              planTypeLabel: isPlanTratamiento ? "Plan de tratamiento" : "Presupuesto",
              planDate: p.created_at || d.date || p.date,
              patientId: pacId || p.paciente_id,
              historia: pacDoc || (pacId ? String(pacId).slice(0, 8) : "—"),
              pacienteNombre: pacName,
              emailPaciente: pacEmail,
              prestacion: it.desc || it.nombre || it.descripcion || it.procedimiento || it.prestacion || "Procedimiento Odontológico",
              codigoCups: it.codigo_cups || it.code || it.codigo || it.cups || "—",
              realizada: isDone ? "Sí" : "No",
              pagada: isPaid ? "Sí" : "No",
              facturada: isBilled ? "Sí" : "No",
              valorPagado: itemPaid,
              valorPrestacion: itemPrice,
              valorLiquidado: itemLiquidated,
              profesional: docResolved,
              profesionalId: docIdResolved,
              fechaCreacionPrestacion: it.fechaCreacion || it.fecha || p.created_at,
              fechaRealizado: it.fechaRealizado || it.fecha_realizado || (isDone ? p.created_at : ""),
              estado: estadoFinalEspanol,
              valorPlanTratamiento: planTotal,
              saldoPlan: planBalance,
              egresos: Number(it.egresos || d.egresos || 0),
              proximaCita: it.proximaCita || "",
              orden: it.orden || idx + 1,
              tarifa: it.tarifa || d.tarifa || "Particular",
              valorTarifa: Number(it.valorTarifa || itemPrice),
              entidad: it.entidad || pac.eps || "Particular",
              finalizado: estadoFinalEspanol === "Finalizado" || estadoFinalEspanol === "Aprobado" || estadoFinalEspanol === "Aceptado" ? "Sí" : "No",
              facturaEntidad: it.facturaEntidad || "—",
              compensadoNC: it.compensadoNC || "No",
              categoria: it.categoria || d.categoria || "Odontología General"
            });
          });
        } else {
          // Fallback para plan sin desglose
          const docResolved = resolveDocName("", "", planDocName, planDocId);
          doctorPlanCounts[docResolved] = (doctorPlanCounts[docResolved] || 0) + 1;

          flattenedRows.push({
            id: `${p.id}_0`,
            planId: p.id,
            planTitle: planTitle,
            planType: isPlanTratamiento ? "plan" : "presupuesto",
            planTypeLabel: isPlanTratamiento ? "Plan de tratamiento" : "Presupuesto",
            planDate: p.created_at || d.date || p.date,
            patientId: pacId || p.paciente_id,
            historia: pacDoc || (pacId ? String(pacId).slice(0, 8) : "—"),
            pacienteNombre: pacName,
            emailPaciente: pacEmail,
            prestacion: planTitle,
            codigoCups: "—",
            realizada: estadoFinalEspanol === "Finalizado" ? "Sí" : "No",
            pagada: planBalance <= 0 ? "Sí" : "No",
            facturada: "No",
            valorPagado: planPaid,
            valorPrestacion: planTotal,
            valorLiquidado: 0,
            profesional: docResolved,
            profesionalId: planDocId || "",
            fechaCreacionPrestacion: p.created_at,
            fechaRealizado: "",
            estado: estadoFinalEspanol,
            valorPlanTratamiento: planTotal,
            saldoPlan: planBalance,
            egresos: 0,
            proximaCita: "",
            orden: 1,
            tarifa: "Particular",
            valorTarifa: planTotal,
            entidad: pac.eps || "Particular",
            finalizado: estadoFinalEspanol === "Finalizado" || estadoFinalEspanol === "Aprobado" || estadoFinalEspanol === "Aceptado" ? "Sí" : "No",
            facturaEntidad: "—",
            compensadoNC: "No",
            categoria: "Odontología General"
          });
        }
      });

      // Actualizar lista de profesionales con conteo de prestaciones
      const finalProfs = catalogProfs.map(pr => {
        const nom = (pr.nombreCompleto || pr.nombre || "").trim();
        return {
          id: pr.id,
          nombre: nom,
          planCount: doctorPlanCounts[nom] || 0
        };
      });
      finalProfs.sort((a, b) => b.planCount - a.planCount);
      setProfesionales(finalProfs);

      flattenedRows.sort((a, b) => new Date(b.fechaCreacionPrestacion || 0) - new Date(a.fechaCreacionPrestacion || 0));
      setAllItemRows(flattenedRows);

    } catch (error) {
      console.error("Error cargando reporte de planes de tratamiento:", error);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

        if (targetType.includes("plan") && !targetType.includes("presupuesto")) {
          if (!rowType.includes("plan") && !rowLabel.includes("plan")) {
            return false;
          }
        } else if (targetType.includes("presupuesto")) {
          if (!rowType.includes("presupuesto") && !rowLabel.includes("presupuesto")) {
            return false;
          }
        }
      }

      // 2. Filtro Fechas
      if (!appliedFilters.isAllHistory && appliedFilters.fechaInicial && appliedFilters.fechaInicial.trim() !== "") {
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
      if (appliedFilters.profesional && appliedFilters.profesional !== "TODOS" && appliedFilters.profesional.trim() !== "") {
        const targetProf = appliedFilters.profesional.toLowerCase().trim();
        const rowDoc = String(row.profesional || "").toLowerCase().trim();
        const rowDocId = String(row.profesionalId || "").toLowerCase().trim();

        if (appliedFilters.profesional === "SIN_ASIGNAR") {
          if (rowDoc !== "sin asignar" && rowDoc !== "—" && rowDoc !== "") return false;
        } else {
          const matches = rowDoc === targetProf || 
                          rowDoc.includes(targetProf) || 
                          targetProf.includes(rowDoc) ||
                          rowDocId === targetProf;
          if (!matches) return false;
        }
      }

      // 4. Filtro Paciente
      const pacSearchTerm = (appliedFilters.pacienteTerm || "").trim().toLowerCase();
      if (pacSearchTerm !== "") {
        const pNom = (row.pacienteNombre || "").toLowerCase();
        const pDoc = String(row.historia || "").toLowerCase();
        const pEmail = String(row.emailPaciente || "").toLowerCase();
        const isExactId = appliedFilters.pacienteId && row.patientId === appliedFilters.pacienteId;

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

      // 6. Buscador rápido en toda la fila
      if (tableSearchTerm && tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase().trim();
        const matchesSearch =
          (row.pacienteNombre || "").toLowerCase().includes(term) ||
          String(row.historia || "").toLowerCase().includes(term) ||
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
  }, [allItemRows, appliedFilters, tableSearchTerm, columnFilters]);

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
          estado: row.estado,
          items: []
        };
      }
      groups[groupKey].items.push(row);
    });
    return groups;
  }, [filteredRows]);

  // Manejador para colapsar/expandir grupos (Default: Colapsado)
  const toggleGroupCollapse = (groupKey) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Manejar clic en "Buscar"
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      isAllHistory,
      profesional: selectedProfesional,
      pacienteId: selectedPacienteId,
      pacienteTerm: selectedPacienteTerm,
      tipoPlan,
      fechaTipo: filtroFechaTipo,
      pendientesFacturar
    });
  };

  // Restablecer filtros para ver todo
  const handleResetFilters = () => {
    setIsAllHistory(true);
    setSelectedProfesional("TODOS");
    setSelectedPacienteId("");
    setSelectedPacienteTerm("");
    setTipoPlan("TODOS");
    setPendientesFacturar(false);
    setTableSearchTerm("");
    setColumnFilters({});
    setAppliedFilters({
      fechaInicial: "",
      fechaFinal: "",
      isAllHistory: true,
      profesional: "TODOS",
      pacienteId: "",
      pacienteTerm: "",
      tipoPlan: "TODOS",
      fechaTipo: "creacion",
      pendientesFacturar: false
    });
  };

  // Manejar cambio de filtro individual de columna
  const handleColumnFilterChange = (colKey, val) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: val
    }));
  };

  // Autocomplete de pacientes
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

  // Exportar a Excel Ejecutivo y Profesional
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert("No hay registros disponibles para exportar con los filtros seleccionados.");
      return;
    }

    const clinicName = userProfile?.nombreClinica || userProfile?.tenant_nombre || "ATM CENTRO DEL DOLOR";
    const clinicNit = userProfile?.nit || userProfile?.documento || "84976356-3";
    const dateFormatted = format(new Date(), "dd/MM/yyyy HH:mm");
    const periodText = appliedFilters.isAllHistory 
      ? "Histórico Completo (Sin restricción de fechas)" 
      : `${appliedFilters.fechaInicial || 'Inicio'} al ${appliedFilters.fechaFinal || 'Fin'}`;
    const profText = appliedFilters.profesional === "TODOS" || !appliedFilters.profesional 
      ? "Todos los profesionales" 
      : (appliedFilters.profesional === "SIN_ASIGNAR" ? "Sin profesional asignado" : appliedFilters.profesional);

    const totalPrestacionesVal = filteredRows.reduce((sum, r) => sum + Number(r.valorPrestacion || 0), 0);
    const totalPagadoVal = filteredRows.reduce((sum, r) => sum + Number(r.valorPagado || 0), 0);
    const totalSaldoVal = Math.max(0, totalPrestacionesVal - totalPagadoVal);

    const activeColKeys = Object.keys(visibleColumns).filter(k => visibleColumns[k]);
    const headers = activeColKeys.map(k => columnLabels[k]);

    // Encabezado corporativo institucional
    const aoa = [
      ["ODONTOCLOUD COLOMBIA — SISTEMA DE GESTIÓN ODONTOLÓGICA"],
      ["REPORTE DETALLADO DE PLANES DE TRATAMIENTO Y PRESTACIONES"],
      [`Clínica / Institución: ${clinicName} (NIT: ${clinicNit})`, "", `Fecha de Generación: ${dateFormatted}`],
      [`Filtro Período: ${periodText}`, "", `Profesional: ${profText}`],
      [
        `Total Prestaciones: ${filteredRows.length}`,
        `Planes Únicos: ${Object.keys(groupedData).length}`,
        `Total Valor Prestaciones: $ ${totalPrestacionesVal.toLocaleString('es-CO')}`,
        `Total Pagado: $ ${totalPagadoVal.toLocaleString('es-CO')}`,
        `Saldo Pendiente: $ ${totalSaldoVal.toLocaleString('es-CO')}`
      ],
      [], // Separador visual
      headers // Nombres de columnas visibles
    ];

    // Filas de datos
    filteredRows.forEach((r, idx) => {
      const row = [];
      activeColKeys.forEach(k => {
        switch (k) {
          case "historia": row.push(r.historia || ""); break;
          case "prestacion": row.push(r.prestacion || ""); break;
          case "codigoCups": row.push(r.codigoCups || "—"); break;
          case "realizada": row.push(r.realizada || "No"); break;
          case "pagada": row.push(r.pagada || "No"); break;
          case "facturada": row.push(r.facturada || "No"); break;
          case "valorPagado": row.push(Number(r.valorPagado || 0)); break;
          case "valorPrestacion": row.push(Number(r.valorPrestacion || 0)); break;
          case "valorLiquidado": row.push(Number(r.valorLiquidado || 0)); break;
          case "profesional": row.push(r.profesional || "Sin asignar"); break;
          case "emailPaciente": row.push(r.emailPaciente || "—"); break;
          case "fechaCreacionPrestacion": row.push(formatDateTime(r.fechaCreacionPrestacion)); break;
          case "fechaRealizado": row.push(formatDateShort(r.fechaRealizado) || "—"); break;
          case "estado": row.push(r.estado || "Borrador"); break;
          case "valorPlanTratamiento": row.push(Number(r.valorPlanTratamiento || 0)); break;
          case "egresos": row.push(Number(r.egresos || 0)); break;
          case "proximaCita": row.push(formatDateShort(r.proximaCita) || "—"); break;
          case "orden": row.push(r.orden || idx + 1); break;
          case "tarifa": row.push(r.tarifa || "Particular"); break;
          case "valorTarifa": row.push(Number(r.valorTarifa || 0)); break;
          case "entidad": row.push(r.entidad || "Particular"); break;
          case "finalizado": row.push(r.finalizado || "No"); break;
          case "facturaEntidad": row.push(r.facturaEntidad || "—"); break;
          case "compensadoNC": row.push(r.compensadoNC || "No"); break;
          case "categoria": row.push(r.categoria || "Odontología General"); break;
          default: row.push(r[k] || "");
        }
      });
      aoa.push(row);
    });

    // Fila final de totales
    const summaryRow = [];
    activeColKeys.forEach(k => {
      if (k === "prestacion") summaryRow.push("TOTALES GENERALES:");
      else if (k === "valorPrestacion") summaryRow.push(totalPrestacionesVal);
      else if (k === "valorPagado") summaryRow.push(totalPagadoVal);
      else if (k === "valorPlanTratamiento") summaryRow.push(totalPrestacionesVal);
      else summaryRow.push("");
    });
    aoa.push([]);
    aoa.push(summaryRow);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Ajuste automático del ancho de cada columna para legibilidad perfecta
    const colWidths = headers.map((h, i) => {
      let maxLen = Math.max(h.length, 12);
      filteredRows.forEach(r => {
        const val = String(r[activeColKeys[i]] || "");
        if (val.length > maxLen) maxLen = Math.min(val.length, 45);
      });
      return { wch: maxLen + 4 };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planes de Tratamiento");

    const cleanClinic = clinicName.replace(/[^a-zA-Z0-9]/g, "_");
    const fileNameSuffix = appliedFilters.isAllHistory ? "Historico" : format(new Date(), "yyyyMMdd");
    XLSX.writeFile(workbook, `Reporte_Planes_Tratamiento_${cleanClinic}_${fileNameSuffix}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f4f7fb] font-sans text-slate-700 pb-12">
      
      {/* ─── BARRA DE ACCIONES (SIN ENCABEZADO DUPLICADO) ─── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Módulo de Reportes Clínicos:</span>
          <span className="text-xs font-bold text-slate-800 bg-sky-50 text-[#009beb] px-2 py-0.5 rounded border border-sky-200">
            Planes de tratamiento
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-all cursor-pointer"
            title="Recargar datos del VPS"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin text-[#009beb]" : ""} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2 bg-[#009beb] hover:bg-[#0087cd] active:scale-[0.98] text-white text-xs font-semibold rounded-2xl shadow-sm transition-all cursor-pointer"
          >
            <FiDownload size={14} />
            <span>Generar reporte en excel</span>
          </button>
        </div>
      </div>

      {/* ─── ÁREA DE FILTROS 1:1 CON ORALDRIVE ─── */}
      <div className="mx-6 mt-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
        
        {/* Fila 1: Fecha inicial / Fecha final */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Fecha inicial</label>
              <button
                type="button"
                onClick={() => {
                  setIsAllHistory(!isAllHistory);
                  if (!isAllHistory) {
                    setFechaInicial("");
                    setFechaFinal("");
                  } else {
                    setFechaInicial(format(firstDayOfMonth, "yyyy-MM-dd"));
                    setFechaFinal(format(now, "yyyy-MM-dd"));
                  }
                }}
                className={`text-[11px] font-semibold transition-colors cursor-pointer ${isAllHistory ? 'text-emerald-600 underline' : 'text-[#009beb] hover:underline'}`}
              >
                {isAllHistory ? "✓ Viendo todo el histórico" : "Ver todo el histórico"}
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fechaInicial}
                disabled={isAllHistory}
                onChange={(e) => {
                  setFechaInicial(e.target.value);
                  setIsAllHistory(false);
                }}
                className={`w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium ${isAllHistory ? 'bg-slate-100 text-slate-400' : ''}`}
                max="9999-12-31" min="1900-01-01"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Fecha final</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFechaInicial(format(firstDayOfMonth, "yyyy-MM-dd"));
                    setFechaFinal(format(now, "yyyy-MM-dd"));
                    setIsAllHistory(false);
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Este mes
                </button>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fechaFinal}
                disabled={isAllHistory}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setIsAllHistory(false);
                }}
                className={`w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium ${isAllHistory ? 'bg-slate-100 text-slate-400' : ''}`}
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
              <option value="TODOS">-- Todos los profesionales --</option>
              <option value="SIN_ASIGNAR">Sin profesional asignado</option>
              {profesionales.map(prof => (
                <option key={prof.id} value={prof.nombre}>
                  {prof.nombre} {prof.planCount > 0 ? `(${prof.planCount} prestaciones)` : `(0 prestaciones)`}
                </option>
              ))}
            </select>
          </div>

          {/* Paciente */}
          <div className="relative" ref={pacienteDropdownRef}>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paciente</label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="BUSCAR PACIENTE POR NOMBRE O DOCUMENTO..."
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

        {/* Fila 3: Tipo de plan + Botones Buscar y Limpiar */}
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

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              type="button"
              className="h-8 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-600 font-semibold text-xs rounded shadow-xs transition-all flex items-center justify-center cursor-pointer"
              title="Restablecer filtros y ver todo"
            >
              Limpiar
            </button>
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
                  const isChecked = e.target.checked;
                  setExpandAllGroups(isChecked);
                  if (isChecked) {
                    setExpandedGroups(new Set(Object.keys(groupedData)));
                  } else {
                    setExpandedGroups(new Set());
                  }
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
              title="Exportar a Excel Profesional"
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

        {/* Tabla completa con scroll horizontal y vertical */}
        <div className="overflow-x-auto overflow-y-auto max-h-[620px] min-h-[380px] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <div className="w-8 h-8 border-3 border-[#009beb] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-semibold text-slate-600">Cargando reporte de planes de tratamiento...</span>
              <span className="text-[11px] text-slate-400 mt-1">Conectando con la base de datos</span>
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

                {/* Fila 2: Inputs de filtro por columna */}
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
                  const isOpen = expandAllGroups || expandedGroups.has(groupKey);

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Fila de cabecera de grupo (Colapsada por defecto para orden visual total) */}
                      <tr 
                        className="bg-slate-100/90 hover:bg-slate-200/80 font-bold text-xs text-slate-800 transition-colors border-y border-slate-200 cursor-pointer select-none"
                        onClick={() => toggleGroupCollapse(groupKey)}
                      >
                        <td
                          colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                          className="px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            {isOpen ? (
                              <FiChevronDown size={15} className="text-[#009beb] shrink-0" />
                            ) : (
                              <FiChevronRight size={15} className="text-slate-500 shrink-0" />
                            )}
                            <span className="text-[#009beb] font-black uppercase tracking-tight">{group.title}</span>
                            <span className="text-slate-300 font-normal">|</span>
                            <span className="font-bold text-slate-800 uppercase">{group.patientName}</span>
                            {group.patientDoc && (
                              <span className="text-slate-500 text-[11px] font-normal">({group.patientDoc})</span>
                            )}

                            {/* Badge de Estado en Español en la cabecera */}
                            <span className={`uppercase text-[9px] font-extrabold px-2 py-0.5 rounded border ml-1 ${
                              group.estado === 'Aprobado' || group.estado === 'Aceptado' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                : group.estado === 'Finalizado' 
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : group.estado === 'En progreso' || group.estado === 'Activo'
                                ? 'bg-sky-50 text-sky-700 border-sky-300'
                                : group.estado === 'Cancelado' || group.estado === 'Rechazado'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}>
                              {group.estado}
                            </span>

                            <div className="ml-auto flex items-center gap-3 text-xs font-semibold text-slate-600">
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                                {group.items.length} prestación{group.items.length !== 1 ? 'es' : ''}
                              </span>
                              <span>
                                Total: <strong className="text-slate-900 font-bold">$ {Number(group.planTotal || 0).toLocaleString('es-CO')}</strong>
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Filas de prestaciones del grupo (se muestran solo si el usuario abre el grupo) */}
                      {isOpen && group.items.map(r => (
                        <tr key={r.id} className="hover:bg-sky-50/50 transition-colors bg-white">
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

                          {/* ESTADO EN ESPAÑOL CON BADGE PROFESIONAL */}
                          {visibleColumns.estado && (
                            <td className="px-3.5 py-2 border-r border-slate-100 text-center">
                              <span className={`uppercase text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
                                r.estado === 'Aprobado' || r.estado === 'Aceptado' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : r.estado === 'Finalizado' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : r.estado === 'En progreso' || r.estado === 'Activo'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : r.estado === 'Cancelado' || r.estado === 'Rechazado'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
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
                      className="px-6 py-14 text-center"
                    >
                      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                        <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mb-3">
                          <FiFileText size={22} />
                        </div>
                        <div className="text-sm font-bold text-slate-700 mb-1">
                          No se encontraron registros de planes de tratamiento
                        </div>
                        <div className="text-xs text-slate-500 mb-4 text-center">
                          {allItemRows.length > 0 
                            ? `Los filtros actuales no coinciden con ninguna prestación. Existen ${allItemRows.length} prestaciones registradas en total.` 
                            : "No se registran planes de tratamiento en este inquilino."}
                        </div>
                        {allItemRows.length > 0 && (
                          <button
                            onClick={handleResetFilters}
                            className="px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <span>Ver todas las prestaciones ({allItemRows.length})</span>
                          </button>
                        )}
                      </div>
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
