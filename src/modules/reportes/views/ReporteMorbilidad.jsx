import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import {
  FiSearch,
  FiFileText,
  FiFilter,
  FiDownload,
  FiPrinter,
  FiEye,
  FiX,
  FiActivity,
  FiLayers,
  FiAlertCircle,
  FiUsers,
  FiTrendingUp,
  FiCalendar,
  FiRefreshCw
} from "react-icons/fi";
import { format, parseISO, isValid } from "date-fns";
import * as XLSX from "xlsx";

/**
 * Formatea un código CIE-10 estándar con punto (ej: K021 -> K02.1, K050 -> K05.0)
 */
function formatCie10Code(rawCode) {
  if (!rawCode) return "";
  const clean = String(rawCode).trim().toUpperCase();
  if (clean.includes(".")) return clean;
  if (/^[A-Z][0-9]{3}$/.test(clean)) {
    return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  return clean;
}

/**
 * Normaliza y resuelve un diagnóstico contra los catálogos CIE-10.
 * CERO DATOS INVENTADOS: Si el registro no contiene un diagnóstico válido, devuelve null.
 */
function parseDiagnosis(raw, cieCodeMap, cieNameMap) {
  if (!raw) return null;

  let codeCandidate = "";
  let nameCandidate = "";

  if (typeof raw === "object") {
    codeCandidate = raw.code || raw.codigo || raw.cie10 || raw.cie10Code || raw.codigoCie10 || raw.id || "";
    nameCandidate = raw.name || raw.nombre || raw.descripcion || raw.diagnostico || raw.label || "";
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
      return null;
    }
    // Patrón: "K02.1 - Caries de la dentina" o "K021 : Caries..." o "K021 - Caries"
    const match = trimmed.match(/^([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2}|[0-9A-Z]{1,2})?)\s*[-:]\s*(.+)$/i);
    if (match) {
      codeCandidate = match[1];
      nameCandidate = match[2];
    } else {
      // Si la cadena es sólo el código (ej: "K02.1" o "K021")
      const isPureCode = /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2}|[0-9A-Z]{1,2})?$/i.test(trimmed);
      if (isPureCode) {
        codeCandidate = trimmed;
      } else {
        nameCandidate = trimmed;
      }
    }
  }

  const cleanCodeKey = codeCandidate.replace(/\./g, "").trim().toUpperCase();
  let matched = null;

  if (cleanCodeKey && cieCodeMap.has(cleanCodeKey)) {
    matched = cieCodeMap.get(cleanCodeKey);
  } else if (nameCandidate) {
    const cleanNameKey = nameCandidate.trim().toLowerCase();
    if (cieNameMap.has(cleanNameKey)) {
      matched = cieNameMap.get(cleanNameKey);
    }
  }

  let finalCode = "";
  let finalName = "";

  if (matched) {
    finalCode = formatCie10Code(matched.code);
    finalName = matched.name;
  } else if (codeCandidate) {
    finalCode = formatCie10Code(codeCandidate);
    finalName = nameCandidate ? nameCandidate.trim() : `Diagnóstico ${finalCode}`;
  } else if (nameCandidate && nameCandidate.length >= 3) {
    finalCode = "CIE-10";
    finalName = nameCandidate.trim();
  } else {
    return null;
  }

  return {
    code: finalCode,
    name: finalName
  };
}

