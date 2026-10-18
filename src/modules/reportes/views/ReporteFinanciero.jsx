import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser, getPatientAssignedDoctors } from "../../../utils/doctorHelpers";
import { getDoctorsList } from "../../../services/supabaseServices";
import { getConfigItems, getConfigSection } from "../../../services/configPersistenceService";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";
import { printReciboCaja, printElectronicInvoice } from "../../../utils/electronicInvoiceTemplate";
import { FiDollarSign, FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX, FiEye, FiPrinter, FiRefreshCw } from "react-icons/fi";
import { format } from "date-fns";
import XLSX from "xlsx-js-style";

const cleanObservaciones = (rawVal) => {
  if (!rawVal) return "";
  if (typeof rawVal === "object") {
    const obs = rawVal.observaciones || rawVal.notas || rawVal.comentario || "";
    return typeof obs === "string" ? obs.trim() : "";
  }
  if (typeof rawVal === "string") {
    const trimmed = rawVal.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        const obs = parsed.observaciones || parsed.notas || parsed.comentario || "";
        if (typeof obs === "string") {
          return (obs === "SALDO A FAVOR" || obs === "Recibo de caja") ? "" : obs.trim();
        }
        return "";
      } catch (e) {
        return "";
      }
    }
    return trimmed;
  }
  return String(rawVal);
};

const cleanDocReferencia = (ref, defaultCode) => {
  if (!ref) return defaultCode || "—";
  if (typeof ref === "string" && ref.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(ref);
      return parsed.referencia || parsed.nroRecibo || parsed.comprobante || defaultCode || "—";
    } catch (e) {
      return defaultCode || "—";
    }
  }
  return String(ref).trim() || defaultCode || "—";
};

const TIPO_MOVIMIENTO_OPTIONS = [
  "Seleccione",
  "Todos",
  "Recibo de caja+",
  "Factura de venta+",
  "Factura de compra",
  "Egreso-",
  "Traslado+",
  "Traslado-",
  "Nota crédito+",
  "Nota débito-",
  "Anticipo+",
  "Saldo a favor+"
];

export default function ReporteFinanciero() {
  const { userProfile } = useAuth();
  const [allTransactions, setAllTransactions] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [oficinasList, setOficinasList] = useState([
    { id: "TODAS", nombre: "Todas las oficinas" }
  ]);
  const [loading, setLoading] = useState(true);
  const [clinicInfo, setClinicInfo] = useState({
    nombre: userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenantNombre || userProfile?.clinica || "Clínica Dental",
    nit: userProfile?.tenant?.nit || ""
  });

  // Filtros del formulario superior (1:1 con OralDrive)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [isAllHistory, setIsAllHistory] = useState(false);
  const [oficina, setOficina] = useState("Todas las oficinas");
  const [tipoMovimiento, setTipoMovimiento] = useState("Seleccione");
  const [informacionContable, setInformacionContable] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  // Estado de búsqueda
  const [hasSearched, setHasSearched] = useState(true);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    isAllHistory: false,
    oficina: "Todas las oficinas",
    tipoMovimiento: "Seleccione",
    informacionContable: false,
    profesional: "Todos"
  });

  // Modal de Detalle Documento (Ojito)
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Búsqueda rápida global
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  // Filtros individuales por columna
  const [columnFilters, setColumnFilters] = useState({});

  // Control selector de columnas
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Referencias para calendar pickers
  const fechaIniPickerRef = useRef(null);
  const fechaFinPickerRef = useRef(null);
  const tableContainerRef = useRef(null);

  // 22 Columnas completas 1:1 con OralDrive
  const [visibleColumns, setVisibleColumns] = useState({
    numeroDocumento: true,
    tipoDocumento: true,
    fechaCreacion: true,
    fechaSeleccionada: true,
    concepto: true,
    valor: true,
    consecutivo: true,
    docReferencia: true,
    documentosAsociados: true,
    estado: true,
    tercero: true,
    documentoTercero: true,
    profesional: true,
    formaPago: true,
    subtotal: true,
    descuento: true,
    iva: true,
    retencion: true,
    total: true,
    usuarioCreador: true,
    observaciones: true,
    cuentaContable: false
  });

  const columnLabels = {
    numeroDocumento: "Numero de documento",
    tipoDocumento: "Tipo de documento",
    fechaCreacion: "Fecha creación",
    fechaSeleccionada: "Fecha seleccionada",
    concepto: "Concepto",
    valor: "Valor",
    consecutivo: "Consecutivo",
    docReferencia: "Doc. Referencia",
    documentosAsociados: "Documentos asociados",
    estado: "Estado",
    tercero: "Tercero / Paciente",
    documentoTercero: "Documento tercero",
    profesional: "Profesional",
    formaPago: "Forma de pago",
    subtotal: "Subtotal",
    descuento: "Descuento",
    iva: "IVA",
    retencion: "Retención",
    total: "Total",
    usuarioCreador: "Elaborado por",
    observaciones: "Observaciones",
    cuentaContable: "Cuenta contable"
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

  // Carga paralela masiva optimizada desde el VPS
  const fetchData = useCallback(async () => {
    const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
    if (!tenantId) return;
    setLoading(true);

    try {
      // Consultas simultáneas con Promise.all
      const [
        sucursalesRes,
        pacientesRes,
        profilesRes,
        docsFromService,
        recibosRes,
        pagosRes,
        movsRes,
        facturasRes,
        facturasElecRes,
        facturasCompraRes,
        notasCreditoRes,
        notasDebitoRes,
        saldosFavorRes,
        trasladosRes,
        pagosProvRes,
        cfgRes,
        cfgFacturasCompra,
        cfgPagosProv,
        tenantRes,
        empresaConfigRes
      ] = await Promise.all([
        getConfigItems(tenantId, "sucursales", "sucursales").catch(() => []),
        supabase.from("pacientes").select("*").eq("tenant_id", tenantId),
        supabase.from("profiles").select("*").eq("tenant_id", tenantId),
        getDoctorsList(userProfile || { inquilino: tenantId }).catch(() => []),
        supabase.from("recibos_caja").select("*").eq("tenant_id", tenantId),
        supabase.from("pagos").select("*").eq("tenant_id", tenantId),
        supabase.from("movimientos_caja").select("*").eq("tenant_id", tenantId),
        supabase.from("facturas").select("*").eq("tenant_id", tenantId),
        supabase.from("facturas_electronicas").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("facturas_compra").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("notas_credito").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("notas_debito").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("saldos_favor").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("traslados").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("pagos_proveedor").select("*").eq("tenant_id", tenantId).then(r => r, () => ({ data: [] })),
        supabase.from("website_config").select("config").eq("tenant_id", tenantId).maybeSingle().then(r => r, () => ({ data: null })),
        getConfigSection(tenantId, "facturas_compra", []).catch(() => []),
        getConfigSection(tenantId, "pagos_proveedor", []).catch(() => []),
        supabase.from("tenants").select("id, nombre, nit, direccion, telefono, logo_url").eq("id", tenantId).maybeSingle().then(r => r, () => ({ data: null })),
        getConfigSection(tenantId, "empresa_datos", {}).catch(() => ({}))
      ]);

      // 0. Sincronizar datos reales de la Clínica / Institución
      const tData = tenantRes?.data || {};
      const cData = empresaConfigRes || {};
      const resolvedClinicName = cData.nombreComercial || cData.nombre || tData.nombre || userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenantNombre || userProfile?.clinica || "Clínica Dental";
      const resolvedClinicNit = cData.nit || tData.nit || userProfile?.tenant?.nit || "";
      setClinicInfo({ nombre: resolvedClinicName, nit: resolvedClinicNit });

      // 1. Armar Sedes / Oficinas
      const sedesList = [{ id: "TODAS", nombre: "Todas las oficinas" }];
      (sucursalesRes || []).forEach(s => {
        const nom = s.nombre || s.name || s.nombreSede || "Sede";
        if (nom && !sedesList.some(item => item.nombre.toLowerCase() === nom.toLowerCase())) {
          sedesList.push({ id: s.id || nom, nombre: nom });
        }
      });
      if (sedesList.length === 1) {
        const myClinic = userProfile?.nombreClinica || userProfile?.tenant_nombre || "SEDE PRINCIPAL";
        sedesList.push({ id: "PRINCIPAL", nombre: `${myClinic} - SEDE PRINCIPAL` });
      }
      setOficinasList(sedesList);

      // 2. Diccionario de Pacientes
      const pacDict = {};
      (pacientesRes?.data || []).forEach(p => {
        const nom = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || p.documento || "Paciente";
        const doc = p.documento || p.nroDocumento || p.identificacion || p.nro_historia || "";
        const pacObj = {
          ...p,
          id: p.id,
          nombreCompleto: nom,
          nroDocumento: doc,
          tipoDocumento: p.tipoDocumento || p.tipo_documento || "CC",
          direccion: p.direccion || p.lugarResidencia || p.lugar_residencia || p.barrio || "—",
          ciudad: p.ciudad || p.ciudadDomicilio || p.ciudad_domicilio || p.municipio || "Montería",
          celular: p.celular || p.telefono || p.telefono_movil || p.movil || "—"
        };
        pacDict[p.id] = pacObj;
        if (doc) pacDict[doc] = pacObj;
      });

      // 3. Catálogo de Profesionales
      const listProfs = [];
      const profDict = {};
      const nonDoctorIdentifiers = new Set();

      (profilesRes?.data || []).forEach((u) => {
        const primerNombre = u.nombre || u.nombres || u.displayName || u.full_name || u.email || "";
        const primerApellido = u.apellido || u.apellidos || "";
        const nombreCompleto = `${primerNombre} ${primerApellido}`.trim() || u.email;

        if (isDoctorUser(u)) {
          listProfs.push({
            id: u.id,
            nombre: nombreCompleto,
            allNames: [
              String(u.id).toLowerCase(),
              nombreCompleto.toLowerCase(),
              primerNombre.toLowerCase(),
              primerApellido.toLowerCase(),
              (u.email || "").toLowerCase()
            ].filter(Boolean)
          });
          profDict[u.id] = nombreCompleto;
          profDict[nombreCompleto.toLowerCase()] = nombreCompleto;
        } else {
          if (u.id) nonDoctorIdentifiers.add(String(u.id).toLowerCase());
          if (nombreCompleto) nonDoctorIdentifiers.add(nombreCompleto.toLowerCase());
          if (primerNombre) nonDoctorIdentifiers.add(primerNombre.toLowerCase());
          if (u.email) nonDoctorIdentifiers.add(u.email.toLowerCase());
        }
      });

      (docsFromService || []).forEach(d => {
        const nom = d.nombreCompleto || d.nombre || "";
        if (nom && !listProfs.some(p => String(p.id) === String(d.id))) {
          listProfs.push({
            id: d.id,
            nombre: nom,
            allNames: [String(d.id).toLowerCase(), nom.toLowerCase(), (d.email || "").toLowerCase()].filter(Boolean)
          });
        }
        if (d.id && nom) profDict[d.id] = nom;
        if (nom) profDict[nom.toLowerCase()] = nom;
      });

      setProfesionales(listProfs);

      const resolveDoctorName = (profVal, profIdVal, pacObj = null) => {
        const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || "").trim());
        const targetId = String(profIdVal || "").trim().toLowerCase();
        const targetVal = String(profVal || "").trim();
        const targetValLower = targetVal.toLowerCase();

        if (profIdVal && profDict[profIdVal]) return profDict[profIdVal];
        if (targetId && profDict[targetId]) return profDict[targetId];
        if (profVal && profDict[profVal]) return profDict[profVal];
        if (targetValLower && profDict[targetValLower]) return profDict[targetValLower];

        const isKnownAdmin = 
          (targetId && nonDoctorIdentifiers.has(targetId)) ||
          (targetValLower && nonDoctorIdentifiers.has(targetValLower)) ||
          targetValLower.includes("juan madrid") ||
          targetValLower.includes("administra") ||
          targetValLower === "admin";

        if (isKnownAdmin) {
          if (pacObj) {
            const assignedDocs = getPatientAssignedDoctors(pacObj);
            if (assignedDocs && assignedDocs.length > 0) {
              const assignedNom = assignedDocs[0]?.nombreCompleto || assignedDocs[0]?.nombre;
              if (assignedNom && (profDict[assignedNom] || profDict[assignedNom.toLowerCase()])) {
                return assignedNom;
              }
            }
          }
          return "Sin asignar";
        }

        if (targetId) {
          const foundById = listProfs.find(p => String(p.id).toLowerCase() === targetId || p.allNames?.includes(targetId));
          if (foundById) return foundById.nombre;
        }

        if (targetValLower && targetValLower !== "—" && !isUUID(targetVal)) {
          const foundByName = listProfs.find(p => 
            p.allNames?.some(n => n === targetValLower || n.includes(targetValLower) || targetValLower.includes(n))
          );
          if (foundByName) return foundByName.nombre;
        }

        if (pacObj) {
          const assignedDocs = getPatientAssignedDoctors(pacObj);
          if (assignedDocs && assignedDocs.length > 0) {
            const assignedNom = assignedDocs[0]?.nombreCompleto || assignedDocs[0]?.nombre;
            if (assignedNom && (profDict[assignedNom] || profDict[assignedNom.toLowerCase()])) {
              return assignedNom;
            }
          }
        }

        return "Sin asignar";
      };

      const allRows = [];

      // Helper para detectar Saldo a Favor
      const checkIsSaldoFavor = (conceptoStr, notasStr, metodoStr, tipoDocStr) => {
        const full = `${conceptoStr || ''} ${notasStr || ''} ${metodoStr || ''} ${tipoDocStr || ''}`.toLowerCase();
        return full.includes("saldo a favor") || full.includes("s. a favor");
      };

      // Helper para detectar Anticipo
      const checkIsAnticipo = (conceptoStr, notasStr, metodoStr, tipoDocStr) => {
        const full = `${conceptoStr || ''} ${notasStr || ''} ${metodoStr || ''} ${tipoDocStr || ''}`.toLowerCase();
        return full.includes("anticipo");
      };

      // 4. Mapear Recibos de Caja (recibos_caja)
      const rawRecibosList = recibosRes?.data || [];
      const mappedRecibosCaja = (rawRecibosList || []).map(d => {
        const pId = d.paciente_id || d.pacienteId || d.patient_id || d.paciente;
        const pac = pacDict[pId] || {};
        const pacNom = d.pacienteNombre || pac.nombreCompleto || "Paciente";
        const pacDoc = d.pacienteDocumento || pac.nroDocumento || "";
        const montoNum = Number(d.total || d.monto || d.valor || 0);
        const isAnulado = (d.estado || "").toLowerCase() === "anulado";
        const rawObs = d.observaciones || d.notas || "";
        const conc = d.concepto || d.motivo || (Array.isArray(d.conceptos) && d.conceptos[0]?.concepto) || d.descripcion || "Recibo de caja";
        const medio = d.medioPago || d.condicionPago || d.medio || "Efectivo";

        const isSF = checkIsSaldoFavor(conc, rawObs, medio, d.tipoDoc);
        const isAnt = checkIsAnticipo(conc, rawObs, medio, d.tipoDoc);

        let finalTipo = "Recibo de caja+";
        if (isSF) finalTipo = "Saldo a favor+";
        else if (isAnt) finalTipo = "Anticipo+";

        return {
          id: `rec_${d.id}`,
          rawId: d.id,
          pacienteId: pId,
          pacienteObj: pac,
          tipoDocumento: finalTipo,
          fechaCreacion: d.created_at || d.fecha || new Date().toISOString(),
          fechaSeleccionada: d.fecha || d.created_at || new Date().toISOString(),
          concepto: conc,
          valor: montoNum,
          consecutivo: "Principal",
          nroConsecutivo: d.nroConsecutivo || d.consecutivo || d.numero || null,
          docReferencia: d.referencia || d.comprobante || "",
          documentosAsociados: d.plan_id ? `PLAN-${String(d.plan_id).slice(0, 6).toUpperCase()}` : "—",
          planId: d.plan_id || null,
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: pacNom,
          documentoTercero: pacDoc,
          profesional: resolveDoctorName(d.profesionalNombre || d.doctorNombre || d.profesional || d.doctor, d.profesional_id || d.profesionalId || d.doctorId, pac),
          profesionalId: d.profesional_id || d.profesionalId || d.doctorId || "",
          formaPago: medio,
          subtotal: montoNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: montoNum,
          usuarioCreador: d.usuario_nombre || d.creado_por || "Administración",
          observaciones: cleanObservaciones(rawObs),
          cuentaContable: isSF ? "280505 - Anticipos y Saldos a Favor" : "110505 - Caja General",
          oficina: d.oficina || d.sucursal || d.sede || "",
          _raw: d
        };
      });

      // 5. Mapear Pagos (pagos)
      const rawPagosList = pagosRes?.data || [];
      const mappedPagosRecaudos = (rawPagosList || []).map(pData => {
        let metadata = {};
        if (pData.notas && typeof pData.notas === "string" && pData.notas.trim().startsWith("{")) {
          try { metadata = JSON.parse(pData.notas); } catch (e) {}
        } else if (pData.notas && typeof pData.notas === "object") {
          metadata = pData.notas;
        }

        const pacId = pData.paciente_id || pData.pacienteId || metadata.paciente_id || pData.paciente;
        const pac = pacDict[pacId] || pacDict[pData.documento] || pacDict[pData.pacienteDocumento] || {};
        const pacNom = pData.patientNombre || pData.pacienteNombre || metadata.patientNombre || pac.nombreCompleto || pData.patientName || pData.nombrePaciente || "Paciente";
        const pacDoc = pac.nroDocumento || pac.documento || pData.documento || pData.pacienteDocumento || "";
        const montoNum = Number(pData.monto || pData.valor || 0);
        const isAnulado = (pData.estado || "").toLowerCase() === "anulado" || (metadata.anulado === true) || (pData.referencia || "").includes("ANULADO");
        const medioRaw = pData.metodo || pData.medio || metadata.metodo || metadata.medio || "Efectivo";
        const storedCons = metadata.nroConsecutivo || pData.nroConsecutivo || pData.nro_consecutivo || pData.nroRecibo || pData.numeroRecibo || null;
        const rawObs = pData.observaciones || pData.notas || "";
        const conc = metadata.concepto || pData.concepto || (Array.isArray(pData.items) && pData.items[0]?.concepto) || pData.descripcion || "Abono a tratamiento";

        const isSF = checkIsSaldoFavor(conc, rawObs, medioRaw, metadata.tipoDoc);
        const isAnt = checkIsAnticipo(conc, rawObs, medioRaw, metadata.tipoDoc);

        let finalTipo = "Recibo de caja+";
        if (isSF) finalTipo = "Saldo a favor+";
        else if (isAnt) finalTipo = "Anticipo+";

        return {
          id: `pago_${pData.id}`,
          rawId: pData.id,
          pacienteId: pacId || pac.id || "",
          pacienteObj: pac,
          tipoDocumento: finalTipo,
          fechaCreacion: pData.created_at || pData.fechaISO || pData.fecha || new Date().toISOString(),
          fechaSeleccionada: pData.fechaISO || pData.fecha || pData.created_at || new Date().toISOString(),
          concepto: conc,
          valor: montoNum,
          consecutivo: "Principal",
          nroConsecutivo: storedCons,
          docReferencia: metadata.referencia || pData.referencia || "",
          documentosAsociados: pData.plan_id ? `PLAN-${String(pData.plan_id).slice(0, 6).toUpperCase()}` : "—",
          planId: pData.plan_id || null,
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: pacNom,
          documentoTercero: pacDoc,
          profesional: resolveDoctorName(metadata.doctor || pData.profesional || pData.odontologo || pData.doctor, pData.profesional_id || pData.doctorId, pac),
          profesionalId: pData.profesional_id || pData.doctorId || "",
          formaPago: medioRaw,
          subtotal: montoNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: montoNum,
          usuarioCreador: pData.usuario_nombre || pData.creado_por || "Administración",
          observaciones: cleanObservaciones(rawObs),
          cuentaContable: isSF ? "280505 - Anticipos y Saldos a Favor" : "110505 - Caja General",
          oficina: pData.oficina || pData.sucursal || pData.sede || "",
          _raw: pData,
          _meta: metadata
        };
      });

      // Normalizar duplicados entre recibos_caja y pagos
      const normalizeReceiptNum = (val) => {
        if (val === null || val === undefined || val === "") return "";
        const str = String(val).trim();
        const clean = str.replace(/^[^\d]+/, "");
        return /^\d+$/.test(clean) ? String(parseInt(clean, 10)) : str.toLowerCase();
      };

      const existingReceiptNums = new Set(
        mappedRecibosCaja.map(r => normalizeReceiptNum(r.nroConsecutivo || r.consecutivo || r.numero)).filter(Boolean)
      );
      const existingPagoIds = new Set(
        mappedRecibosCaja.flatMap(r => [r._raw?.pago_id, r._raw?.pagoId, r.pago_id, r.pagoId]).filter(Boolean).map(String)
      );
      const existingRecKeys = new Set(
        mappedRecibosCaja.map(r => `${r.pacienteId}_${Math.round(r.total || 0)}_${normalizeReceiptNum(r.nroConsecutivo || r.consecutivo)}`).filter(Boolean)
      );

      const uniquePagosRecaudos = mappedPagosRecaudos.filter(p => {
        const rawId = String(p._raw?.id || p.rawId || p.id || "").replace(/^pago_/, "");
        const num = normalizeReceiptNum(p.nroConsecutivo || p._raw?.nro_consecutivo || p._meta?.nroConsecutivo);
        const key = `${p.pacienteId}_${Math.round(p.total || 0)}_${num}`;
        if (rawId && existingPagoIds.has(rawId)) return false;
        if (num && existingReceiptNums.has(num)) return false;
        if (key && existingRecKeys.has(key)) return false;
        return true;
      });

      // Combinar recibos y asignar consecutivos limpios
      let combinedRecibos = [...mappedRecibosCaja, ...uniquePagosRecaudos];
      combinedRecibos.sort((a, b) => new Date(a.fechaCreacion || 0) - new Date(b.fechaCreacion || 0));

      const baseConsecutivoRecibos = 1999;
      combinedRecibos.forEach((item, idx) => {
        const cleanConsecutivo = item.nroConsecutivo && !isNaN(Number(item.nroConsecutivo))
          ? Number(item.nroConsecutivo)
          : (baseConsecutivoRecibos + idx);

        allRows.push({
          ...item,
          numeroDocumento: cleanConsecutivo,
          nroConsecutivo: cleanConsecutivo,
          docReferencia: item.docReferencia || `FCEV${cleanConsecutivo + 50}`
        });
      });

      // 6. Cargar Movimientos de Caja (Egresos, Compras a proveedores, Traslados)
      const snapMovs = movsRes?.data || [];
      const cajaEgresosList = [];
      let egresoIdx = 1001;
      let trasladoIdx = 101;
      let compraIdx = 501;

      (snapMovs || []).forEach(m => {
        const montoNum = Number(m.monto || 0);
        const tipo = (m.tipo || "").toLowerCase();
        const conceptoLower = (m.concepto || "").toLowerCase();
        const descLower = (m.descripcion || "").toLowerCase();

        // Evitar duplicar ingresos que ya fueron agregados como recibos
        if (tipo === "ingreso") {
          const isSaldoFavMov = conceptoLower.includes("saldo a favor") || descLower.includes("saldo a favor");
          const isAnticipoMov = conceptoLower.includes("anticipo") || descLower.includes("anticipo");
          
          // Si es un saldo a favor en caja que no estaba en recibos, agregarlo
          if (isSaldoFavMov && !allRows.some(r => Math.abs(r.total - montoNum) < 1 && (r.tercero?.toLowerCase().includes(m.paciente_nombre?.toLowerCase() || '')))) {
            allRows.push({
              id: `mov_sf_${m.id}`,
              rawId: m.id,
              numeroDocumento: m.recibo_id || `SF-${egresoIdx++}`,
              tipoDocumento: "Saldo a favor+",
              fechaCreacion: m.created_at || new Date().toISOString(),
              fechaSeleccionada: m.created_at || new Date().toISOString(),
              concepto: m.concepto || "Ingreso Saldo a Favor",
              valor: montoNum,
              consecutivo: "Principal",
              docReferencia: m.referencia || "SF",
              documentosAsociados: "—",
              estado: "Activo",
              tercero: m.paciente_nombre || "Paciente",
              documentoTercero: "",
              profesional: "Administración",
              profesionalId: "",
              formaPago: m.metodo_pago || "Efectivo",
              subtotal: montoNum,
              descuento: 0,
              iva: 0,
              retencion: 0,
              total: montoNum,
              usuarioCreador: "Administración",
              observaciones: m.descripcion || "Saldo a favor registrado en caja",
              cuentaContable: "280505 - Anticipos y Saldos a Favor",
              oficina: ""
            });
          }
          return;
        }

        // Detección de Traslado
        if (tipo === "traslado") {
          // Genera Traslado- (salida)
          allRows.push({
            id: `mov_tra_sal_${m.id}`,
            rawId: m.id,
            numeroDocumento: `TRA-${trasladoIdx}`,
            tipoDocumento: "Traslado-",
            fechaCreacion: m.created_at || new Date().toISOString(),
            fechaSeleccionada: m.created_at || new Date().toISOString(),
            concepto: m.concepto || "Traslado de fondos (Salida de cuenta)",
            valor: montoNum,
            consecutivo: "Principal",
            docReferencia: m.referencia || `TRA-${trasladoIdx}`,
            documentosAsociados: "—",
            estado: "Activo",
            tercero: "Caja Origen",
            documentoTercero: "",
            profesional: "Administración",
            profesionalId: "",
            formaPago: m.metodo_pago || "Transferencia",
            subtotal: montoNum,
            descuento: 0,
            iva: 0,
            retencion: 0,
            total: montoNum,
            usuarioCreador: "Administración",
            observaciones: m.descripcion || "Traslado entre cuentas de la clínica",
            cuentaContable: "110505 - Caja General",
            oficina: ""
          });

          // Genera Traslado+ (entrada)
          allRows.push({
            id: `mov_tra_ent_${m.id}`,
            rawId: m.id,
            numeroDocumento: `TRA-${trasladoIdx++}`,
            tipoDocumento: "Traslado+",
            fechaCreacion: m.created_at || new Date().toISOString(),
            fechaSeleccionada: m.created_at || new Date().toISOString(),
            concepto: m.concepto || "Traslado de fondos (Entrada a cuenta)",
            valor: montoNum,
            consecutivo: "Principal",
            docReferencia: m.referencia || `TRA-${trasladoIdx}`,
            documentosAsociados: "—",
            estado: "Activo",
            tercero: "Caja Destino",
            documentoTercero: "",
            profesional: "Administración",
            profesionalId: "",
            formaPago: m.metodo_pago || "Transferencia",
            subtotal: montoNum,
            descuento: 0,
            iva: 0,
            retencion: 0,
            total: montoNum,
            usuarioCreador: "Administración",
            observaciones: m.descripcion || "Traslado entre cuentas de la clínica",
            cuentaContable: "111005 - Bancos",
            oficina: ""
          });
          return;
        }

        // Guardar egresos de caja para procesar con deduplicación rigurosa frente a pagos_proveedor
        cajaEgresosList.push(m);
      });

      // 6. Cargar Egresos Oficiales desde Administración > Facturación > Egresos (pagos_proveedor y website_config)
      const rawPagosProv = [
        ...(pagosProvRes?.data || []),
        ...(Array.isArray(cfgPagosProv) ? cfgPagosProv : []),
        ...((cfgRes?.data?.config?.pagos_proveedor) || [])
      ];
      const seenPagoProvIds = new Set();
      const egresoFingerprints = [];
      let egrProvIdx = 2001;

      rawPagosProv.forEach(pp => {
        if (!pp) return;
        const pId = pp.id || pp._id;
        if (pId && seenPagoProvIds.has(pId)) return;
        if (pId) seenPagoProvIds.add(pId);

        const montoNum = Number(pp.total || pp.monto || pp.valor || 0);
        const storedCons = pp.nroComprobante || pp.consecutivo || pp.numero || pp.nroConsecutivo;
        const nroDoc = storedCons ? String(storedCons).trim() : `EGR-${egrProvIdx++}`;
        const isAnulado = (pp.estado || "").toLowerCase() === "anulado" || pp.anulado;
        const rawObs = pp.observaciones || pp.notas || pp.motivo || "";
        const rawFecha = pp.fecha || pp.created_at || new Date().toISOString();

        // Extraer dígitos de consecutivo
        const numDigits = String(storedCons || "").replace(/\D/g, "");

        egresoFingerprints.push({
          id: pId,
          nroDoc: nroDoc.toLowerCase(),
          consecutivo: String(pp.consecutivo || pp.numero || "").toLowerCase(),
          consecutivoDigits: numDigits,
          monto: montoNum,
          concepto: String(pp.concepto || pp.descripcion || "").toLowerCase(),
          proveedor: String(pp.proveedor || pp.tercero || pp.beneficiario || "").toLowerCase(),
          fechaDay: rawFecha ? String(rawFecha).split("T")[0] : ""
        });

        allRows.push({
          id: `egr_pp_${pId || nroDoc}`,
          rawId: pId,
          numeroDocumento: nroDoc,
          tipoDocumento: "Egreso-",
          fechaCreacion: pp.created_at || pp.fecha || new Date().toISOString(),
          fechaSeleccionada: pp.fecha || pp.created_at || new Date().toISOString(),
          concepto: pp.concepto || pp.descripcion || `Pago a Proveedor: ${pp.proveedor || pp.beneficiario || 'Tercero'}`,
          valor: montoNum,
          consecutivo: "Principal",
          docReferencia: pp.referencia || pp.factura_asociada || String(nroDoc),
          documentosAsociados: pp.factura_asociada || "—",
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: pp.proveedor || pp.beneficiario || pp.tercero || "Proveedor / Tercero",
          documentoTercero: pp.nit || pp.documento || "",
          profesional: "Administración",
          profesionalId: "",
          formaPago: pp.medioPago || pp.bancoCaja || pp.formaPago || "Efectivo",
          subtotal: montoNum,
          descuento: 0,
          iva: 0,
          retencion: Number(pp.retencion || 0),
          total: montoNum,
          usuarioCreador: pp.usuario_nombre || pp.creado_por || "Administración",
          observaciones: cleanObservaciones(rawObs),
          cuentaContable: "510506 - Gastos y Pagos a Proveedores",
          oficina: pp.oficina || pp.sucursal || pp.sede || "",
          rawEgreso: pp
        });
      });

      // 6.1. Incorporar egresos exclusivos de caja menor (descartando espejos duplicados)
      egresoIdx = 1001;
      cajaEgresosList.forEach(m => {
        const montoNum = Number(m.monto || 0);
        const conceptoLower = String(m.concepto || m.descripcion || "").toLowerCase();
        const descLower = String(m.descripcion || "").toLowerCase();
        const refLower = String(m.referencia || "").toLowerCase();
        const storedCons = String(m.nroConsecutivo || m.consecutivo || m.comprobante || m.numero || "").trim();
        const mFechaDay = String(m.fecha || m.created_at || "").split("T")[0];

        // Extraer número de consecutivo dentro del concepto ej: "[EGR-1628]" o similar
        const matchCons = conceptoLower.match(/\[egr-?(\d+)\]/i) || refLower.match(/\[egr-?(\d+)\]/i);
        const consInConcept = matchCons ? matchCons[1] : "";
        const mDigits = storedCons.replace(/\D/g, "");

        // Deduplicación contra egresos oficiales registrados en pagos_proveedor
        const esDuplicado = egresoFingerprints.some(fp => {
          // 1. Coincidencia por consecutivo o comprobante
          if (mDigits && fp.consecutivoDigits && mDigits === fp.consecutivoDigits) return true;
          if (storedCons && (fp.consecutivo === storedCons.toLowerCase() || fp.nroDoc === storedCons.toLowerCase())) return true;
          if (consInConcept && (fp.consecutivoDigits === consInConcept || fp.nroDoc.includes(consInConcept))) return true;

          // 2. Coincidencia de prefijo "Pago a Proveedor" generado automáticamente por PagosForm
          if (conceptoLower.startsWith("pago a proveedor:") || refLower.startsWith("pago proveedor")) {
            if (Math.abs(fp.monto - montoNum) < 1) return true;
          }

          // 3. Coincidencia de monto + fecha exacta del mismo día + similitud
          if (Math.abs(fp.monto - montoNum) < 1 && mFechaDay && fp.fechaDay === mFechaDay) {
            return true;
          }

          return false;
        });

        if (esDuplicado) {
          // Espejo de caja que ya existe en pagos_proveedor con su número oficial (ej: EGR-1020). Descartar.
          return;
        }

        // Es un egreso independiente originado en caja menor
        const nroDoc = storedCons ? storedCons : `EGR-${egresoIdx++}`;
        const isAnulado = (m.estado || "").toLowerCase() === "anulado";
        const rawObs = m.observaciones || m.notas || m.descripcion || "";

        allRows.push({
          id: `mov_${m.id}`,
          rawId: m.id,
          numeroDocumento: nroDoc,
          tipoDocumento: "Egreso-",
          fechaCreacion: m.created_at || new Date().toISOString(),
          fechaSeleccionada: m.fecha || m.created_at || new Date().toISOString(),
          concepto: m.concepto || m.descripcion || "Egreso de caja menor",
          valor: montoNum,
          consecutivo: "Principal",
          docReferencia: m.referencia || String(nroDoc),
          documentosAsociados: m.factura_asociada || "—",
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: m.beneficiario || m.proveedor || "Caja Menor / Varios",
          documentoTercero: m.nit || m.documento || "",
          profesional: "Administración",
          profesionalId: "",
          formaPago: m.metodo_pago || m.forma_pago || "Efectivo",
          subtotal: montoNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: montoNum,
          usuarioCreador: m.usuario_nombre || m.creado_por || "Administración",
          observaciones: cleanObservaciones(rawObs),
          cuentaContable: "510506 - Gastos Operativos Caja Menor",
          oficina: m.oficina || m.sucursal || m.sede || "",
          rawEgreso: m
        });
      });

      // 6.2. Cargar Traslados de la tabla traslados
      const rawTraslados = [
        ...(trasladosRes?.data || []),
        ...((cfgRes?.data?.config?.traslados) || [])
      ];
      let tIdx = 301;
      rawTraslados.forEach(tr => {
        if (!tr || !tr.id) return;
        const montoNum = Number(tr.monto || tr.valor || 0);
        const yaExiste = allRows.some(r => (r.tipoDocumento === "Traslado+" || r.tipoDocumento === "Traslado-") && Math.abs(r.total - montoNum) < 1 && (r.docReferencia === tr.referencia || r.rawId === tr.id));
        if (yaExiste) return;

        const refDoc = tr.referencia || `TR-${tIdx++}`;
        const isAnulado = (tr.estado || "").toLowerCase() === "anulado";

        // Salida (Traslado-)
        allRows.push({
          id: `tra_sal_${tr.id}`,
          rawId: tr.id,
          numeroDocumento: refDoc,
          tipoDocumento: "Traslado-",
          fechaCreacion: tr.created_at || tr.fecha || new Date().toISOString(),
          fechaSeleccionada: tr.fecha || tr.created_at || new Date().toISOString(),
          concepto: tr.descripcion || `Traslado de fondos (${tr.origen} a ${tr.destino})`,
          valor: montoNum,
          consecutivo: "Principal",
          docReferencia: refDoc,
          documentosAsociados: "—",
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: tr.origen || "Caja Origen",
          documentoTercero: "",
          profesional: "Administración",
          profesionalId: "",
          formaPago: "Transferencia",
          subtotal: montoNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: montoNum,
          usuarioCreador: "Administración",
          observaciones: cleanObservaciones(tr.descripcion || ""),
          cuentaContable: "110505 - Caja General",
          oficina: ""
        });

        // Entrada (Traslado+)
        allRows.push({
          id: `tra_ent_${tr.id}`,
          rawId: tr.id,
          numeroDocumento: refDoc,
          tipoDocumento: "Traslado+",
          fechaCreacion: tr.created_at || tr.fecha || new Date().toISOString(),
          fechaSeleccionada: tr.fecha || tr.created_at || new Date().toISOString(),
          concepto: tr.descripcion || `Traslado de fondos (${tr.origen} a ${tr.destino})`,
          valor: montoNum,
          consecutivo: "Principal",
          docReferencia: refDoc,
          documentosAsociados: "—",
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: tr.destino || "Caja Destino",
          documentoTercero: "",
          profesional: "Administración",
          profesionalId: "",
          formaPago: "Transferencia",
          subtotal: montoNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: montoNum,
          usuarioCreador: "Administración",
          observaciones: cleanObservaciones(tr.descripcion || ""),
          cuentaContable: "111005 - Bancos",
          oficina: ""
        });
      });

      // 7. Cargar Facturas de Venta / Electrónicas (facturas)
      const snapFacturas = [...(facturasElecRes?.data || []), ...(facturasRes?.data || [])];
      const processedFacturaIds = new Set();

      // Mapeo exhaustivo de Recibos para 'Documentos asociados'
      const receiptsById = {};
      const receiptsByFacturaId = {};
      const receiptsByFacturaNumero = {};

      combinedRecibos.forEach((rec) => {
        const recNum = rec.numeroDocumento || rec.nroConsecutivo;

        if (rec.rawId) {
          receiptsById[rec.rawId] = rec;
        }

        const raw = rec._raw || {};
        let det = {};
        if (typeof raw.detalles === "string") {
          try { det = JSON.parse(raw.detalles); } catch {}
        } else if (raw.detalles && typeof raw.detalles === "object") {
          det = raw.detalles;
        }

        const meta = rec._meta || (typeof raw.notas === "string" && raw.notas.trim().startsWith("{")
          ? (() => { try { return JSON.parse(raw.notas); } catch { return {}; } })()
          : {});

        const linkedFacId = raw.factura_id || raw.facturaId || det.factura_id || det.facturaId || meta.factura_id || meta.facturaId || null;
        const linkedFacNum = raw.factura_numero || raw.facturaNumero || raw.factura || det.factura_numero || det.facturaNumero || meta.factura_numero || meta.facturaNumero || null;

        if (linkedFacId) {
          if (!receiptsByFacturaId[linkedFacId]) receiptsByFacturaId[linkedFacId] = [];
          receiptsByFacturaId[linkedFacId].push(rec);
        }
        if (linkedFacNum) {
          const clean = String(linkedFacNum).trim().toLowerCase();
          if (!receiptsByFacturaNumero[clean]) receiptsByFacturaNumero[clean] = [];
          receiptsByFacturaNumero[clean].push(rec);
        }
      });

      snapFacturas.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)).forEach((f, fIdx) => {
        if (processedFacturaIds.has(f.id)) return;
        processedFacturaIds.add(f.id);

        const pacId = f.paciente_id || f.pacienteId;
        const pac = pacDict[pacId] || pacDict[f.documento] || pacDict[f.pacienteDocumento] || {};
        const pacNom = f.pacienteNombre || f.paciente_nombre || pac.nombreCompleto || "Paciente";
        const pacDoc = f.pacienteDocumento || f.paciente_documento || pac.nroDocumento || "";

        const totalNum = Number(f.total || f.monto || 0);
        const subtotalNum = Number(f.subtotal || totalNum);
        const ivaNum = Number(f.iva || 0);
        const descNum = Number(f.descuento || 0);

        const storedCons = f.factusInvoiceNumber || f.nro_factura || f.numero_factura || f.nroConsecutivo || f.numero;
        const nroDoc = storedCons ? storedCons : `FCEV-${1201 + fIdx}`;

        const isAnulado = (f.estado || "").toLowerCase() === "anulado";
        const rawObs = f.notas || f.observaciones || "";
        const cleanObs = cleanObservaciones(rawObs);
        const refClean = cleanDocReferencia(f.resolucion || f.cufe, String(nroDoc));

        let fDet = {};
        try {
          fDet = typeof f.detalles === "string" ? JSON.parse(f.detalles) : (f.detalles || {});
        } catch {
          fDet = {};
        }

        // Extracción exhaustiva de conceptos reales (fDet.items, f.items, fDet.conceptos, etc.)
        const fItems = (Array.isArray(f.items) && f.items.length > 0)
          ? f.items
          : (Array.isArray(fDet.items) && fDet.items.length > 0)
          ? fDet.items
          : (Array.isArray(f.conceptos) && f.conceptos.length > 0)
          ? f.conceptos
          : (Array.isArray(fDet.conceptos) && fDet.conceptos.length > 0)
          ? fDet.conceptos
          : (Array.isArray(f.lineas) && f.lineas.length > 0)
          ? f.lineas
          : (Array.isArray(fDet.lineas) && fDet.lineas.length > 0)
          ? fDet.lineas
          : [];

        const conceptoCandidates = fItems.map((it) => {
          if (typeof it === "string") return it.trim();
          const list = [it.concepto, it.descripcion, it.nombre, it.name, it.procedimiento].filter(Boolean);
          const nonGeneric = list.find((c) => {
            const clean = String(c).trim().toLowerCase();
            return clean !== "servicio odontológico" &&
                   clean !== "servicio" &&
                   clean !== "consulta / tratamiento odontológico";
          });
          return nonGeneric || list[0];
        }).filter(Boolean);

        const conceptoFinal = (conceptoCandidates.length > 0 ? conceptoCandidates.join(", ") : null)
          || f.concepto
          || fDet.concepto
          || f.descripcion
          || fDet.descripcion
          || "Consulta / Tratamiento Odontológico";

        // Extracción exhaustiva de recibos asociados con objetos enriquecidos para el modal
        const foundReceipts = new Set();
        const associatedDocs = [];
        const seenRecNumbers = new Set();

        const addDoc = (recNum, monto, rawRec) => {
          if (!recNum) return;
          const cleanNum = String(recNum).trim().replace(/^REC-?/i, "");
          if (seenRecNumbers.has(cleanNum)) return;
          seenRecNumbers.add(cleanNum);

          const rDisplay = `REC-${cleanNum}`;
          foundReceipts.add(rDisplay);

          associatedDocs.push({
            id: rawRec?.rawId || rawRec?.id || `rec_${cleanNum}`,
            numeroDocumento: cleanNum,
            tipoDocumento: "Recibo de caja",
            valor: Number(monto || rawRec?.total || rawRec?.valor || totalNum),
            fecha: rawRec?.fechaSeleccionada || rawRec?.fechaCreacion || rawRec?.fecha || f.created_at,
            reciboObj: rawRec || null,
            pacienteObj: pac,
            concepto: rawRec?.concepto || conceptoFinal,
          });
        };

        // 1. Vía índice inverso (recibo -> factura)
        if (f.id && receiptsByFacturaId[f.id]) {
          receiptsByFacturaId[f.id].forEach((r) => {
            const num = r.numeroDocumento || r.nroConsecutivo;
            addDoc(num, r.total, r);
          });
        }
        if (nroDoc && receiptsByFacturaNumero[String(nroDoc).trim().toLowerCase()]) {
          receiptsByFacturaNumero[String(nroDoc).trim().toLowerCase()].forEach((r) => {
            const num = r.numeroDocumento || r.nroConsecutivo;
            addDoc(num, r.total, r);
          });
        }
        if (f.numero && receiptsByFacturaNumero[String(f.numero).trim().toLowerCase()]) {
          receiptsByFacturaNumero[String(f.numero).trim().toLowerCase()].forEach((r) => {
            const num = r.numeroDocumento || r.nroConsecutivo;
            addDoc(num, r.total, r);
          });
        }

        // 2. Vía datos guardados en la factura (detalles.recibos_asociados / recibo_asociado)
        const rawRecList = [
          ...(Array.isArray(fDet.recibos_asociados) ? fDet.recibos_asociados : []),
          ...(Array.isArray(f.recibos_asociados) ? f.recibos_asociados : []),
          ...(fDet.recibo_asociado ? [fDet.recibo_asociado] : []),
          ...(f.recibo_asociado ? [f.recibo_asociado] : []),
          ...(fDet.recibo ? [fDet.recibo] : []),
          ...(f.recibo ? [f.recibo] : []),
          ...(fDet.recibo_numero ? [fDet.recibo_numero] : []),
          ...(f.recibo_numero ? [f.recibo_numero] : []),
          ...(fDet.recibo_id ? [{ id: fDet.recibo_id }] : []),
          ...(f.recibo_id ? [{ id: f.recibo_id }] : [])
        ];

        rawRecList.forEach((recItem) => {
          if (!recItem) return;
          if (typeof recItem === "string" || typeof recItem === "number") {
            const strVal = String(recItem).trim();
            if (strVal.length > 25 && strVal.includes("-") && receiptsById[strVal]) {
              const matched = receiptsById[strVal];
              addDoc(matched.numeroDocumento || matched.nroConsecutivo, matched.total, matched);
            } else if (strVal) {
              const matched = combinedRecibos.find((r) =>
                String(r.numeroDocumento || r.nroConsecutivo).trim() === strVal.replace(/^REC-?/i, "")
              );
              addDoc(strVal, matched?.total || totalNum, matched);
            }
          } else if (typeof recItem === "object") {
            const num = recItem.numero || recItem.nroConsecutivo || recItem.consecutivo || recItem.nro_consecutivo || recItem.numeroRecibo || recItem.nroRecibo;
            const recId = recItem.id || recItem.recibo_id;
            const matched = (recId && receiptsById[recId])
              ? receiptsById[recId]
              : (num ? combinedRecibos.find((r) => String(r.numeroDocumento || r.nroConsecutivo).trim() === String(num).replace(/^REC-?/i, "")) : null);

            if (num) {
              addDoc(num, recItem.monto || recItem.total || matched?.total, matched || recItem);
            } else if (recId && matched) {
              addDoc(matched.numeroDocumento || matched.nroConsecutivo, matched.total, matched);
            } else if (recId) {
              addDoc(`REC-${String(recId).slice(0, 6)}`, recItem.monto || totalNum, recItem);
            }
          }
        });

        // 3. Fallback inteligente por paciente y monto
        if (associatedDocs.length === 0 && pacId) {
          const matchRec = combinedRecibos.find((r) =>
            (r.pacienteId === pacId || r._raw?.paciente_id === pacId) &&
            Math.abs(Number(r.total || 0) - totalNum) < 1
          );
          if (matchRec) {
            const rNum = matchRec.numeroDocumento || matchRec.nroConsecutivo;
            addDoc(rNum, matchRec.total, matchRec);
          }
        }

        const linkedReceiptText = foundReceipts.size > 0 ? Array.from(foundReceipts).join(", ") : "";
        const docAsocFinal = linkedReceiptText ? `Recibo: ${linkedReceiptText}` : "—";

        const profRaw = f.profesional_nombre || f.profesionalNombre || fDet.profesional_nombre || f.profesional || fDet.profesional || f.doctor || fDet.doctor || "";
        const profIdRaw = f.profesional_id || f.profesionalId || fDet.profesional_id || f.doctorId || "";
        const profFinal = resolveDoctorName(profRaw, profIdRaw, pac);

        allRows.push({
          id: `fac_${f.id}`,
          rawId: f.id,
          numeroDocumento: nroDoc,
          tipoDocumento: "Factura de venta+",
          fechaCreacion: f.created_at || f.fechaISO || new Date().toISOString(),
          fechaSeleccionada: f.fecha || f.fechaISO || f.created_at || new Date().toISOString(),
          concepto: conceptoFinal,
          valor: totalNum,
          consecutivo: "Principal",
          docReferencia: refClean,
          documentosAsociados: docAsocFinal,
          associatedDocs: associatedDocs,
          rawFactura: f,
          pacienteObj: pac,
          estado: isAnulado ? "Anulado" : "Activo",
          tercero: pacNom,
          documentoTercero: pacDoc,
          profesional: profFinal,
          profesionalId: profIdRaw || "",
          formaPago: f.medioPago || f.metodo_pago || f.forma_pago || "Efectivo",
          subtotal: subtotalNum,
          descuento: descNum,
          iva: ivaNum,
          retencion: Number(f.retencion || 0),
          total: totalNum,
          usuarioCreador: f.usuario_nombre || "Facturación",
          observaciones: cleanObs,
          cuentaContable: "410505 - Ingresos por Servicios",
          oficina: f.oficina || f.sucursal || f.sede || ""
        });
      });

      // 8. Cargar Facturas de Compra y Documentos Soporte (desde getConfigSection, website_config y tabla)
      const allRawFacturasCompra = [
        ...(facturasCompraRes?.data || []),
        ...(Array.isArray(cfgFacturasCompra) ? cfgFacturasCompra : []),
        ...(Array.isArray(cfgRes?.data?.config?.facturas_compra) ? cfgRes.data.config.facturas_compra : []),
        ...(Array.isArray(cfgRes?.data?.config?.facturasCompra) ? cfgRes.data.config.facturasCompra : []),
        ...(Array.isArray(cfgRes?.data?.config?.documentos_soporte) ? cfgRes.data.config.documentos_soporte : []),
        ...(Array.isArray(cfgRes?.data?.config?.documentosSoporte) ? cfgRes.data.config.documentosSoporte : [])
      ];

      const seenFacturaCompraIds = new Set();
      const seenFacturaCompraNums = new Set();
      let fcIdx = 101;

      allRawFacturasCompra.forEach((fc) => {
        if (!fc) return;
        const rawId = fc.id || fc._id;
        if (rawId && seenFacturaCompraIds.has(rawId)) return;
        if (rawId) seenFacturaCompraIds.add(rawId);

        const totalNum = Number(fc.total || fc.monto || fc.valor || 0);
        const subtotalNum = Number(fc.subtotal || totalNum);
        const ivaNum = Number(fc.iva || 0);
        const retNum = Number(fc.retencion || fc.retencionTotal || 0);

        const storedCons = fc.factus_number || fc.documentoNumero || fc.nroFactura || fc.nro_factura || fc.numeroFactura || fc.numero || (fc.prefix && fc.consecutivo ? `${fc.prefix}${fc.consecutivo}` : null);
        const nroDoc = storedCons ? String(storedCons).trim() : `FC-${fcIdx++}`;

        // Deduplicar si tiene el mismo nroDoc y el mismo monto
        const numKey = `${nroDoc}_${Math.round(totalNum)}`;
        if (seenFacturaCompraNums.has(numKey)) return;
        seenFacturaCompraNums.add(numKey);

        const isAnulado = (fc.estado || "").toLowerCase() === "anulado" || fc.anulado;
        const conceptoDesc = fc.concepto || fc.descripcion || (Array.isArray(fc.items) && (fc.items[0]?.concepto || fc.items[0]?.descripcion)) || "Compra de insumos / Materiales";
        const cudsOrRef = fc.cuds || fc.cufe || fc.referencia || nroDoc;

        // Documentos asociados (egreso vinculado)
        const docAsoc = fc.egreso_asociado || fc.pago_asociado || (Array.isArray(fc.egresos_asociados) && fc.egresos_asociados.length > 0 ? fc.egresos_asociados.join(", ") : "—");

        allRows.push({
          id: `fc_${rawId || nroDoc}`,
          rawId: rawId,
          numeroDocumento: nroDoc,
          tipoDocumento: "Factura de compra",
          fechaCreacion: fc.created_at || fc.fecha || new Date().toISOString(),
          fechaSeleccionada: fc.fecha || fc.created_at || new Date().toISOString(),
          concepto: conceptoDesc,
          valor: totalNum,
          consecutivo: "Principal",
          docReferencia: cudsOrRef,
          documentosAsociados: docAsoc || "—",
          estado: isAnulado ? "Anulado" : (fc.dian_status || fc.estado || "Activo"),
          tercero: fc.proveedor || fc.tercero || fc.nombreProveedor || "Proveedor",
          documentoTercero: fc.documentoTercero || fc.nit || fc.cedula || fc.identificacion || "",
          profesional: "Administración",
          profesionalId: "",
          formaPago: fc.formaPago || fc.medioPago || fc.metodoPago || "Contado",
          subtotal: subtotalNum,
          descuento: Number(fc.descuento || 0),
          iva: ivaNum,
          retencion: retNum,
          total: totalNum,
          usuarioCreador: fc.creado_por || fc.usuario_nombre || "Administración",
          observaciones: cleanObservaciones(fc.observaciones || fc.notas || fc.descripcion || ""),
          cuentaContable: "220505 - Proveedores Nacionales",
          oficina: fc.oficina || fc.sucursal || fc.sede || "",
          rawFacturaCompra: fc
        });
      });

      // 9. Cargar Notas Crédito
      (notasCreditoRes?.data || []).forEach((nc, ncIdx) => {
        const totalNum = Number(nc.total || nc.monto || nc.valor || 0);
        const nroDoc = nc.nroConsecutivo || nc.consecutivo || nc.numero || `NC-${101 + ncIdx}`;
        allRows.push({
          id: `nc_${nc.id}`,
          rawId: nc.id,
          numeroDocumento: nroDoc,
          tipoDocumento: "Nota crédito+",
          fechaCreacion: nc.created_at || new Date().toISOString(),
          fechaSeleccionada: nc.fecha || nc.created_at || new Date().toISOString(),
          concepto: nc.concepto || nc.motivo || nc.descripcion || "Nota Crédito / Devolución",
          valor: totalNum,
          consecutivo: "Principal",
          docReferencia: nc.factura_asociada || `FAC-${nc.facturaId || ""}`,
          documentosAsociados: nc.factura_asociada || "—",
          estado: (nc.estado || "Activo"),
          tercero: nc.pacienteNombre || nc.tercero || "Paciente / Tercero",
          documentoTercero: nc.documento || "",
          profesional: resolveDoctorName(nc.profesional_nombre || nc.profesional, nc.profesional_id),
          profesionalId: nc.profesional_id || "",
          formaPago: "Nota Crédito",
          subtotal: totalNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: totalNum,
          usuarioCreador: "Administración",
          observaciones: cleanObservaciones(nc.motivo || nc.observaciones || ""),
          cuentaContable: "417505 - Devoluciones y Descuentos",
          oficina: nc.oficina || ""
        });
      });

      // 10. Cargar Notas Débito
      (notasDebitoRes?.data || []).forEach((nd, ndIdx) => {
        const totalNum = Number(nd.total || nd.monto || nd.valor || 0);
        const nroDoc = nd.nroConsecutivo || nd.consecutivo || nd.numero || `ND-${101 + ndIdx}`;
        allRows.push({
          id: `nd_${nd.id}`,
          rawId: nd.id,
          numeroDocumento: nroDoc,
          tipoDocumento: "Nota débito-",
          fechaCreacion: nd.created_at || new Date().toISOString(),
          fechaSeleccionada: nd.fecha || nd.created_at || new Date().toISOString(),
          concepto: nd.concepto || nd.motivo || nd.descripcion || "Nota Débito / Ajuste",
          valor: totalNum,
          consecutivo: "Principal",
          docReferencia: nd.factura_asociada || `FAC-${nd.facturaId || ""}`,
          documentosAsociados: nd.factura_asociada || "—",
          estado: (nd.estado || "Activo"),
          tercero: nd.pacienteNombre || nd.tercero || "Paciente / Tercero",
          documentoTercero: nd.documento || "",
          profesional: resolveDoctorName(nd.profesional_nombre || nd.profesional, nd.profesional_id),
          profesionalId: nd.profesional_id || "",
          formaPago: "Nota Débito",
          subtotal: totalNum,
          descuento: 0,
          iva: 0,
          retencion: 0,
          total: totalNum,
          usuarioCreador: "Administración",
          observaciones: cleanObservaciones(nd.motivo || nd.observaciones || ""),
          cuentaContable: "410505 - Ingresos por Servicios",
          oficina: nd.oficina || ""
        });
      });

      allRows.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
      setAllTransactions(allRows);

    } catch (error) {
      console.error("Error cargando reporte de facturación:", error);
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

  const formatDateOnly = (dateVal) => {
    if (!dateVal) return "";
    const dt = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return isNaN(dt.getTime()) ? String(dateVal) : format(dt, "dd/MM/yyyy");
  };

  // Transacciones en el período y filtros activos para conteos contextuales en el selector
  const transactionsInPeriod = useMemo(() => {
    return allTransactions.filter(r => {
      // 1. Filtro por Fechas
      if (!isAllHistory && fechaInicial && fechaInicial.trim() !== "") {
        const rawDate = r.fechaSeleccionada || r.fechaCreacion;
        if (rawDate) {
          const targetDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
          if (!isNaN(targetDate.getTime())) {
            const init = new Date(fechaInicial + "T00:00:00");
            const endStr = fechaFinal || fechaInicial;
            const end = new Date(endStr + "T23:59:59");
            if (targetDate < init || targetDate > end) return false;
          }
        }
      }

      // 2. Filtro por Oficina / Sede
      if (oficina && oficina !== "Todas las oficinas" && oficina !== "Todas") {
        const targetOficina = oficina.toLowerCase().trim();
        const rOficina = String(r.oficina || r.sucursal || r.sede || "").toLowerCase().trim();
        const rOficinaId = String(r.sucursalId || r.sucursal_id || "").toLowerCase().trim();
        
        const ofObj = oficinasList.find(o => o.nombre.toLowerCase() === targetOficina || o.id === oficina);
        const targetId = ofObj ? String(ofObj.id).toLowerCase() : "";

        let matchesOffice = false;
        if (rOficina) {
          matchesOffice = rOficina.includes(targetOficina) || targetOficina.includes(rOficina);
        }
        if (rOficinaId && targetId) {
          matchesOffice = matchesOffice || rOficinaId === targetId;
        }
        if (!rOficina && !rOficinaId) {
          const isPrincipal = targetOficina.includes("principal") || targetOficina.includes("centro del dolor") || targetOficina.includes("sincelejo");
          matchesOffice = isPrincipal;
        }

        if (!matchesOffice) return false;
      }

      // 3. Filtro por Profesional
      if (selectedProfesional && selectedProfesional !== "Todos" && selectedProfesional.trim() !== "") {
        const targetProf = selectedProfesional.toLowerCase().trim();
        const profObj = profesionales.find(pr => pr.nombre === selectedProfesional || pr.id === selectedProfesional);
        const rProf = String(r.profesional || "").toLowerCase().trim();
        const rProfId = String(r.profesionalId || "").toLowerCase().trim();

        let matchesDoc = false;
        if (profObj && profObj.allNames) {
          matchesDoc = profObj.allNames.some(nameVariant => 
            rProf.includes(nameVariant) || rProfId === nameVariant || nameVariant.includes(rProf)
          );
        } else {
          matchesDoc = rProf.includes(targetProf) || rProfId.includes(targetProf) || targetProf.includes(rProf);
        }
        if (!matchesDoc) return false;
      }

      return true;
    });
  }, [allTransactions, isAllHistory, fechaInicial, fechaFinal, oficina, selectedProfesional, oficinasList, profesionales]);

  // Conteo de transacciones por tipo de movimiento para el selector interactivo (en tiempo real por período)
  const movementTypeCounts = useMemo(() => {
    const counts = { "Todos": transactionsInPeriod.length };
    TIPO_MOVIMIENTO_OPTIONS.forEach(opt => {
      if (opt !== "Todos" && opt !== "Seleccione") counts[opt] = 0;
    });

    transactionsInPeriod.forEach(t => {
      const rowType = (t.tipoDocumento || "").trim();
      if (counts[rowType] !== undefined) {
        counts[rowType]++;
      } else {
        // Coincidencia de prefijo
        TIPO_MOVIMIENTO_OPTIONS.forEach(opt => {
          if (opt !== "Todos" && opt !== "Seleccione" && rowType.toLowerCase().includes(opt.toLowerCase().replace(/[+\-]/g, ""))) {
            counts[opt] = (counts[opt] || 0) + 1;
          }
        });
      }
    });
    return counts;
  }, [transactionsInPeriod]);

  // Filtrado reactivo de movimientos
  const filteredData = useMemo(() => {
    return allTransactions.filter(r => {
      // 1. Filtro por Fechas
      if (!appliedFilters.isAllHistory && appliedFilters.fechaInicial && appliedFilters.fechaInicial.trim() !== "") {
        const rawDate = r.fechaSeleccionada || r.fechaCreacion;
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

      // 2. Filtro por Oficina / Sede
      if (appliedFilters.oficina && appliedFilters.oficina !== "Todas las oficinas" && appliedFilters.oficina !== "Todas") {
        const targetOficina = appliedFilters.oficina.toLowerCase().trim();
        const rOficina = String(r.oficina || r.sucursal || r.sede || "").toLowerCase().trim();
        const rOficinaId = String(r.sucursalId || r.sucursal_id || "").toLowerCase().trim();
        
        const ofObj = oficinasList.find(o => o.nombre.toLowerCase() === targetOficina || o.id === appliedFilters.oficina);
        const targetId = ofObj ? String(ofObj.id).toLowerCase() : "";

        let matchesOffice = false;
        if (rOficina) {
          matchesOffice = rOficina.includes(targetOficina) || targetOficina.includes(rOficina);
        }
        if (rOficinaId && targetId) {
          matchesOffice = matchesOffice || rOficinaId === targetId;
        }
        if (!rOficina && !rOficinaId) {
          const isPrincipal = targetOficina.includes("principal") || targetOficina.includes("centro del dolor") || targetOficina.includes("sincelejo");
          matchesOffice = isPrincipal;
        }

        if (!matchesOffice) return false;
      }

      // 3. Filtro por Tipo de Movimiento (Estricto 1:1)
      if (appliedFilters.tipoMovimiento === "Seleccione") {
        return false;
      }
      if (appliedFilters.tipoMovimiento && appliedFilters.tipoMovimiento !== "Todos") {
        const target = appliedFilters.tipoMovimiento.trim();
        const rowType = (r.tipoDocumento || "").trim();

        if (target === "Factura de compra") {
          if (rowType !== "Factura de compra") return false;
        } else if (target === "Egreso-") {
          if (rowType !== "Egreso-") return false;
        } else if (target === "Traslado+") {
          if (rowType !== "Traslado+") return false;
        } else if (target === "Traslado-") {
          if (rowType !== "Traslado-") return false;
        } else if (target === "Saldo a favor+") {
          if (rowType !== "Saldo a favor+") return false;
        } else if (target === "Anticipo+") {
          if (rowType !== "Anticipo+") return false;
        } else if (target === "Recibo de caja+") {
          if (rowType !== "Recibo de caja+") return false;
        } else if (target === "Factura de venta+") {
          if (rowType !== "Factura de venta+") return false;
        } else if (target === "Nota crédito+") {
          if (rowType !== "Nota crédito+") return false;
        } else if (target === "Nota débito-") {
          if (rowType !== "Nota débito-") return false;
        } else {
          const cleanTarget = target.toLowerCase().replace(/[+\-]/g, "").trim();
          const cleanRow = rowType.toLowerCase().replace(/[+\-]/g, "").trim();
          if (rowType !== target && cleanRow !== cleanTarget) {
            return false;
          }
        }
      }

      // 4. Filtro por Profesional
      if (appliedFilters.profesional && appliedFilters.profesional !== "Todos" && appliedFilters.profesional.trim() !== "") {
        const targetProf = appliedFilters.profesional.toLowerCase().trim();
        const profObj = profesionales.find(pr => pr.nombre === appliedFilters.profesional || pr.id === appliedFilters.profesional);
        const rProf = String(r.profesional || "").toLowerCase().trim();
        const rProfId = String(r.profesionalId || "").toLowerCase().trim();

        let matchesDoc = false;
        if (profObj && profObj.allNames) {
          matchesDoc = profObj.allNames.some(nameVariant => 
            rProf.includes(nameVariant) || rProfId === nameVariant || nameVariant.includes(rProf)
          );
        } else {
          matchesDoc = rProf.includes(targetProf) || rProfId.includes(targetProf) || targetProf.includes(rProf);
        }
        if (!matchesDoc) return false;
      }

      // 5. Búsqueda rápida global en tabla
      if (tableSearchTerm.trim() !== "") {
        const term = tableSearchTerm.toLowerCase().trim();
        const matchesSearch =
          String(r.numeroDocumento || "").toLowerCase().includes(term) ||
          String(r.tipoDocumento || "").toLowerCase().includes(term) ||
          String(r.concepto || "").toLowerCase().includes(term) ||
          String(r.tercero || "").toLowerCase().includes(term) ||
          String(r.documentoTercero || "").toLowerCase().includes(term) ||
          String(r.profesional || "").toLowerCase().includes(term) ||
          String(r.docReferencia || "").toLowerCase().includes(term) ||
          String(r.documentosAsociados || "").toLowerCase().includes(term) ||
          String(r.formaPago || "").toLowerCase().includes(term) ||
          String(r.observaciones || "").toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // 6. Filtros individuales por columna
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal || filterVal === "TODO" || filterVal.trim() === "") continue;
        const search = filterVal.toLowerCase().trim();

        let cellValue = "";
        if (colKey === "fechaCreacion") cellValue = formatDateTime(r.fechaCreacion);
        else if (colKey === "fechaSeleccionada") cellValue = formatDateOnly(r.fechaSeleccionada);
        else cellValue = String(r[colKey] || "");

        if (!cellValue.toLowerCase().includes(search)) return false;
      }

      return true;
    });
  }, [allTransactions, appliedFilters, tableSearchTerm, columnFilters, profesionales, oficinasList]);

  // Totales calculados en tiempo real
  const totalIngresos = useMemo(() => {
    return filteredData
      .filter(r => (
        r.tipoDocumento.includes("Recibo") || 
        r.tipoDocumento.includes("Saldo a favor") || 
        r.tipoDocumento.includes("Anticipo") || 
        r.tipoDocumento === "Traslado+"
      ) && r.estado !== "Anulado")
      .reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [filteredData]);

  const totalFacturado = useMemo(() => {
    return filteredData
      .filter(r => r.tipoDocumento.includes("Factura de venta") && r.estado !== "Anulado")
      .reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [filteredData]);

  const totalEgresos = useMemo(() => {
    return filteredData
      .filter(r => (
        r.tipoDocumento.includes("Egreso") || 
        r.tipoDocumento.includes("Compra") || 
        r.tipoDocumento === "Nota débito-" ||
        r.tipoDocumento === "Traslado-"
      ) && r.estado !== "Anulado")
      .reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [filteredData]);

  // Manejar clic en "Buscar"
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      isAllHistory,
      oficina,
      tipoMovimiento,
      informacionContable,
      profesional: selectedProfesional
    });
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  };

  // Restablecer filtros
  const handleResetFilters = () => {
    setIsAllHistory(false);
    setFechaInicial(format(firstDayOfMonth, "yyyy-MM-dd"));
    setFechaFinal(format(now, "yyyy-MM-dd"));
    setOficina("Todas las oficinas");
    setTipoMovimiento("Seleccione");
    setSelectedProfesional("Todos");
    setTableSearchTerm("");
    setColumnFilters({});
    setAppliedFilters({
      fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
      fechaFinal: format(now, "yyyy-MM-dd"),
      isAllHistory: false,
      oficina: "Todas las oficinas",
      tipoMovimiento: "Seleccione",
      informacionContable,
      profesional: "Todos"
    });
  };

  // Manejar cambio de filtro individual por columna
  const handleColumnFilterChange = (colKey, val) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: val
    }));
  };

  // Exportar reporte a Excel Ejecutivo con diseño profesional 1:1
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert("No hay transacciones disponibles para exportar con los filtros seleccionados.");
      return;
    }

    const clinicName = clinicInfo?.nombre || userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenantNombre || userProfile?.clinica || "Clínica Dental";
    const clinicNit = clinicInfo?.nit || userProfile?.tenant?.nit || userProfile?.nit || "";
    const dateFormatted = format(new Date(), "dd/MM/yyyy HH:mm");
    const periodText = appliedFilters.isAllHistory 
      ? "Histórico Completo (Sin límite de fechas)" 
      : `${appliedFilters.fechaInicial || 'Inicio'} al ${appliedFilters.fechaFinal || 'Fin'}`;

    const activeColKeys = Object.keys(visibleColumns).filter(k => visibleColumns[k]);
    const headers = activeColKeys.map(k => columnLabels[k]);
    const totalCols = Math.max(headers.length, 10);

    // Definición de bordes elegantes
    const borderThin = {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } }
    };

    const borderTotal = {
      top: { style: "thin", color: { rgb: "64748B" } },
      bottom: { style: "double", color: { rgb: "0F172A" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } }
    };

    // Estructura AOA
    // Fila 0: Título principal institucional (sin OdontoCloud)
    // Fila 1: Clínica / NIT / Fecha Emisión
    // Fila 2: Período / Sede / Tipo de Movimiento
    // Fila 3: Separador
    // Fila 4: Tarjetas KPI Encabezados
    // Fila 5: Tarjetas KPI Valores
    // Fila 6: Separador
    // Fila 7: Encabezados de la tabla
    const aoa = [
      ["REPORTE DETALLADO DE FACTURACIÓN Y MOVIMIENTOS FINANCIEROS"],
      [`Clínica / Institución:  ${clinicName}`, "", "", "", `NIT:  ${clinicNit || '—'}`, "", `Fecha de Emisión:  ${dateFormatted}`],
      [`Período:  ${periodText}`, "", `Sede / Oficina:  ${appliedFilters.oficina}`, "", `Tipo de Movimiento:  ${appliedFilters.tipoMovimiento}`],
      [],
      ["TOTAL MOVIMIENTOS", "", "RECAUDOS / INGRESOS (+)", "", "FACTURACIÓN (FEV)", "", "EGRESOS (-)", "", "BALANCE NETO", ""],
      [filteredData.length, "", Number(totalIngresos || 0), "", Number(totalFacturado || 0), "", Number(totalEgresos || 0), Number((totalIngresos || 0) - (totalEgresos || 0)), ""],
      [],
      headers
    ];

    // Acumuladores de columnas numéricas
    let sumValor = 0;
    let sumSubtotal = 0;
    let sumDescuento = 0;
    let sumIVA = 0;
    let sumRetencion = 0;
    let sumTotal = 0;

    // Filas de datos
    filteredData.forEach(r => {
      const row = [];
      const vVal = Number(r.valor || 0);
      const vSub = Number(r.subtotal || r.valor || 0);
      const vDesc = Number(r.descuento || 0);
      const vIva = Number(r.iva || 0);
      const vRet = Number(r.retencion || 0);
      const vTot = Number(r.total || r.valor || 0);

      sumValor += vVal;
      sumSubtotal += vSub;
      sumDescuento += vDesc;
      sumIVA += vIva;
      sumRetencion += vRet;
      sumTotal += vTot;

      activeColKeys.forEach(k => {
        switch (k) {
          case "numeroDocumento": row.push(r.numeroDocumento || ""); break;
          case "tipoDocumento": row.push(r.tipoDocumento || ""); break;
          case "fechaCreacion": row.push(formatDateTime(r.fechaCreacion)); break;
          case "fechaSeleccionada": row.push(formatDateOnly(r.fechaSeleccionada)); break;
          case "concepto": row.push(r.concepto || ""); break;
          case "valor": row.push(vVal); break;
          case "consecutivo": row.push(r.consecutivo || "Principal"); break;
          case "docReferencia": row.push(r.docReferencia || ""); break;
          case "documentosAsociados": row.push(r.documentosAsociados || "—"); break;
          case "estado": row.push(r.estado || "Activo"); break;
          case "tercero": row.push(r.tercero || ""); break;
          case "documentoTercero": row.push(r.documentoTercero || ""); break;
          case "profesional": row.push(r.profesional || "Sin asignar"); break;
          case "formaPago": row.push(r.formaPago || "Efectivo"); break;
          case "subtotal": row.push(vSub); break;
          case "descuento": row.push(vDesc); break;
          case "iva": row.push(vIva); break;
          case "retencion": row.push(vRet); break;
          case "total": row.push(vTot); break;
          case "usuarioCreador": row.push(r.usuarioCreador || ""); break;
          case "observaciones": row.push(r.observaciones || ""); break;
          case "cuentaContable": row.push(r.cuentaContable || ""); break;
          default: row.push(r[k] || "");
        }
      });
      aoa.push(row);
    });

    // Fila de totales generales al final
    const summaryRow = [];
    activeColKeys.forEach(k => {
      if (k === "concepto") summaryRow.push("TOTALES GENERALES:");
      else if (k === "valor") summaryRow.push(sumValor);
      else if (k === "subtotal") summaryRow.push(sumSubtotal);
      else if (k === "descuento") summaryRow.push(sumDescuento);
      else if (k === "iva") summaryRow.push(sumIVA);
      else if (k === "retencion") summaryRow.push(sumRetencion);
      else if (k === "total") summaryRow.push(sumTotal);
      else summaryRow.push("");
    });
    aoa.push(summaryRow);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Combinación de celdas (Merges)
    const merges = [
      // Fila 0: Título principal
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      // Fila 1: Clínica / NIT / Emisión
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },
      { s: { r: 1, c: 6 }, e: { r: 1, c: Math.min(totalCols - 1, 8) } },
      // Fila 2: Período / Sede / Tipo
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: Math.min(totalCols - 1, 6) } },
      // Filas 4 y 5: 5 Tarjetas KPI ejecutivas
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } }, { s: { r: 5, c: 2 }, e: { r: 5, c: 3 } },
      { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } },
      { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } }, { s: { r: 5, c: 6 }, e: { r: 5, c: 7 } },
      { s: { r: 4, c: 8 }, e: { r: 4, c: 9 } }, { s: { r: 5, c: 8 }, e: { r: 5, c: 9 } }
    ];
    worksheet["!merges"] = merges;

    // Alturas de filas ejecutivas
    const rowHeights = [
      { hpt: 32 }, // R0: Título
      { hpt: 22 }, // R1: Clínica / NIT / Emisión
      { hpt: 20 }, // R2: Período / Sede / Tipo
      { hpt: 8 },  // R3: Separador
      { hpt: 18 }, // R4: KPI Headers
      { hpt: 26 }, // R5: KPI Values
      { hpt: 10 }, // R6: Separador
      { hpt: 26 }  // R7: Table Headers
    ];
    for (let i = 0; i < filteredData.length; i++) {
      rowHeights.push({ hpt: 20 });
    }
    rowHeights.push({ hpt: 24 }); // Totales
    worksheet["!rows"] = rowHeights;

    // 1. Estilo Título Principal (R0)
    for (let c = 0; c < totalCols; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };
      worksheet[ref].s = {
        font: { name: "Calibri", sz: 13, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0F172A" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    // 2. Estilo Metadatos (R1 & R2)
    for (let r = 1; r <= 2; r++) {
      for (let c = 0; c < totalCols; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };
        worksheet[ref].s = {
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "334155" } },
          fill: { fgColor: { rgb: "F8FAFC" } },
          alignment: { horizontal: c === 6 ? "right" : "left", vertical: "center" },
          border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
        };
      }
    }

    // 3. Estilo KPI Cards (R4 & R5)
    const kpiFillsHeader = ["F1F5F9", "F0FDF4", "F0F9FF", "FEF2F2", "EFF6FF"];
    const kpiColorsVal = ["0F172A", "16A34A", "0284C7", "DC2626", "2563EB"];

    for (let i = 0; i < 5; i++) {
      const cStart = i * 2;
      const cEnd = cStart + 1;
      const fgH = kpiFillsHeader[i];
      const valColor = kpiColorsVal[i];

      [cStart, cEnd].forEach(c => {
        const refH = XLSX.utils.encode_cell({ r: 4, c });
        if (!worksheet[refH]) worksheet[refH] = { t: "s", v: "" };
        worksheet[refH].s = {
          font: { name: "Calibri", sz: 8.5, bold: true, color: { rgb: "475569" } },
          fill: { fgColor: { rgb: fgH } },
          alignment: { horizontal: "center", vertical: "center" },
          border: borderThin
        };

        const refV = XLSX.utils.encode_cell({ r: 5, c });
        if (!worksheet[refV]) worksheet[refV] = { t: "n", v: 0 };
        worksheet[refV].s = {
          font: { name: "Calibri", sz: 12, bold: true, color: { rgb: valColor } },
          fill: { fgColor: { rgb: "FFFFFF" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: borderThin,
          numFmt: i === 0 ? "#,##0" : "\"$\"#,##0"
        };
      });
    }

    // 4. Estilo Encabezados de Tabla (R7)
    headers.forEach((_, cIdx) => {
      const ref = XLSX.utils.encode_cell({ r: 7, c: cIdx });
      if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };
      worksheet[ref].s = {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
      };
    });

    // 5. Estilo Filas de Datos (R8+)
    const currencyColKeys = new Set(["valor", "subtotal", "descuento", "iva", "retencion", "total"]);
    const centerColKeys = new Set(["numeroDocumento", "tipoDocumento", "fechaCreacion", "fechaSeleccionada", "consecutivo", "docReferencia", "documentosAsociados", "estado", "documentoTercero", "formaPago", "cuentaContable"]);

    filteredData.forEach((_, rIdx) => {
      const rowNum = 8 + rIdx;
      const isZebra = rIdx % 2 === 1;
      const rowBg = isZebra ? "F8FAFC" : "FFFFFF";

      activeColKeys.forEach((k, cIdx) => {
        const ref = XLSX.utils.encode_cell({ r: rowNum, c: cIdx });
        if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };

        const isCurrency = currencyColKeys.has(k);
        const isCenter = centerColKeys.has(k);

        worksheet[ref].s = {
          font: { name: "Calibri", sz: 9.5, color: { rgb: "334155" }, bold: k === "numeroDocumento" },
          fill: { fgColor: { rgb: rowBg } },
          alignment: {
            horizontal: isCurrency ? "right" : (isCenter ? "center" : "left"),
            vertical: "center"
          },
          border: borderThin,
          numFmt: isCurrency ? "\"$\"#,##0" : undefined
        };
      });
    });

    // 6. Estilo Fila de Totales Generales
    const totalRowNum = 8 + filteredData.length;
    activeColKeys.forEach((k, cIdx) => {
      const ref = XLSX.utils.encode_cell({ r: totalRowNum, c: cIdx });
      if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };

      const isCurrency = currencyColKeys.has(k);

      worksheet[ref].s = {
        font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: "0F172A" } },
        fill: { fgColor: { rgb: "FEF9C3" } },
        alignment: {
          horizontal: isCurrency ? "right" : (k === "concepto" ? "right" : "center"),
          vertical: "center"
        },
        border: borderTotal,
        numFmt: isCurrency ? "\"$\"#,##0" : undefined
      };
    });

    // Ajuste dinámico de anchos de columna para evitar truncamiento
    const minWidths = {
      numeroDocumento: 16,
      tipoDocumento: 20,
      fechaCreacion: 18,
      fechaSeleccionada: 18,
      concepto: 38,
      valor: 18,
      consecutivo: 15,
      docReferencia: 22,
      documentosAsociados: 22,
      estado: 14,
      tercero: 32,
      documentoTercero: 18,
      profesional: 28,
      formaPago: 16,
      subtotal: 18,
      descuento: 16,
      iva: 16,
      retencion: 16,
      total: 18,
      usuarioCreador: 22,
      observaciones: 35,
      cuentaContable: 18
    };

    const colWidths = headers.map((h, i) => {
      const colKey = activeColKeys[i];
      let maxLen = Math.max(h.length + 4, minWidths[colKey] || 15);
      filteredData.forEach(r => {
        const val = String(r[colKey] || "");
        if (val.length > maxLen) maxLen = Math.min(val.length + 3, 50);
      });
      return { wch: maxLen };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Facturación");
    
    const cleanClinic = clinicName.replace(/[^a-zA-Z0-9]/g, "_");
    const fileNameSuffix = appliedFilters.isAllHistory ? "Historico" : format(new Date(), "yyyyMMdd");
    XLSX.writeFile(workbook, `Reporte_Facturacion_${cleanClinic}_${fileNameSuffix}.xlsx`);
  };

  // Helper para resolver documentos asociados de una fila (1:1 con OralDrive)
  const getAssociatedDocs = (doc) => {
    if (!doc) return [];
    if (Array.isArray(doc.associatedDocs) && doc.associatedDocs.length > 0) {
      return doc.associatedDocs;
    }
    // Si documentosAsociados contiene texto (ej: "Recibo: REC-2085" o "REC-2085")
    if (typeof doc.documentosAsociados === "string" && doc.documentosAsociados !== "—") {
      const matches = doc.documentosAsociados.match(/(?:REC-?|RC-?|Recibo:?\s*(?:REC-?)?)(\d+)/gi);
      if (matches) {
        return matches.map((m) => {
          const num = m.replace(/[^\d]/g, "");
          return {
            id: `rec_${num}`,
            numeroDocumento: num,
            tipoDocumento: "Recibo de caja",
            valor: Number(doc.valor || 0),
            fecha: doc.fechaSeleccionada || doc.fechaCreacion,
            pacienteObj: doc.pacienteObj,
            concepto: doc.concepto
          };
        });
      }
    }
    // Si es recibo y tiene factura de referencia
    if (doc.tipoDocumento?.toLowerCase().includes("recibo") && doc.docReferencia) {
      return [{
        id: `fac_${doc.docReferencia}`,
        numeroDocumento: doc.docReferencia,
        tipoDocumento: "Factura de venta",
        valor: Number(doc.valor || 0),
        fecha: doc.fechaSeleccionada || doc.fechaCreacion,
        pacienteObj: doc.pacienteObj,
        concepto: doc.concepto
      }];
    }
    return [];
  };

  const handlePrintReceiptDoc = async (recItem, fallbackDoc) => {
    try {
      const rawRec = recItem.reciboObj || {};
      const pac = recItem.pacienteObj || fallbackDoc?.pacienteObj || {};
      const rawCons = recItem.numeroDocumento || rawRec.numeroDocumento || rawRec.nroConsecutivo || fallbackDoc?.nroConsecutivo || "2085";
      const consecutive = String(rawCons).replace(/^REC-?/i, "");
      const conceptoStr = recItem.concepto || rawRec.concepto || fallbackDoc?.concepto || "Consulta / Tratamiento Odontológico";
      const valNum = Number(recItem.valor !== undefined ? recItem.valor : (rawRec.total || fallbackDoc?.valor || 0));

      const nombreElaborador = (userProfile?.nombreCompleto && !userProfile.nombreCompleto.includes("@"))
        ? userProfile.nombreCompleto
        : (userProfile?.nombre && !userProfile.nombre.includes("@"))
        ? userProfile.nombre
        : (rawRec.usuarioCreador && !rawRec.usuarioCreador.includes("@") && rawRec.usuarioCreador !== "Administración")
        ? rawRec.usuarioCreador
        : (fallbackDoc?.usuarioCreador && !fallbackDoc.usuarioCreador.includes("@") && fallbackDoc.usuarioCreador !== "Administración")
        ? fallbackDoc.usuarioCreador
        : "Administración";

      const recData = {
        ...rawRec,
        nroConsecutivo: consecutive,
        consecutivo: consecutive,
        numero: consecutive,
        consecutivoNumero: consecutive,
        fecha: recItem.fecha || rawRec.fechaSeleccionada || rawRec.fechaCreacion || fallbackDoc?.fechaSeleccionada || fallbackDoc?.fechaCreacion || new Date(),
        pacienteNombre: pac.nombreCompleto || fallbackDoc?.tercero || "Paciente Clínica",
        pacienteDocumento: pac.nroDocumento || fallbackDoc?.documentoTercero || "—",
        pacienteTipoDocumento: pac.tipoDocumento || "CC",
        pacienteDireccion: (pac.direccion && pac.direccion !== "—") ? pac.direccion : (pac.barrio || "—"),
        pacienteCiudad: (pac.ciudad && pac.ciudad !== "—") ? pac.ciudad : "Sincelejo",
        pacienteTelefono: (pac.celular && pac.celular !== "—") ? pac.celular : (pac.telefono || "—"),
        profesionalNombre: rawRec.profesional || fallbackDoc?.profesional || "Administración",
        registradoPor: nombreElaborador,
        medioPago: rawRec.formaPago || fallbackDoc?.formaPago || "Efectivo",
        medio: rawRec.formaPago || fallbackDoc?.formaPago || "Efectivo",
        metodo: rawRec.formaPago || fallbackDoc?.formaPago || "Efectivo",
        concepto: conceptoStr,
        total: valNum,
        monto: valNum,
        subtotal: valNum,
        observaciones: rawRec.observaciones || fallbackDoc?.observaciones || "",
        conceptos: [
          {
            concepto: conceptoStr,
            descripcion: conceptoStr,
            precioUnitario: valNum,
            cantidad: 1,
            total: valNum,
            monto: valNum
          }
        ],
        itemPayments: [
          {
            desc: conceptoStr,
            precioUnitario: valNum,
            cantidad: 1,
            monto: valNum
          }
        ],
        planTitle: conceptoStr,
        estado: recItem.estado || rawRec.estado || fallbackDoc?.estado || "Activo"
      };

      const patientData = {
        id: pac.id || fallbackDoc?.pacienteId || "",
        nombreCompleto: pac.nombreCompleto || fallbackDoc?.tercero || "Paciente Clínica",
        documento: pac.nroDocumento || fallbackDoc?.documentoTercero || "—",
        nroDocumento: pac.nroDocumento || fallbackDoc?.documentoTercero || "—",
        tipoDocumento: pac.tipoDocumento || "CC",
        direccion: (pac.direccion && pac.direccion !== "—") ? pac.direccion : (pac.barrio || "—"),
        ciudad: (pac.ciudad && pac.ciudad !== "—") ? pac.ciudad : "Sincelejo",
        telefono: (pac.celular && pac.celular !== "—") ? pac.celular : (pac.telefono || "—")
      };

      const tenantData = {
        inquilino: userProfile?.inquilino || "",
        logo: userProfile?.tenant?.logo || userProfile?.logo || "",
        nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "CLÍNICA DENTAL",
        nit: userProfile?.tenant?.nit || "",
        direccion: userProfile?.tenant?.direccion || "",
        telefono: userProfile?.tenant?.telefono || "",
        email: userProfile?.tenant?.email || ""
      };

      const planFinancials = {
        planTitle: conceptoStr,
        totalPlan: valNum,
        totalPagado: valNum,
        saldo: 0
      };

      await printReciboCaja({
        recibo: recData,
        patient: patientData,
        userProfile: userProfile,
        tenant: tenantData,
        planInfo: planFinancials
      });
    } catch (err) {
      console.error("Error al imprimir recibo de caja:", err);
    }
  };

  const handlePrintInvoiceDoc = (facItem, fallbackDoc) => {
    try {
      const rawFac = facItem.rawFactura || fallbackDoc?.rawFactura || {};
      const pac = facItem.pacienteObj || fallbackDoc?.pacienteObj || {};
      const valNum = Number(facItem.valor !== undefined ? facItem.valor : (fallbackDoc?.valor || 0));
      const nroFactura = facItem.numeroDocumento || fallbackDoc?.numeroDocumento || "FCEV-0001";
      const conceptoStr = facItem.concepto || fallbackDoc?.concepto || "Consulta / Tratamiento Odontológico";

      const facturaPayload = {
        ...rawFac,
        nro_factura: nroFactura,
        factusInvoiceNumber: nroFactura,
        numero_factura: nroFactura,
        total: valNum,
        monto: valNum,
        subtotal: valNum,
        fecha: facItem.fecha || fallbackDoc?.fechaSeleccionada || fallbackDoc?.fechaCreacion,
        pacienteNombre: pac.nombreCompleto || fallbackDoc?.tercero || "Paciente",
        pacienteDocumento: pac.nroDocumento || fallbackDoc?.documentoTercero || "—",
        pacienteDireccion: pac.direccion || "—",
        pacienteCiudad: pac.ciudad || "Sincelejo",
        profesionalNombre: fallbackDoc?.profesional || "Administración",
        doctor: fallbackDoc?.profesional || "Administración",
        items: (Array.isArray(rawFac.items) && rawFac.items.length > 0)
          ? rawFac.items
          : [
              {
                concepto: conceptoStr,
                descripcion: conceptoStr,
                cantidad: 1,
                precioUnitario: valNum,
                total: valNum
              }
            ]
      };

      printElectronicInvoice({
        factura: facturaPayload,
        patient: pac,
        userProfile,
        tenant: userProfile?.tenant
      });
    } catch (err) {
      console.error("Error al imprimir factura electrónica:", err);
    }
  };

  const handlePrintEgresoDoc = async (egrItem, fallbackDoc) => {
    try {
      const rawEgr = egrItem.rawEgreso || fallbackDoc?.rawEgreso || {};
      const valNum = Number(egrItem.valor !== undefined ? egrItem.valor : (rawEgr.total || fallbackDoc?.valor || 0));
      const nroDoc = egrItem.numeroDocumento || rawEgr.numeroDocumento || fallbackDoc?.numeroDocumento || "EGR-0001";
      const conceptoStr = egrItem.concepto || rawEgr.concepto || fallbackDoc?.concepto || "Pago a Proveedor";

      const pagoData = {
        tipo: "egreso",
        tipoDoc: "Comprobante de Egreso",
        documentTitle: "Comprobante de Egreso",
        monto: valNum,
        total: valNum,
        medio: rawEgr.medioPago || rawEgr.formaPago || fallbackDoc?.formaPago || "Efectivo",
        concepto: conceptoStr,
        notas: rawEgr.observaciones || fallbackDoc?.observaciones || "",
        fecha: egrItem.fecha || fallbackDoc?.fechaSeleccionada || fallbackDoc?.fechaCreacion || new Date().toISOString(),
        nroConsecutivo: nroDoc,
        registradoPor: rawEgr.usuarioCreador || fallbackDoc?.usuarioCreador || userProfile?.nombreCompleto || "Administración",
        planTitle: conceptoStr,
        tercero: rawEgr.proveedor || rawEgr.tercero || fallbackDoc?.tercero || "Proveedor",
        proveedor: rawEgr.proveedor || rawEgr.tercero || fallbackDoc?.tercero || "Proveedor",
        documentoTercero: rawEgr.nit || rawEgr.documento || fallbackDoc?.documentoTercero || "",
        items: [
          {
            concepto: conceptoStr,
            descripcion: conceptoStr,
            precioUnitario: valNum,
            cantidad: 1,
            total: valNum
          }
        ]
      };

      const clinicData = {
        inquilino: userProfile?.inquilino || "",
        logo: userProfile?.tenant?.logo || userProfile?.logo || "",
        nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "CLÍNICA DENTAL",
        nit: userProfile?.tenant?.nit || "",
        direccion: userProfile?.tenant?.direccion || "",
        telefono: userProfile?.tenant?.telefono || "",
        email: userProfile?.tenant?.email || "",
      };

      const patientData = {
        nombreCompleto: rawEgr.proveedor || rawEgr.tercero || fallbackDoc?.tercero || "Proveedor",
        nroDocumento: rawEgr.nit || rawEgr.documento || fallbackDoc?.documentoTercero || "—",
        tipoDocumento: "NIT",
      };

      await ReceiptPrintService.generatePDF(pagoData, patientData, clinicData, userProfile);
    } catch (err) {
      console.error("Error al imprimir comprobante de egreso:", err);
    }
  };

  const handlePrintAssociatedDoc = async (docItem) => {
    if (!docItem) return;
    const tipo = (docItem.tipoDocumento || "").toLowerCase();
    if (tipo.includes("recibo")) {
      await handlePrintReceiptDoc(docItem, selectedDoc);
    } else if (tipo.includes("egreso")) {
      await handlePrintEgresoDoc(docItem, selectedDoc);
    } else {
      handlePrintInvoiceDoc(docItem, selectedDoc);
    }
  };

  const handlePrintMainDoc = async (r) => {
    if (!r) return;
    const tipo = (r.tipoDocumento || "").toLowerCase();
    if (tipo.includes("factura de venta")) {
      handlePrintInvoiceDoc(r, r);
    } else if (tipo.includes("recibo") || tipo.includes("saldo a favor") || tipo.includes("anticipo")) {
      await handlePrintReceiptDoc(r, r);
    } else if (tipo.includes("egreso")) {
      await handlePrintEgresoDoc(r, r);
    } else {
      setSelectedDoc(r);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f4f7fb] font-sans text-slate-700 pb-12">
      
      {/* ─── BARRA DE ACCIONES (SIN ENCABEZADO DUPLICADO) ─── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Módulo Financiero:</span>
          <span className="text-xs font-bold text-slate-800 bg-sky-50 text-[#009beb] px-2 py-0.5 rounded border border-sky-200">
            Reporte de facturación y movimientos
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
                ref={fechaIniPickerRef}
                value={fechaInicial}
                disabled={isAllHistory}
                onChange={(e) => {
                  setFechaInicial(e.target.value);
                  setIsAllHistory(false);
                }}
                className={`w-full h-8 px-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium cursor-pointer ${isAllHistory ? 'bg-slate-100 text-slate-400' : ''}`}
                max="9999-12-31" min="1900-01-01"
              />
              <button
                type="button"
                disabled={isAllHistory}
                onClick={() => {
                  try { fechaIniPickerRef.current?.showPicker?.(); } catch (err) { fechaIniPickerRef.current?.focus?.(); }
                }}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer rounded hover:bg-slate-100 transition-colors"
                title="Abrir calendario"
              >
                📅
              </button>
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
                ref={fechaFinPickerRef}
                value={fechaFinal}
                disabled={isAllHistory}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setIsAllHistory(false);
                }}
                className={`w-full h-8 px-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium cursor-pointer ${isAllHistory ? 'bg-slate-100 text-slate-400' : ''}`}
                max="9999-12-31" min="1900-01-01"
              />
              <button
                type="button"
                disabled={isAllHistory}
                onClick={() => {
                  try { fechaFinPickerRef.current?.showPicker?.(); } catch (err) { fechaFinPickerRef.current?.focus?.(); }
                }}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer rounded hover:bg-slate-100 transition-colors"
                title="Abrir calendario"
              >
                📅
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Oficina / Tipo de movimiento (CON CONTEO REAL) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Oficina / Sede</label>
            <select
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium uppercase"
            >
              {oficinasList.map(of => (
                <option key={of.id} value={of.nombre}>{of.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de movimiento</label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
            >
              {TIPO_MOVIMIENTO_OPTIONS.map(opt => {
                if (opt === "Seleccione") {
                  return (
                    <option key={opt} value="Seleccione">
                      Seleccione
                    </option>
                  );
                }
                const cnt = movementTypeCounts[opt] ?? 0;
                return (
                  <option key={opt} value={opt}>
                    {opt} {cnt > 0 ? `(${cnt})` : `(0)`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Fila 3: Información contable + Profesionales + Botones Buscar y Limpiar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          
          {/* Switch Información contable */}
          <div className="flex items-center gap-3 h-8">
            <span className="text-xs font-medium text-slate-600">Información contable</span>
            <button
              type="button"
              onClick={() => {
                const nextVal = !informacionContable;
                setInformacionContable(nextVal);
                setVisibleColumns(prev => ({ ...prev, cuentaContable: nextVal }));
              }}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${informacionContable ? 'bg-[#009beb] justify-end' : 'bg-slate-300 justify-start'}`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-md" />
            </button>
            <span className="text-slate-400 text-[11px] cursor-help" title="Muestra las cuentas contables de cada movimiento">ⓘ</span>
          </div>

          {/* Profesionales */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Profesionales</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="w-full h-8 px-3 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium uppercase"
            >
              <option value="Todos">Todos</option>
              {profesionales.map(prof => (
                <option key={prof.id} value={prof.nombre}>{prof.nombre}</option>
              ))}
            </select>
          </div>

          {/* Botones Buscar y Limpiar */}
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
              className="flex-1 h-8 px-8 bg-[#8bc34a] hover:bg-[#7cb342] active:scale-[0.98] text-white font-bold text-xs rounded shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              <span>Buscar</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS 1:1 CON ORALDRIVE ─── */}
      {hasSearched && (
        <div className="mx-6 my-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[480px] overflow-hidden">
        
        {/* Barra superior de la tabla */}
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Movimientos registrados:</span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
              {appliedFilters.tipoMovimiento === "Seleccione" ? "Seleccione" : appliedFilters.tipoMovimiento} ({filteredData.length})
            </span>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Botón Descargar Excel */}
            <button
              onClick={handleExportExcel}
              title="Exportar a Excel"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <FiDownload size={15} />
            </button>

            {/* Selector de Columnas */}
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

            {/* Reset Filtros */}
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

        {/* Tabla completa */}
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[620px] min-h-[380px] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <div className="w-8 h-8 border-3 border-[#009beb] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-semibold text-slate-600">Cargando reporte de facturación...</span>
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
                    const isSelectFilter = key === "tipoDocumento" || key === "estado" || key === "consecutivo";
                    const isDate = key === "fechaCreacion" || key === "fechaSeleccionada";

                    return (
                      <th key={`filter-${key}`} className="px-2 py-1 border-r border-slate-200 font-normal">
                        {isSelectFilter ? (
                          <select
                            value={columnFilters[key] || "TODO"}
                            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                            className="w-full h-5 text-[10px] border border-slate-200 rounded outline-none focus:border-sky-500 text-slate-700 bg-white"
                          >
                            <option value="TODO">(Todo)</option>
                            {key === "tipoDocumento" && (
                              <>
                                <option value="Recibo de caja+">Recibo de caja+</option>
                                <option value="Factura de venta+">Factura de venta+</option>
                                <option value="Factura de compra">Factura de compra</option>
                                <option value="Egreso-">Egreso-</option>
                                <option value="Traslado+">Traslado+</option>
                                <option value="Traslado-">Traslado-</option>
                                <option value="Saldo a favor+">Saldo a favor+</option>
                                <option value="Anticipo+">Anticipo+</option>
                                <option value="Nota crédito+">Nota crédito+</option>
                                <option value="Nota débito-">Nota débito-</option>
                              </>
                            )}
                            {key === "estado" && (
                              <>
                                <option value="Activo">Activo</option>
                                <option value="Anulado">Anulado</option>
                              </>
                            )}
                            {key === "consecutivo" && (
                              <option value="Principal">Principal</option>
                            )}
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
                {filteredData.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-2 py-2 border-r border-slate-100 text-center">
                        <input type="checkbox" className="rounded text-[#009beb] w-3.5 h-3.5 cursor-pointer" />
                      </td>

                      {visibleColumns.numeroDocumento && (
                        <td
                          onClick={() => handlePrintMainDoc(r)}
                          className="px-3.5 py-2 border-r border-slate-100 font-mono font-bold text-[#009beb] hover:underline cursor-pointer"
                          title="Imprimir soporte de documento"
                        >
                          {r.numeroDocumento}
                        </td>
                      )}
                      {visibleColumns.tipoDocumento && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-semibold text-slate-800">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.tipoDocumento.includes("Recibo") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            r.tipoDocumento.includes("Factura de venta") ? "bg-sky-50 text-sky-700 border border-sky-200" :
                            r.tipoDocumento.includes("Saldo a favor") ? "bg-teal-50 text-teal-700 border border-teal-200" :
                            r.tipoDocumento.includes("Anticipo") ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                            r.tipoDocumento.includes("Egreso") ? "bg-rose-50 text-rose-700 border border-rose-200" :
                            r.tipoDocumento.includes("Compra") ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            r.tipoDocumento.includes("Traslado") ? "bg-purple-50 text-purple-700 border border-purple-200" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {r.tipoDocumento}
                          </span>
                        </td>
                      )}
                      {visibleColumns.fechaCreacion && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {formatDateTime(r.fechaCreacion)}
                        </td>
                      )}
                      {visibleColumns.fechaSeleccionada && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {formatDateOnly(r.fechaSeleccionada)}
                        </td>
                      )}
                      {visibleColumns.concepto && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700 font-medium max-w-xs truncate" title={r.concepto}>
                          {r.concepto}
                        </td>
                      )}
                      {visibleColumns.valor && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono font-bold text-right text-slate-800">
                          $ {Number(r.valor || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.consecutivo && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {r.consecutivo}
                        </td>
                      )}
                      {visibleColumns.docReferencia && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-slate-600 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(r)}
                            className="inline-flex items-center justify-center p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-[#009beb] transition-colors cursor-pointer"
                            title="Ver documento de referencia"
                          >
                            <FiEye size={13} />
                          </button>
                        </td>
                      )}
                      {visibleColumns.documentosAsociados && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-500 font-mono text-center">
                          {r.documentosAsociados || "—"}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.estado === 'Anulado' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                            {r.estado}
                          </span>
                        </td>
                      )}
                      {visibleColumns.tercero && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-medium text-slate-800 uppercase">
                          {r.tercero}
                        </td>
                      )}
                      {visibleColumns.documentoTercero && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-slate-600">
                          {r.documentoTercero || "—"}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700 uppercase">
                          {r.profesional || "Sin asignar"}
                        </td>
                      )}
                      {visibleColumns.formaPago && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {r.formaPago}
                        </td>
                      )}
                      {visibleColumns.subtotal && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-600">
                          $ {Number(r.subtotal || r.valor || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.descuento && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-500">
                          $ {Number(r.descuento || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.iva && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-500">
                          $ {Number(r.iva || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.retencion && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-500">
                          $ {Number(r.retencion || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.total && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono font-bold text-right text-slate-800">
                          $ {Number(r.total || r.valor || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.usuarioCreador && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {r.usuarioCreador || "Administración"}
                        </td>
                      )}
                      {visibleColumns.observaciones && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-500 italic max-w-xs truncate" title={r.observaciones}>
                          {r.observaciones || "—"}
                        </td>
                      )}
                      {visibleColumns.cuentaContable && (
                        <td className="px-3.5 py-2 font-mono text-slate-600">
                          {r.cuentaContable}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredData.length === 0 && (
                  <tr>
                    <td
                      colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                      className="px-6 py-14 text-center"
                    >
                      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                        <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mb-3">
                          <FiDollarSign size={22} />
                        </div>
                        <div className="text-sm font-bold text-slate-700 mb-1">
                          {appliedFilters.tipoMovimiento === "Seleccione"
                            ? "Seleccione un tipo de movimiento"
                            : "No se encontraron transacciones financieras"}
                        </div>
                        <div className="text-xs text-slate-500 mb-4 text-center">
                          {appliedFilters.tipoMovimiento === "Seleccione"
                            ? "Elija una opción en 'Tipo de movimiento' (o seleccione 'Todos') y haga clic en Buscar para consultar las transacciones del período."
                            : (allTransactions.length > 0 
                                ? `Los filtros actuales no coinciden con ningún movimiento. Existen ${allTransactions.length} transacciones registradas en total.` 
                                : "No se registran movimientos financieros en este inquilino.")}
                        </div>
                        {appliedFilters.tipoMovimiento === "Seleccione" ? (
                          <button
                            onClick={() => {
                              setTipoMovimiento("Todos");
                              setAppliedFilters(prev => ({ ...prev, tipoMovimiento: "Todos" }));
                            }}
                            className="px-4 py-2 bg-[#8bc34a] hover:bg-[#7cb342] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <span>Ver todos los movimientos del período ({movementTypeCounts["Todos"] || 0})</span>
                          </button>
                        ) : (
                          allTransactions.length > 0 && (
                            <button
                              onClick={handleResetFilters}
                              className="px-4 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                            >
                              <span>Restablecer filtros</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie de tabla con totalizadores en tiempo real */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 shrink-0 gap-3 font-medium">
          <span>
            Total de transacciones: <strong>{filteredData.length}</strong> de <strong>{allTransactions.length}</strong>
          </span>
          <div className="flex items-center gap-6 text-xs font-semibold">
            <span>Recaudos / Ingresos (+): <strong className="text-emerald-600">$ {totalIngresos.toLocaleString('es-CO')}</strong></span>
            <span>Total Facturado (FEV): <strong className="text-sky-600">$ {totalFacturado.toLocaleString('es-CO')}</strong></span>
            <span>Egresos (-): <strong className="text-rose-600">$ {totalEgresos.toLocaleString('es-CO')}</strong></span>
            <span>Balance Neto: <strong className={totalIngresos - totalEgresos >= 0 ? "text-sky-700" : "text-rose-700"}>$ {(totalIngresos - totalEgresos).toLocaleString('es-CO')}</strong></span>
          </div>
        </div>

      </div>
      )}

      {/* ─── MODAL DOCUMENTOS ASOCIADOS (1:1 CON ORALDRIVE) ─── */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
            
            {/* Header del modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <h3 className="text-base font-semibold text-slate-800">
                Documentos asociados
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-lg leading-none"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Contenido / Tabla de Documentos Asociados */}
            <div className="p-6">
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-medium">
                      <th className="py-2.5 px-4 text-center font-semibold w-1/4">Número documento</th>
                      <th className="py-2.5 px-4 font-semibold w-1/4">Tipo documento</th>
                      <th className="py-2.5 px-4 text-center font-semibold w-1/4">Valor</th>
                      <th className="py-2.5 px-4 text-center font-semibold w-1/4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                    {(() => {
                      const docs = getAssociatedDocs(selectedDoc);
                      if (docs.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                              No hay documentos asociados disponibles
                            </td>
                          </tr>
                        );
                      }
                      return docs.map((doc, idx) => (
                        <tr key={doc.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-slate-800">
                            {doc.numeroDocumento}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {doc.tipoDocumento}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-800 font-medium">
                            {Number(doc.valor || 0).toLocaleString('es-CO')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handlePrintAssociatedDoc(doc)}
                              className="inline-flex items-center justify-center w-7 h-7 bg-[#009beb] hover:bg-[#0087cd] active:scale-95 text-white rounded transition-all cursor-pointer shadow-xs"
                              title="Imprimir soporte oficial"
                            >
                              <FiPrinter size={14} />
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-white">
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors cursor-pointer"
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