export default function ReporteMorbilidad() {
  const { userProfile } = useAuth();

  // Estados de datos
  const [allExtractedCases, setAllExtractedCases] = useState([]);
  const [morbilidadList, setMorbilidadList] = useState([]);
  const [filteredMorbilidad, setFilteredMorbilidad] = useState([]);
  const [sucursalesList, setSucursalesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a OralDrive
  const [fechaInicial, setFechaInicial] = useState("2020-04-22");
  const [fechaFinal, setFechaFinal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("Todas las oficinas");
  const [nroRegistros, setNroRegistros] = useState("10");

  const [hasSearched, setHasSearched] = useState(false);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: "2020-04-22",
    fechaFinal: format(new Date(), "yyyy-MM-dd"),
    oficina: "Todas las oficinas",
    nroRegistros: "10"
  });

  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Modal para ver detalle de casos clínicos
  const [selectedCaseModal, setSelectedCaseModal] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState({
    ranking: true,
    codigoDiagnostico: true,
    diagnostico: true,
    frecuencia: true,
    porcentaje: true,
    pacientes: true,
    oficina: true,
    acciones: true
  });

  const columnLabels = {
    ranking: "Ranking / Posición",
    codigoDiagnostico: "Código CIE-10",
    diagnostico: "Diagnóstico / Patología",
    frecuencia: "Frecuencia / Casos",
    porcentaje: "Porcentaje (%)",
    pacientes: "Pacientes Afectados",
    oficina: "Oficina / Sucursales",
    acciones: "Acciones / Detalle"
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Carga inicial de datos clínicos reales
  const loadClinicalMorbidityData = async () => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenant?.id;
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Cargar catálogo oficial CIE-10 de forma asíncrona
      let cieCatalog = [];
      try {
        const cieModule = await import("../../../data/cie10Completo.js");
        cieCatalog = cieModule.CIE10_COMPLETO || cieModule.default || [];
      } catch (cieErr) {
        console.warn("Aviso al cargar catálogo CIE-10 completo:", cieErr);
      }

      const cieCodeMap = new Map();
      const cieNameMap = new Map();

      cieCatalog.forEach(item => {
        if (item.code) {
          const cleanCode = String(item.code).replace(/\./g, "").trim().toUpperCase();
          cieCodeMap.set(cleanCode, item);
        }
        if (item.name) {
          cieNameMap.set(String(item.name).trim().toLowerCase(), item);
        }
      });

      // 2. Cargar Sucursales reales
      let listSuc = [{ id: "TODAS", nombre: "Todas las oficinas" }];
      try {
        const cfgSuc = await getConfigItems(tenantId, "sucursales", "sucursales");
        if (Array.isArray(cfgSuc) && cfgSuc.length > 0) {
          cfgSuc.forEach(s => {
            const name = s.nombre || s.nombreSucursal || s.nombreComercial || s.name;
            if (name && !listSuc.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
              listSuc.push({ id: s.id, nombre: name });
            }
          });
        }
      } catch (_) {}

      try {
        const { data: dbSuc } = await supabase.from("sucursales").select("*").eq("tenant_id", tenantId);
        (dbSuc || []).forEach(s => {
          const name = s.nombre || s.name;
          if (name && !listSuc.some(item => item.nombre.toLowerCase() === name.toLowerCase())) {
            listSuc.push({ id: s.id, nombre: name });
          }
        });
      } catch (_) {}

      if (listSuc.length === 1) {
        listSuc.push({ id: "PRINCIPAL", nombre: "CLINICA DENTAL SINCELEJO - SEDE PRINCIPAL" });
      }
      setSucursalesList(listSuc);

      // 3. Cargar Profesionales/Doctores para mapeo de nombres
      let snapProfiles = [];
      try {
        const { data } = await supabase.from("profiles").select("*").eq("tenant_id", tenantId);
        if (data) snapProfiles = data;
      } catch (_) {}

      const profMap = {};
      (snapProfiles || []).forEach(u => {
        const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || "";
        const primerApellido = u.apellido || u.apellidos || "";
        const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email || "Doctor tratante";
        profMap[u.id] = nombreCompleto;
      });

      // 4. Cargar Pacientes reales para mapeo de nombres y documentos
      let snapPacientes = [];
      try {
        const { data } = await supabase.from("pacientes").select("*").eq("tenant_id", tenantId);
        if (data) snapPacientes = data;
      } catch (_) {}

      const pacMap = {};
      (snapPacientes || []).forEach(p => {
        const primerNombre = p.nombres || p.nombre || "";
        const primerApellido = p.apellidos || p.apellido || "";
        const nombreCompleto = (p.nombreCompleto || `${primerNombre} ${primerApellido}`).trim() || "Paciente";
        const doc = p.documento || p.nroDocumento || p.identificacion || "";
        const tDoc = p.tipo_documento || p.tipoDocumento || "CC";
        const obj = {
          id: p.id,
          nombre: nombreCompleto,
          documento: doc,
          tipoDocumento: tDoc,
          sucursal: p.sucursal || p.sucursal_id || (listSuc[1]?.nombre || "SEDE PRINCIPAL")
        };
        pacMap[p.id] = obj;
        if (doc) pacMap[doc] = obj;
      });

      // 5. Cargar Fuentes Clínicas Reales en Paralelo (documentos_clinicos, evoluciones, citas)
      const [snapDocsRes, snapEvoRes, snapCitasRes] = await Promise.all([
        supabase.from("documentos_clinicos").select("*").eq("tenant_id", tenantId).then(r => r.data || [], () => []),
        supabase.from("evoluciones").select("*").eq("tenant_id", tenantId).then(r => r.data || [], () => []),
        supabase.from("citas").select("*").eq("tenant_id", tenantId).then(r => r.data || [], () => [])
      ]);

      const extractedCases = [];
      const dedupeSet = new Set();
      const defaultSucursal = listSuc[1]?.nombre || "SEDE PRINCIPAL";

      // ── A. Extraer de DOCUMENTOS CLÍNICOS (Consultas Odontológicas, Valoraciones, etc.) ──
      (snapDocsRes || []).forEach(doc => {
        const meta = doc.metadata || {};
        let docDate = null;
        if (doc.fecha_documento) {
          docDate = parseISO(doc.fecha_documento);
        } else if (doc.created_at) {
          docDate = new Date(doc.created_at);
        } else if (doc.fecha) {
          docDate = new Date(doc.fecha);
        }
        if (!docDate || isNaN(docDate.getTime())) docDate = new Date();

        const pac = pacMap[doc.paciente_id] || pacMap[doc.pacienteDocumento] || {};
        const prof = meta.profesionalNombre || doc.creado_por || profMap[doc.profesional_id] || "Doctor tratante";
        const suc = meta.sucursal || doc.sucursal || pac.sucursal || defaultSucursal;

        const candidates = [];
        if (meta.dxPrincipalConsulta) candidates.push({ val: meta.dxPrincipalConsulta, tipo: "Dx Principal Consulta" });
        if (Array.isArray(meta.dxRelacionadosConsulta)) {
          meta.dxRelacionadosConsulta.forEach(d => candidates.push({ val: d, tipo: "Dx Relacionado" }));
        }
        if (meta.dxPrincipal) candidates.push({ val: meta.dxPrincipal, tipo: "Dx Principal" });
        if (Array.isArray(meta.diagnosticosRelacionados)) {
          meta.diagnosticosRelacionados.forEach(d => candidates.push({ val: d, tipo: "Dx Relacionado" }));
        }
        if (meta.diagnostico) candidates.push({ val: meta.diagnostico, tipo: "Diagnóstico Clínico" });
        if (meta.cie10) candidates.push({ val: meta.cie10, tipo: "CIE-10" });
        if (doc.diagnostico_codigo || doc.diagnostico_nombre) {
          candidates.push({ val: { code: doc.diagnostico_codigo, name: doc.diagnostico_nombre }, tipo: "Diagnóstico Registrado" });
        }

        candidates.forEach(cand => {
          const parsed = parseDiagnosis(cand.val, cieCodeMap, cieNameMap);
          if (parsed) {
            const dateStr = format(docDate, "yyyy-MM-dd");
            const dedupeKey = `${doc.paciente_id || pac.documento}_${parsed.code}_${dateStr}`;
            if (!dedupeSet.has(dedupeKey)) {
              dedupeSet.add(dedupeKey);
              extractedCases.push({
                id: `${doc.id}_${parsed.code}`,
                codigoDiagnostico: parsed.code,
                diagnostico: parsed.name,
                fecha: docDate,
                pacienteId: doc.paciente_id || pac.id,
                pacienteNombre: pac.nombre || "Paciente",
                pacienteDoc: pac.documento || "—",
                pacienteTipoDoc: pac.tipoDocumento || "CC",
                profesional: prof,
                oficina: suc,
                origen: doc.tipo || doc.tipo_documento || "Doc. Clínico / Consulta",
                notas: meta.diagnosticoNotas || meta.motivoConsulta || doc.titulo || "Consulta odontológica"
              });
            }
          }
        });
      });

      // ── B. Extraer de EVOLUCIONES CLÍNICAS ──
      (snapEvoRes || []).forEach(evo => {
        let evoDate = null;
        if (evo.fecha) {
          evoDate = new Date(evo.fecha);
        } else if (evo.created_at) {
          evoDate = new Date(evo.created_at);
        }
        if (!evoDate || isNaN(evoDate.getTime())) evoDate = new Date();

        const pac = pacMap[evo.paciente_id] || pacMap[evo.pacienteDocumento] || {};
        const prof = evo.profesionalNombre || profMap[evo.profesional_id] || evo.doctorName || "Doctor tratante";
        const suc = evo.sucursal || evo.oficina || pac.sucursal || defaultSucursal;

        const candidates = [];
        if (evo.cie10Code || evo.cie10Nombre) {
          candidates.push({ val: { code: evo.cie10Code, name: evo.cie10Nombre }, tipo: "CIE-10 Evolución" });
        }
        if (evo.codigoDiagnostico || evo.codigoCie10) {
          candidates.push({ val: { code: evo.codigoDiagnostico || evo.codigoCie10, name: evo.diagnostico }, tipo: "Código Diagnóstico" });
        }
        if (evo.diagnostico && typeof evo.diagnostico === "string" && evo.diagnostico.trim() !== "") {
          candidates.push({ val: evo.diagnostico, tipo: "Diagnóstico" });
        }
        if (evo.dxPrincipal) candidates.push({ val: evo.dxPrincipal, tipo: "Dx Principal" });
        if (evo.dxRelacionado) candidates.push({ val: evo.dxRelacionado, tipo: "Dx Relacionado" });
        if (evo.complicacion) candidates.push({ val: evo.complicacion, tipo: "Complicación" });

        // Tratamiento con JSON embebido
        let tData = null;
        if (typeof evo.tratamiento === "string" && evo.tratamiento.trim().startsWith("{")) {
          try { tData = JSON.parse(evo.tratamiento); } catch (_) {}
        } else if (typeof evo.tratamiento === "object" && evo.tratamiento !== null) {
          tData = evo.tratamiento;
        }

        if (tData) {
          if (tData.dxPrincipal) candidates.push({ val: tData.dxPrincipal, tipo: "Dx Principal Tratamiento" });
          if (tData.dxRelacionado) candidates.push({ val: tData.dxRelacionado, tipo: "Dx Relacionado Tratamiento" });
          if (tData.diagnostico) candidates.push({ val: tData.diagnostico, tipo: "Diagnóstico Tratamiento" });
          if (tData.cie10) candidates.push({ val: tData.cie10, tipo: "CIE-10 Tratamiento" });
        }

        candidates.forEach(cand => {
          const parsed = parseDiagnosis(cand.val, cieCodeMap, cieNameMap);
          if (parsed) {
            const dateStr = format(evoDate, "yyyy-MM-dd");
            const dedupeKey = `${evo.paciente_id || pac.documento}_${parsed.code}_${dateStr}`;
            if (!dedupeSet.has(dedupeKey)) {
              dedupeSet.add(dedupeKey);
              extractedCases.push({
                id: `${evo.id}_${parsed.code}`,
                codigoDiagnostico: parsed.code,
                diagnostico: parsed.name,
                fecha: evoDate,
                pacienteId: evo.paciente_id || pac.id,
                pacienteNombre: pac.nombre || "Paciente",
                pacienteDoc: pac.documento || "—",
                pacienteTipoDoc: pac.tipoDocumento || "CC",
                profesional: prof,
                oficina: suc,
                origen: "Evolución Clínica",
                notas: evo.notas || evo.procedimiento_cups || "Evolución clínica realizada"
              });
            }
          }
        });
      });

      // ── C. Extraer de CITAS / ATENCIONES DE AGENDA ──
      (snapCitasRes || []).forEach(c => {
        let citaDate = null;
        if (c.fecha_inicio) {
          citaDate = new Date(c.fecha_inicio);
        } else if (c.fecha) {
          citaDate = new Date(`${c.fecha}T${c.hora || "08:00"}:00`);
        } else if (c.created_at) {
          citaDate = new Date(c.created_at);
        }
        if (!citaDate || isNaN(citaDate.getTime())) citaDate = new Date();

        const pac = pacMap[c.paciente_id] || pacMap[c.pacienteDocumento] || {};
        const prof = c.profesional || profMap[c.profesional_id] || "Doctor tratante";
        const suc = c.sucursal || c.oficina || pac.sucursal || defaultSucursal;

        const rawDx = c.diagnostico || c.cie10 || c.detalles?.diagnostico || c.detalles?.cie10;
        if (rawDx) {
          const parsed = parseDiagnosis(rawDx, cieCodeMap, cieNameMap);
          if (parsed) {
            const dateStr = format(citaDate, "yyyy-MM-dd");
            const dedupeKey = `${c.paciente_id || pac.documento}_${parsed.code}_${dateStr}`;
            if (!dedupeSet.has(dedupeKey)) {
              dedupeSet.add(dedupeKey);
              extractedCases.push({
                id: `${c.id}_${parsed.code}`,
                codigoDiagnostico: parsed.code,
                diagnostico: parsed.name,
                fecha: citaDate,
                pacienteId: c.paciente_id || pac.id,
                pacienteNombre: pac.nombre || c.pacienteNombre || "Paciente",
                pacienteDoc: pac.documento || c.pacienteDocumento || "—",
                pacienteTipoDoc: pac.tipoDocumento || "CC",
                profesional: prof,
                oficina: suc,
                origen: "Cita / Agenda",
                notas: c.motivo || c.motivoConsulta || "Atención en cita"
              });
            }
          }
        }
      });

      // ── D. Extraer de HISTORIAL MÉDICO / ANAMNESIS DE PACIENTES ──
      (snapPacientes || []).forEach(p => {
        const hm = p.historial_medico || {};
        const pDate = p.created_at ? new Date(p.created_at) : new Date();
        const suc = p.sucursal || defaultSucursal;
        const nombrePac = (p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`).trim() || "Paciente";

        const anamDx = hm.anamnesis?.diagnosticoPrincipal || p.diagnostico;
        if (anamDx) {
          const parsed = parseDiagnosis(anamDx, cieCodeMap, cieNameMap);
          if (parsed) {
            const dateStr = format(pDate, "yyyy-MM-dd");
            const dedupeKey = `${p.id}_${parsed.code}_${dateStr}`;
            if (!dedupeSet.has(dedupeKey)) {
              dedupeSet.add(dedupeKey);
              extractedCases.push({
                id: `${p.id}_anam_${parsed.code}`,
                codigoDiagnostico: parsed.code,
                diagnostico: parsed.name,
                fecha: pDate,
                pacienteId: p.id,
                pacienteNombre: nombrePac,
                pacienteDoc: p.documento || p.nroDocumento || "—",
                pacienteTipoDoc: p.tipo_documento || "CC",
                profesional: "Evaluación Inicial",
                oficina: suc,
                origen: "Historia Clínica / Anamnesis",
                notas: hm.anamnesis?.motivoConsulta || "Ingreso clínico del paciente"
              });
            }
          }
        }
      });

      setAllExtractedCases(extractedCases);

      // Agrupar y aplicar filtros de inmediato para evitar pantalla en blanco
      processAndFilterReport(extractedCases, appliedFilters, "");
      setHasSearched(true);

    } catch (err) {
      console.error("Error al procesar reporte de morbilidad clínico:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClinicalMorbidityData();
  }, [userProfile?.inquilino, userProfile?.tenant_id]);

  /**
   * Agrupa los casos clínicos reales por diagnóstico CIE-10 y calcula frecuencias, porcentajes y oficinas.
   */
  const processAndFilterReport = (rawCases, filters, quickSearch) => {
    const startLimit = filters.fechaInicial ? new Date(`${filters.fechaInicial}T00:00:00`) : new Date("2000-01-01");
    const endLimit = filters.fechaFinal ? new Date(`${filters.fechaFinal}T23:59:59`) : new Date("2099-12-31");
    const targetOficina = (filters.oficina || "").toLowerCase().trim();

    // 1. Filtrar casos individuales por fecha y oficina
    const matchingCases = rawCases.filter(c => {
      // Fecha
      if (c.fecha < startLimit || c.fecha > endLimit) return false;
      // Oficina
      if (targetOficina !== "todas las oficinas" && targetOficina !== "" && targetOficina !== "todas") {
        const cOf = (c.oficina || "").toLowerCase();
        if (!cOf.includes(targetOficina) && !targetOficina.includes(cOf)) return false;
      }
      return true;
    });

    // 2. Agrupar por diagnóstico CIE-10
    const groupMap = {};
    let totalCasosEnPeriodo = 0;

    matchingCases.forEach(c => {
      const groupKey = `${c.codigoDiagnostico}_${c.diagnostico}`.trim();
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          codigoDiagnostico: c.codigoDiagnostico,
          diagnostico: c.diagnostico,
          frecuencia: 0,
          pacientesSet: new Set(),
          sucursalesSet: new Set(),
          casosDetalle: []
        };
      }

      groupMap[groupKey].frecuencia += 1;
      if (c.pacienteId) groupMap[groupKey].pacientesSet.add(c.pacienteId);
      if (c.oficina) groupMap[groupKey].sucursalesSet.add(c.oficina);
      groupMap[groupKey].casosDetalle.push(c);
      totalCasosEnPeriodo += 1;
    });

    const safeTotal = totalCasosEnPeriodo > 0 ? totalCasosEnPeriodo : 1;
    const aggregatedList = Object.values(groupMap).map(item => {
      const pctNumber = (item.frecuencia / safeTotal) * 100;
      return {
        codigoDiagnostico: item.codigoDiagnostico,
        diagnostico: item.diagnostico,
        frecuencia: item.frecuencia,
        pacientesCount: item.pacientesSet.size,
        porcentajeNumero: pctNumber,
        porcentaje: `${pctNumber.toFixed(2)} %`,
        oficina: Array.from(item.sucursalesSet).join(", ") || "SEDE PRINCIPAL",
        casosDetalle: item.casosDetalle
      };
    });

    // Ordenar de mayor a menor frecuencia
    aggregatedList.sort((a, b) => b.frecuencia - a.frecuencia);

    // Asignar ranking numérico
    const rankedList = aggregatedList.map((item, idx) => ({
      ...item,
      ranking: idx + 1
    }));

    setMorbilidadList(rankedList);

    // 3. Aplicar búsqueda rápida y corte de Nro. Registros
    let displayList = [...rankedList];
    if (quickSearch && quickSearch.trim() !== "") {
      const term = quickSearch.toLowerCase().trim();
      displayList = displayList.filter(r =>
        r.codigoDiagnostico.toLowerCase().includes(term) ||
        r.diagnostico.toLowerCase().includes(term) ||
        r.oficina.toLowerCase().includes(term)
      );
    }

    const limit = parseInt(filters.nroRegistros, 10);
    if (!isNaN(limit) && limit > 0) {
      displayList = displayList.slice(0, limit);
    }

    setFilteredMorbilidad(displayList);
  };

  const handleSearchClick = () => {
    setHasSearched(true);
    const newFilters = {
      fechaInicial,
      fechaFinal,
      oficina,
      nroRegistros
    };
    setAppliedFilters(newFilters);
    processAndFilterReport(allExtractedCases, newFilters, tableSearchTerm);
  };

  const handleQuickSearchChange = (term) => {
    setTableSearchTerm(term);
    processAndFilterReport(allExtractedCases, appliedFilters, term);
  };

  // KPIs calculados
  const totalCasosAuditados = useMemo(() => {
    return filteredMorbilidad.reduce((acc, curr) => acc + curr.frecuencia, 0);
  }, [filteredMorbilidad]);

  const totalPatologiasDistintas = useMemo(() => {
    return filteredMorbilidad.length;
  }, [filteredMorbilidad]);

  const patologiaPredominante = useMemo(() => {
    if (filteredMorbilidad.length === 0) return null;
    return filteredMorbilidad[0];
  }, [filteredMorbilidad]);

  const totalPacientesAfectados = useMemo(() => {
    const pSet = new Set();
    filteredMorbilidad.forEach(item => {
      item.casosDetalle.forEach(c => {
        if (c.pacienteId) pSet.add(c.pacienteId);
      });
    });
    return pSet.size;
  }, [filteredMorbilidad]);

  // Exportar a Excel profesional
  const handleExportExcel = () => {
    if (filteredMorbilidad.length === 0) return;

    const summaryRows = filteredMorbilidad.map(r => ({
      "Posición": `#${r.ranking}`,
      "Código CIE-10": r.codigoDiagnostico,
      "Diagnóstico / Patología": r.diagnostico,
      "Frecuencia (Casos)": r.frecuencia,
      "Porcentaje": r.porcentaje,
      "Pacientes Afectados": r.pacientesCount,
      "Oficinas / Sucursales": r.oficina
    }));

    // Hoja con detalle paciente por paciente
    const detailRows = [];
    filteredMorbilidad.forEach(diag => {
      diag.casosDetalle.forEach(caso => {
        detailRows.push({
          "Código CIE-10": diag.codigoDiagnostico,
          "Patología": diag.diagnostico,
          "Fecha": format(caso.fecha, "dd/MM/yyyy HH:mm"),
          "Tipo Doc": caso.pacienteTipoDoc,
          "Documento": caso.pacienteDoc,
          "Paciente": caso.pacienteNombre,
          "Profesional": caso.profesional,
          "Sede": caso.oficina,
          "Origen Registro": caso.origen,
          "Notas Clínicas": caso.notas
        });
      });
    });

    const workbook = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, wsSummary, "Top Morbilidad");

    if (detailRows.length > 0) {
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(workbook, wsDetail, "Casos Auditados");
    }

    XLSX.writeFile(
      workbook,
      `Reporte_Morbilidad_Clinica_${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}.xlsx`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 overflow-hidden font-sans text-slate-700">
      
      {/* ─── ENCABEZADO Y ACCIONES PRINCIPALES (1:1 ESTÁNDAR ODONTOCLOUD) ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200/80 shrink-0 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FiActivity size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-800 tracking-tight">Reporte de morbilidad</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/70 text-emerald-700 border border-emerald-200/50">
                Datos Clínicos Reales
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>🏠 Reportes</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Reporte de morbilidad (CIE-10)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadClinicalMorbidityData()}
            title="Recargar datos clínicos"
            className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredMorbilidad.length === 0}
            className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <FiDownload size={13} />
            <span>Excel</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={filteredMorbilidad.length === 0}
            className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <FiPrinter size={13} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* ─── CONTENEDOR SCROLLABLE PRINCIPAL ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

        {/* ─── ÁREA DE FILTROS (1:1 ORALDRIVE) ─── */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs shrink-0 print:hidden">
          
          {/* Fila 1: Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FiCalendar className="text-slate-400" size={12} />
                <span>Fecha Inicial</span>
              </label>
              <input
                type="date"
                value={fechaInicial}
                onChange={(e) => setFechaInicial(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                max="9999-12-31"
                min="1900-01-01"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FiCalendar className="text-slate-400" size={12} />
                <span>Fecha final</span>
              </label>
              <input
                type="date"
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                max="9999-12-31"
                min="1900-01-01"
              />
            </div>
          </div>

          {/* Fila 2: Oficina + Nro. Registros + Botón Buscar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Oficina
              </label>
              <select
                value={oficina}
                onChange={(e) => setOficina(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all uppercase"
              >
                <option value="Todas las oficinas">Todas las oficinas</option>
                {sucursalesList
                  .filter(s => s.id !== "TODAS")
                  .map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>Nro. Registros</span>
                <span className="text-slate-400 text-[10px] cursor-help" title="Cantidad máxima de diagnósticos odontológicos a mostrar en el top">ⓘ</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["10", "20", "50", "100"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNroRegistros(n)}
                    className={`h-9 rounded-lg text-xs font-bold transition-all border ${
                      nroRegistros === n
                        ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-1">
              <button
                onClick={handleSearchClick}
                disabled={loading}
                className="w-full h-9 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-[0.98] text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FiSearch size={14} />
                <span>Buscar</span>
              </button>
            </div>

          </div>

        </div>

        {/* ─── TARJETAS KPI RESUMEN EJECUTIVO (DATOS REALES) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <FiActivity size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Casos Auditados
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalCasosAuditados}
                </span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                  100% Reales
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FiLayers size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Patologías Distintas
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalPatologiasDistintas}
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  CIE-10 Únicos
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FiTrendingUp size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Patología Principal
              </span>
              {patologiaPredominante ? (
                <div>
                  <span className="text-xs font-black text-slate-800 truncate block" title={patologiaPredominante.diagnostico}>
                    {patologiaPredominante.codigoDiagnostico} — {patologiaPredominante.diagnostico}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">
                    {patologiaPredominante.frecuencia} casos ({patologiaPredominante.porcentaje})
                  </span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-slate-400">Sin datos en el periodo</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FiUsers size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pacientes Diagnosticados
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {totalPacientesAfectados}
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  Individuos
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ─── TABLA DE RESULTADOS DATAGRID (SÓLIDA Y PROFESIONAL) ─── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          
          {/* Barra de herramientas superior */}
          <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Top Diagnósticos de Morbilidad ({filteredMorbilidad.length} registros)
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                • Periodo: {appliedFilters.fechaInicial} al {appliedFilters.fechaFinal}
              </span>
            </div>

            <div className="flex items-center gap-2 relative">
              {/* Botón Selector de Columnas */}
              <div className="relative">
                <button 
                  title="Selector de columnas" 
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`p-1.5 rounded-lg border transition-all ${
                    showColumnSelector 
                      ? 'bg-sky-50 text-sky-700 border-sky-200' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <FiFileText size={14} />
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 top-9 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 animate-fadeIn">
                    <div className="text-[11px] font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                      <span>Seleccionar columnas</span>
                      <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {Object.keys(visibleColumns).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns[key]}
                            onChange={() => toggleColumn(key)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{columnLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Buscador rápido */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Filtrar por CIE-10 o nombre..."
                  value={tableSearchTerm}
                  onChange={(e) => handleQuickSearchChange(e.target.value)}
                  className="h-8 pl-8 pr-3 w-56 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-14 text-slate-400">
                <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-bold text-slate-600">Extrayendo y consolidando morbilidad clínica real...</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Consultando documentos clínicos, evoluciones y atenciones</span>
              </div>
            ) : filteredMorbilidad.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
                  <FiAlertCircle size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Sin datos de morbilidad registrados en este periodo</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                  No se encontraron diagnósticos CIE-10 en las consultas, evoluciones o atenciones de la sede seleccionada entre {appliedFilters.fechaInicial} y {appliedFilters.fechaFinal}.
                </p>
                <button
                  onClick={() => {
                    setFechaInicial("2020-04-22");
                    setFechaFinal(format(new Date(), "yyyy-MM-dd"));
                    setOficina("Todas las oficinas");
                    handleSearchClick();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                >
                  Ampliar rango de fechas
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    {visibleColumns.ranking && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 text-center w-14">
                        #
                      </th>
                    )}
                    {visibleColumns.codigoDiagnostico && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap w-36">
                        Código CIE-10
                      </th>
                    )}
                    {visibleColumns.diagnostico && (
                      <th className="px-4 py-2.5 border-r border-slate-200/70">
                        Diagnóstico / Patología
                      </th>
                    )}
                    {visibleColumns.frecuencia && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 text-center whitespace-nowrap w-28">
                        Frecuencia / Casos
                      </th>
                    )}
                    {visibleColumns.porcentaje && (
                      <th className="px-4 py-2.5 border-r border-slate-200/70 whitespace-nowrap w-44">
                        Porcentaje (%)
                      </th>
                    )}
                    {visibleColumns.pacientes && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 text-center whitespace-nowrap w-28">
                        Pacientes
                      </th>
                    )}
                    {visibleColumns.oficina && (
                      <th className="px-3.5 py-2.5 border-r border-slate-200/70 whitespace-nowrap">
                        Oficina / Sucursal
                      </th>
                    )}
                    {visibleColumns.acciones && (
                      <th className="px-3 py-2.5 text-center whitespace-nowrap w-28 print:hidden">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredMorbilidad.map((r) => {
                    const isTop1 = r.ranking === 1;
                    const isTop2 = r.ranking === 2;
                    const isTop3 = r.ranking === 3;

                    return (
                      <tr key={`${r.codigoDiagnostico}_${r.ranking}`} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* Ranking */}
                        {visibleColumns.ranking && (
                          <td className="px-3.5 py-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                            {isTop1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-black text-[11px] shadow-2xs">
                                🥇
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-black text-[11px]">
                                🥈
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-800 font-black text-[11px]">
                                🥉
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold text-xs">
                                #{r.ranking}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Código CIE-10 */}
                        {visibleColumns.codigoDiagnostico && (
                          <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap font-mono font-bold">
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 text-[11px]">
                              {r.codigoDiagnostico}
                            </span>
                          </td>
                        )}

                        {/* Diagnóstico */}
                        {visibleColumns.diagnostico && (
                          <td className="px-4 py-2.5 border-r border-slate-100 font-semibold text-slate-800">
                            <div>{r.diagnostico}</div>
                          </td>
                        )}

                        {/* Frecuencia */}
                        {visibleColumns.frecuencia && (
                          <td className="px-3.5 py-2.5 border-r border-slate-100 text-center whitespace-nowrap font-bold text-slate-900">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                              {r.frecuencia}
                            </span>
                          </td>
                        )}

                        {/* Porcentaje con barra visual */}
                        {visibleColumns.porcentaje && (
                          <td className="px-4 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(r.porcentajeNumero, 100)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-emerald-700 w-12 text-right">
                                {r.porcentaje}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Pacientes Afectados */}
                        {visibleColumns.pacientes && (
                          <td className="px-3.5 py-2.5 border-r border-slate-100 text-center whitespace-nowrap text-slate-600 font-semibold">
                            {r.pacientesCount}
                          </td>
                        )}

                        {/* Oficina */}
                        {visibleColumns.oficina && (
                          <td className="px-3.5 py-2.5 border-r border-slate-100 uppercase text-[11px] text-slate-600 whitespace-nowrap">
                            {r.oficina}
                          </td>
                        )}

                        {/* Acciones */}
                        {visibleColumns.acciones && (
                          <td className="px-3 py-2.5 text-center whitespace-nowrap print:hidden">
                            <button
                              onClick={() => setSelectedCaseModal(r)}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 transition-all"
                              title="Ver detalle de casos clínicos"
                            >
                              <FiEye size={12} />
                              <span>Ver Casos</span>
                            </button>
                          </td>
                        )}

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla */}
          {filteredMorbilidad.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <span>
                Mostrando el top <strong>{filteredMorbilidad.length}</strong> diagnósticos más frecuentes.
              </span>
              <span className="font-semibold text-slate-700">
                Total acumulado en vista: {totalCasosAuditados} atenciones ({((totalCasosAuditados / (totalCasosAuditados || 1)) * 100).toFixed(0)}%)
              </span>
            </div>
          )}

        </div>

      </div>

      {/* ─── MODAL AUDITORÍA DE CASOS CLÍNICOS DETALLADOS ─── */}
      {selectedCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Cabecera del modal */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md bg-sky-100 text-sky-800 font-mono font-bold text-xs border border-sky-200">
                  {selectedCaseModal.codigoDiagnostico}
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    {selectedCaseModal.diagnostico}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Auditoría de {selectedCaseModal.casosDetalle.length} casos clínicos registrados
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedCaseModal(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Lista detallada de casos */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Paciente</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Profesional Tratante</th>
                    <th className="px-3 py-2">Sede</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">Notas / Procedimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {selectedCaseModal.casosDetalle.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-500">
                        {isValid(c.fecha) ? format(c.fecha, "dd/MM/yyyy HH:mm") : "—"}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-800">
                        {c.pacienteNombre}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {c.pacienteTipoDoc} {c.pacienteDoc}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        {c.profesional}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap uppercase text-[11px] text-slate-500">
                        {c.oficina}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {c.origen}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-xs truncate" title={c.notas}>
                        {c.notas || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pie del modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedCaseModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
