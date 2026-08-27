import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import supabase from "../../../lib/supabaseClient";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { getConfigItems } from "../../../services/configPersistenceService";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";
import { FiDollarSign, FiSearch, FiFileText, FiFilter, FiDownload, FiCheck, FiX, FiEye, FiPrinter } from "react-icons/fi";
import { format } from "date-fns";
import * as XLSX from "xlsx";

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

  // Filtros del formulario superior (1:1 con OralDrive)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fechaInicial, setFechaInicial] = useState(format(firstDayOfMonth, "yyyy-MM-dd"));
  const [fechaFinal, setFechaFinal] = useState(format(now, "yyyy-MM-dd"));
  const [oficina, setOficina] = useState("Todas las oficinas");
  const [tipoMovimiento, setTipoMovimiento] = useState("Todos");
  const [informacionContable, setInformacionContable] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState("Todos");

  // Estado de si se ha presionado Buscar
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros aplicados al presionar "Buscar"
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicial: format(firstDayOfMonth, "yyyy-MM-dd"),
    fechaFinal: format(now, "yyyy-MM-dd"),
    oficina: "Todas las oficinas",
    tipoMovimiento: "Todos",
    informacionContable: false,
    profesional: "Todos"
  });

  // Estado para visualización modal de Documento de Referencia (Ojito)
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Búsqueda rápida global en tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  // Filtros individuales por columna
  const [columnFilters, setColumnFilters] = useState({});

  // Control selector de columnas
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Referencias para calendar pickers
  const fechaIniPickerRef = useRef(null);
  const fechaFinPickerRef = useRef(null);
  const tableContainerRef = useRef(null);

  // Columnas idénticas 1:1 con OralDrive
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
    cuentaContable: false // Visible cuando Información contable está activa
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

  // Cargar datos reales desde Supabase
  useEffect(() => {
    const fetchData = async () => {
      const tenantId = userProfile?.inquilino || userProfile?.tenant_id;
      if (!tenantId) return;
      setLoading(true);

      try {
        // 1. Cargar Sucursales / Sedes
        let sucursalesData = [];
        try {
          sucursalesData = await getConfigItems(tenantId, "sucursales", "sucursales");
        } catch (e) {
          console.warn("Error cargando sucursales:", e);
        }

        const sedesList = [{ id: "TODAS", nombre: "Todas las oficinas" }];
        (sucursalesData || []).forEach(s => {
          const nom = s.nombre || s.name || s.nombreSede || "Sede";
          if (nom && !sedesList.some(item => item.nombre.toLowerCase() === nom.toLowerCase())) {
            sedesList.push({ id: s.id || nom, nombre: nom });
          }
        });
        if (sedesList.length === 1) {
          sedesList.push({ id: "PRINCIPAL", nombre: "ATM CENTRO DEL DOLOR OROFACIAL - SEDE PRINCIPAL" });
        }
        setOficinasList(sedesList);

        // 2. Cargar Pacientes para relacionar nombres y documentos
        let dataPacientes = [];
        try {
          const { data } = await supabase
            .from("pacientes")
            .select("*")
            .eq("tenant_id", tenantId);
          if (data) dataPacientes = data;
        } catch (e) {}

        const pacDict = {};
        (dataPacientes || []).forEach(p => {
          const nom = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`.trim() || p.nombreCompleto || p.documento || "Paciente";
          const doc = p.documento || p.nroDocumento || p.identificacion || "";
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

        // 3. Cargar Profesionales / Doctores
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

        const allRows = [];

        // Helper para verificar consumo de saldo
        const isConsumoSaldo = (item, metadata = {}) => {
          const cond = (item.condicionPago || item.condicion || item.metodo_pago || item.metodo || item.medio || metadata.metodo || metadata.medio || "").toLowerCase();
          const conc = (item.concepto || item.referencia || item.notas || metadata.concepto || metadata.referencia || "").toLowerCase();
          return cond.includes("consumo") || 
                 cond === "saldo a favor" || 
                 cond.includes("saldo a favor") ||
                 conc.includes("uso saldo a favor") ||
                 conc.includes("consumo s. a favor") ||
                 conc.includes("consumo saldo a favor");
        };

        // 4. Cargar Pagos y Recibos de Caja (Unificados con Consecutivo 1999, 2000, 2001...)
        let rawRecibosList = [];
        try {
          const { data: snapRecibos } = await supabase
            .from("recibos_caja")
            .select("*")
            .eq("tenant_id", tenantId);
          if (snapRecibos && snapRecibos.length > 0) rawRecibosList = snapRecibos;
        } catch (e) {}

        let rawPagosList = [];
        try {
          const { data: snapPagos } = await supabase
            .from("pagos")
            .select("*")
            .eq("tenant_id", tenantId);
          if (snapPagos && snapPagos.length > 0) rawPagosList = snapPagos;
        } catch (e) {}

        const mappedRecibosCaja = (rawRecibosList || [])
          .filter(d => !isConsumoSaldo(d))
          .map(d => {
            const pId = d.paciente_id || d.pacienteId || d.patient_id || d.paciente;
            const pac = pacDict[pId] || {};
            const pacNom = d.pacienteNombre || pac.nombreCompleto || "Paciente";
            const pacDoc = d.pacienteDocumento || pac.nroDocumento || "";
            const montoNum = Number(d.total || d.monto || d.valor || 0);
            const isAnulado = (d.estado || "").toLowerCase() === "anulado";
            const rawObs = d.observaciones || d.notas || "";

            return {
              id: `rec_${d.id}`,
              rawId: d.id,
              pacienteId: pId,
              pacienteObj: pac,
              tipoDocumento: "Recibo de caja+",
              fechaCreacion: d.created_at || d.fecha || new Date().toISOString(),
              fechaSeleccionada: d.fecha || d.created_at || new Date().toISOString(),
              concepto: d.concepto || d.motivo || (Array.isArray(d.conceptos) && d.conceptos[0]?.concepto) || d.descripcion || "Recibo de caja",
              valor: montoNum,
              consecutivo: "Principal",
              nroConsecutivo: d.nroConsecutivo || d.consecutivo || d.numero || null,
              docReferencia: d.referencia || d.comprobante || "",
              documentosAsociados: d.plan_id ? `PLAN-${String(d.plan_id).slice(0, 6).toUpperCase()}` : "—",
              planId: d.plan_id || null,
              estado: isAnulado ? "Anulado" : "Activo",
              tercero: pacNom,
              documentoTercero: pacDoc,
              profesional: d.profesionalNombre || d.doctorNombre || d.doctor || "Guillermo Rodriguez",
              profesionalId: d.profesional_id || "",
              formaPago: d.medioPago || d.condicionPago || d.medio || "Efectivo",
              subtotal: montoNum,
              descuento: 0,
              iva: 0,
              retencion: 0,
              total: montoNum,
              usuarioCreador: d.usuario_nombre || d.creado_por || "Administración",
              observaciones: cleanObservaciones(rawObs),
              cuentaContable: "110505 - Caja General",
              oficina: d.oficina || d.sucursal || d.sede || ""
            };
          });

        const mappedPagosRecaudos = (rawPagosList || [])
          .map(pData => {
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

            return {
              id: `pago_${pData.id}`,
              rawId: pData.id,
              pacienteId: pacId || pac.id || "",
              pacienteObj: pac,
              tipoDocumento: "Recibo de caja+",
              fechaCreacion: pData.created_at || pData.fechaISO || pData.fecha || new Date().toISOString(),
              fechaSeleccionada: pData.fechaISO || pData.fecha || pData.created_at || new Date().toISOString(),
              concepto: metadata.concepto || pData.concepto || (Array.isArray(pData.items) && pData.items[0]?.concepto) || pData.descripcion || "Abono a tratamiento",
              valor: montoNum,
              consecutivo: "Principal",
              nroConsecutivo: storedCons,
              docReferencia: metadata.referencia || pData.referencia || "",
              documentosAsociados: pData.plan_id ? `PLAN-${String(pData.plan_id).slice(0, 6).toUpperCase()}` : "—",
              planId: pData.plan_id || null,
              estado: isAnulado ? "Anulado" : "Activo",
              tercero: pacNom,
              documentoTercero: pacDoc,
              profesional: metadata.doctor || pData.profesional || pData.odontologo || pData.doctor || "Guillermo Rodriguez",
              profesionalId: pData.profesional_id || pData.doctorId || "",
              formaPago: medioRaw,
              subtotal: montoNum,
              descuento: 0,
              iva: 0,
              retencion: 0,
              total: montoNum,
              usuarioCreador: pData.usuario_nombre || pData.creado_por || "Administración",
              observaciones: cleanObservaciones(rawObs),
              cuentaContable: "110505 - Caja General",
              oficina: pData.oficina || pData.sucursal || pData.sede || "",
              _raw: pData,
              _meta: metadata
            };
          })
          .filter(p => !isConsumoSaldo(p._raw, p._meta));

        // Combinar todos los recibos de caja y asignar consecutivo cronológico unificado
        let combinedRecibos = [...mappedRecibosCaja, ...mappedPagosRecaudos];
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

        // 5. Cargar Movimientos de Caja (Egresos, Compras, Traslados)
        try {
          const { data: snapMovs } = await supabase
            .from("movimientos_caja")
            .select("*")
            .eq("tenant_id", tenantId);

          let egresoIdx = 1001;
          let trasladoIdx = 101;
          (snapMovs || []).forEach(m => {
            const montoNum = Number(m.monto || 0);
            const tipo = (m.tipo || "").toLowerCase();
            let labelTipo = "Egreso-";
            let defaultPrefix = "EGR";
            if (tipo === "ingreso") {
              labelTipo = "Recibo de caja+";
              defaultPrefix = "REC";
            } else if (tipo === "traslado") {
              labelTipo = "Traslado-";
              defaultPrefix = "TRA";
            } else if (tipo === "compra") {
              labelTipo = "Factura de compra";
              defaultPrefix = "FC";
            }

            const storedCons = m.nroConsecutivo || m.consecutivo || m.comprobante || m.numero;
            const nroDoc = storedCons && !isNaN(Number(storedCons))
              ? Number(storedCons)
              : (storedCons || (tipo === 'traslado' ? trasladoIdx++ : egresoIdx++));

            const isAnulado = (m.estado || "").toLowerCase() === "anulado";
            const rawObs = m.observaciones || m.notas || m.descripcion || "";
            const cleanObs = cleanObservaciones(rawObs);
            const refClean = cleanDocReferencia(m.categoria || m.comprobante, String(nroDoc));

            allRows.push({
              id: `mov_${m.id}`,
              rawId: m.id,
              numeroDocumento: nroDoc,
              tipoDocumento: labelTipo,
              fechaCreacion: m.created_at || new Date().toISOString(),
              fechaSeleccionada: m.fecha || m.created_at || new Date().toISOString(),
              concepto: m.concepto || m.descripcion || m.categoria || m.motivo || (tipo === 'traslado' ? "Traslado de fondos" : "Egreso de caja"),
              valor: montoNum,
              consecutivo: "Principal",
              docReferencia: refClean,
              documentosAsociados: m.factura_asociada || "—",
              estado: isAnulado ? "Anulado" : "Activo",
              tercero: m.beneficiario || m.proveedor || "Proveedor / Tercero",
              documentoTercero: m.nit || m.documento || "",
              profesional: m.profesional || "Guillermo Rodriguez",
              profesionalId: m.profesional_id || "",
              formaPago: m.metodo_pago || m.forma_pago || "Efectivo",
              subtotal: montoNum,
              descuento: 0,
              iva: 0,
              retencion: 0,
              total: montoNum,
              usuarioCreador: m.usuario_nombre || m.creado_por || "Administración",
              observaciones: cleanObs,
              cuentaContable: tipo === "egreso" ? "510506 - Gastos Operativos" : "110505 - Caja General",
              oficina: m.oficina || m.sucursal || m.sede || ""
            });
          });
        } catch (e) {}

        // 6. Cargar Facturas de Venta / Facturas Electrónicas
        try {
          let snapFacturas = [];
          try {
            const { data: feDb } = await supabase
              .from("facturas_electronicas")
              .select("*")
              .eq("tenant_id", tenantId);
            if (feDb && feDb.length > 0) snapFacturas.push(...feDb);
          } catch (e) {}

          try {
            const { data: fDb } = await supabase
              .from("facturas")
              .select("*")
              .eq("tenant_id", tenantId);
            if (fDb && fDb.length > 0) {
              fDb.forEach(f => {
                if (!snapFacturas.some(c => c.id === f.id || (c.factusInvoiceNumber && c.factusInvoiceNumber === f.numero))) {
                  snapFacturas.push(f);
                }
              });
            }
          } catch (e) {}

          (snapFacturas || []).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)).forEach((f, fIdx) => {
            const pacId = f.paciente_id || f.pacienteId;
            const pac = pacDict[pacId] || pacDict[f.documento] || pacDict[f.pacienteDocumento] || {};
            const pacNom = f.pacienteNombre || f.paciente_nombre || pac.nombreCompleto || "Paciente";
            const pacDoc = f.pacienteDocumento || f.paciente_documento || pac.nroDocumento || "";

            const totalNum = Number(f.total || f.monto || 0);
            const subtotalNum = Number(f.subtotal || totalNum);
            const ivaNum = Number(f.iva || 0);
            const descNum = Number(f.descuento || 0);
            
            const storedCons = f.factusInvoiceNumber || f.nro_factura || f.numero_factura || f.nroConsecutivo || f.numero;
            const nroDoc = storedCons && !isNaN(Number(storedCons))
              ? (f.prefijo ? `${f.prefijo}${storedCons}` : `FCEV-${storedCons}`)
              : (storedCons || `FCEV-${1201 + fIdx}`);

            const isAnulado = (f.estado || "").toLowerCase() === "anulado";
            const rawObs = f.notas || f.observaciones || "";
            const cleanObs = cleanObservaciones(rawObs);
            const refClean = cleanDocReferencia(f.resolucion || f.cufe, String(nroDoc));

            allRows.push({
              id: `fac_${f.id}`,
              rawId: f.id,
              numeroDocumento: nroDoc,
              tipoDocumento: "Factura de venta+",
              fechaCreacion: f.created_at || f.fechaISO || new Date().toISOString(),
              fechaSeleccionada: f.fecha || f.fechaISO || f.created_at || new Date().toISOString(),
              concepto: f.concepto || (Array.isArray(f.items) && f.items[0]?.descripcion) || (Array.isArray(f.conceptos) && f.conceptos[0]?.concepto) || f.descripcion || "Consulta / Tratamiento Odontológico",
              valor: totalNum,
              consecutivo: "Principal",
              docReferencia: refClean,
              documentosAsociados: (f.factusCufe || f.cufe) ? `CUFE: ${String(f.factusCufe || f.cufe).slice(0, 10)}...` : "—",
              estado: isAnulado ? "Anulado" : "Activo",
              tercero: pacNom,
              documentoTercero: pacDoc,
              profesional: f.profesional_nombre || f.profesional || "Guillermo Rodriguez",
              profesionalId: f.profesional_id || "",
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
        } catch (e) {}

        // 7. Cargar Facturas de Compra
        try {
          const { data: snapFacturasCompra } = await supabase
            .from("facturas_compra")
            .select("*")
            .eq("tenant_id", tenantId);

          (snapFacturasCompra || []).forEach((fc, fcIdx) => {
            const totalNum = Number(fc.total || fc.monto || 0);
            const storedCons = fc.numero || fc.nroFactura || fc.nro_factura || fc.nroConsecutivo;
            const nroDoc = storedCons ? storedCons : `FC-${201 + fcIdx}`;

            allRows.push({
              id: `fc_${fc.id}`,
              rawId: fc.id,
              numeroDocumento: nroDoc,
              tipoDocumento: "Factura de compra",
              fechaCreacion: fc.created_at || new Date().toISOString(),
              fechaSeleccionada: fc.fecha || fc.created_at || new Date().toISOString(),
              concepto: fc.concepto || fc.descripcion || (Array.isArray(fc.items) && fc.items[0]?.concepto) || "Compra de insumos / Materiales",
              valor: totalNum,
              consecutivo: "Principal",
              docReferencia: fc.numero || nroDoc,
              documentosAsociados: "—",
              estado: (fc.estado || "Activo"),
              tercero: fc.proveedor || fc.tercero || "Proveedor",
              documentoTercero: fc.documentoTercero || fc.nit || "",
              profesional: "Administración",
              profesionalId: "",
              formaPago: fc.formaPago || "Contado",
              subtotal: totalNum,
              descuento: 0,
              iva: 0,
              retencion: 0,
              total: totalNum,
              usuarioCreador: "Administración",
              observaciones: cleanObservaciones(fc.observaciones || fc.descripcion || ""),
              cuentaContable: "510506 - Gastos Operativos",
              oficina: fc.oficina || ""
            });
          });
        } catch (e) {}

        // 8. Cargar Notas Crédito
        try {
          const { data: snapNotasCredito } = await supabase
            .from("notas_credito")
            .select("*")
            .eq("tenant_id", tenantId);

          (snapNotasCredito || []).forEach((nc, ncIdx) => {
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
              profesional: nc.profesional || "Guillermo Rodriguez",
              profesionalId: "",
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
        } catch (e) {}

        // 9. Cargar Notas Débito
        try {
          const { data: snapNotasDebito } = await supabase
            .from("notas_debito")
            .select("*")
            .eq("tenant_id", tenantId);

          (snapNotasDebito || []).forEach((nd, ndIdx) => {
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
              profesional: nd.profesional || "Guillermo Rodriguez",
              profesionalId: "",
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
        } catch (e) {}

        allRows.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
        setAllTransactions(allRows);

      } catch (error) {
        console.error("Error cargando reporte de facturación:", error);
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

  const formatDateOnly = (dateVal) => {
    if (!dateVal) return "";
    const dt = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return isNaN(dt.getTime()) ? String(dateVal) : format(dt, "dd/MM/yyyy");
  };

  // Filtrado reactivo de movimientos
  const filteredData = useMemo(() => {
    return allTransactions.filter(r => {
      // 1. Filtro por Fechas
      if (appliedFilters.fechaInicial && appliedFilters.fechaInicial.trim() !== "") {
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
        
        // Si el registro no tiene sede explícita, se asocia por defecto a la Sede Principal
        if (!rOficina && !rOficinaId) {
          const isPrincipal = targetOficina.includes("principal") || targetOficina.includes("centro del dolor");
          matchesOffice = isPrincipal;
        }

        if (!matchesOffice) return false;
      }

      // 3. Filtro por Tipo de Movimiento
      if (appliedFilters.tipoMovimiento && appliedFilters.tipoMovimiento !== "Todos") {
        const targetMov = appliedFilters.tipoMovimiento.toLowerCase().replace(/[+\-]/g, "").trim();
        const rTipo = (r.tipoDocumento || "").toLowerCase().replace(/[+\-]/g, "").trim();
        if (!rTipo.includes(targetMov) && !targetMov.includes(rTipo)) return false;
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
        const term = tableSearchTerm.toLowerCase();
        const matchesSearch =
          (r.numeroDocumento || "").toLowerCase().includes(term) ||
          (r.tipoDocumento || "").toLowerCase().includes(term) ||
          (r.tercero || "").toLowerCase().includes(term) ||
          (r.documentoTercero || "").toLowerCase().includes(term) ||
          (r.profesional || "").toLowerCase().includes(term) ||
          (r.concepto || "").toLowerCase().includes(term) ||
          (r.estado || "").toLowerCase().includes(term) ||
          (r.oficina || "").toLowerCase().includes(term);
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

  // Totales calculados
  const totalIngresos = useMemo(() => {
    return filteredData
      .filter(r => (r.tipoDocumento.includes("+") || r.tipoDocumento.includes("Recibo") || r.tipoDocumento.includes("Venta")) && r.estado !== "Anulado")
      .reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [filteredData]);

  const totalEgresos = useMemo(() => {
    return filteredData
      .filter(r => (r.tipoDocumento.includes("-") || r.tipoDocumento.includes("Egreso") || r.tipoDocumento.includes("Compra")) && r.estado !== "Anulado")
      .reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [filteredData]);

  // Manejar clic en "Buscar"
  const handleSearchClick = () => {
    setHasSearched(true);
    setAppliedFilters({
      fechaInicial,
      fechaFinal,
      oficina,
      tipoMovimiento,
      informacionContable,
      profesional: selectedProfesional
    });
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  };

  // Manejar cambio de filtro individual por columna
  const handleColumnFilterChange = (colKey, val) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: val
    }));
  };

  // Exportar reporte a Excel (respeta estrictamente las columnas visibles)
  const handleExportExcel = () => {
    const rows = filteredData.map(r => {
      const rowObj = {};
      if (visibleColumns.numeroDocumento) rowObj["Numero de documento"] = r.numeroDocumento || "";
      if (visibleColumns.tipoDocumento) rowObj["Tipo de documento"] = r.tipoDocumento || "";
      if (visibleColumns.fechaCreacion) rowObj["Fecha creación"] = formatDateTime(r.fechaCreacion);
      if (visibleColumns.fechaSeleccionada) rowObj["Fecha seleccionada"] = formatDateOnly(r.fechaSeleccionada);
      if (visibleColumns.concepto) rowObj["Concepto"] = r.concepto || "";
      if (visibleColumns.valor) rowObj["Valor"] = Number(r.valor || 0);
      if (visibleColumns.consecutivo) rowObj["Consecutivo"] = r.consecutivo || "Principal";
      if (visibleColumns.docReferencia) rowObj["Doc. Referencia"] = r.docReferencia || "";
      if (visibleColumns.documentosAsociados) rowObj["Documentos asociados"] = r.documentosAsociados || "";
      if (visibleColumns.estado) rowObj["Estado"] = r.estado || "Activo";
      if (visibleColumns.tercero) rowObj["Tercero / Paciente"] = r.tercero || "";
      if (visibleColumns.documentoTercero) rowObj["Documento tercero"] = r.documentoTercero || "";
      if (visibleColumns.profesional) rowObj["Profesional"] = r.profesional || "";
      if (visibleColumns.formaPago) rowObj["Forma de pago"] = r.formaPago || "";
      if (visibleColumns.subtotal) rowObj["Subtotal"] = Number(r.subtotal || r.valor || 0);
      if (visibleColumns.descuento) rowObj["Descuento"] = Number(r.descuento || 0);
      if (visibleColumns.iva) rowObj["IVA"] = Number(r.iva || 0);
      if (visibleColumns.retencion) rowObj["Retención"] = Number(r.retencion || 0);
      if (visibleColumns.total) rowObj["Total"] = Number(r.total || r.valor || 0);
      if (visibleColumns.usuarioCreador) rowObj["Elaborado por"] = r.usuarioCreador || "";
      if (visibleColumns.observaciones) rowObj["Observaciones"] = r.observaciones || "";
      if (visibleColumns.cuentaContable) rowObj["Cuenta contable"] = r.cuentaContable || "";
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Facturacion");
    
    const fileNameSuffix = `${appliedFilters.fechaInicial}_al_${appliedFilters.fechaFinal}`;
    XLSX.writeFile(workbook, `Reporte_Facturacion_${fileNameSuffix}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f4f7fb] font-sans text-slate-700 pb-12">
      
      {/* ─── ENCABEZADO Y BREADCRUMB ─── */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-slate-800 tracking-tight">Reporte facturación</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>🏠 Reportes</span>
            <span>/</span>
            <span className="text-slate-500">Reporte facturación</span>
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
        
        {/* Fila 1: Fecha inicial / Fecha final con selectores de calendario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicial</label>
            <div className="relative flex items-center">
              <input
                type="date"
                ref={fechaIniPickerRef}
                value={fechaInicial}
                onChange={(e) => setFechaInicial(e.target.value)}
                className="w-full h-8 px-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium cursor-pointer"
                max="9999-12-31" min="1900-01-01"
              />
              <button
                type="button"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha final</label>
            <div className="relative flex items-center">
              <input
                type="date"
                ref={fechaFinPickerRef}
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className="w-full h-8 px-3 pr-8 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium cursor-pointer"
                max="9999-12-31" min="1900-01-01"
              />
              <button
                type="button"
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

        {/* Fila 2: Oficina / Tipo de movimiento */}
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
              {TIPO_MOVIMIENTO_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 3: Información contable + Profesionales + Botón Buscar */}
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

          {/* Botón Buscar (Verde Oliva OralDrive) */}
          <div>
            <button
              onClick={handleSearchClick}
              className="w-full h-8 px-8 bg-[#8bc34a] hover:bg-[#7cb342] active:scale-[0.98] text-white font-bold text-xs rounded shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              <span>Buscar</span>
            </button>
          </div>

        </div>

      </div>

      {/* ─── TABLA DE RESULTADOS DATAGRID (SÓLO TRAS DAR CLIC EN BUSCAR) ─── */}
      {hasSearched && (
        <div className="mx-6 my-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[480px] overflow-hidden">
        
        {/* Barra superior de la tabla con agrupación OralDrive */}
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <span className="text-xs text-slate-400 font-normal italic">
            Arrastra una columna aquí para agrupar por ella
          </span>

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
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[620px] min-h-[380px] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <div className="w-7 h-7 border-2 border-[#009beb] border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs font-semibold">Cargando reporte de facturación...</span>
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
                    const isDate = key === "fechaCreacion" || key === "fechaSeleccionada";
                    const isSelect = key === "estado" || key === "tipoDocumento";

                    return (
                      <th key={`filter-${key}`} className="px-2 py-1 border-r border-slate-200 font-normal">
                        {isSelect ? (
                          <select
                            value={columnFilters[key] || "TODO"}
                            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                            className="w-full h-5 text-[10px] border border-slate-200 rounded outline-none focus:border-sky-500 text-slate-700 bg-white"
                          >
                            <option value="TODO">(Todo)</option>
                            {key === "estado" && (
                              <>
                                <option value="Activo">Activo</option>
                                <option value="Anulado">Anulado</option>
                              </>
                            )}
                            {key === "tipoDocumento" && (
                              <>
                                <option value="Recibo de caja+">Recibo de caja+</option>
                                <option value="Factura de venta+">Factura de venta+</option>
                                <option value="Factura de compra">Factura de compra</option>
                                <option value="Egreso-">Egreso-</option>
                                <option value="Traslado-">Traslado-</option>
                              </>
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
                  const isPositive = r.tipoDocumento.includes("+") || r.tipoDocumento.includes("Recibo") || r.tipoDocumento.includes("Venta");
                  const isAnulado = r.estado === "Anulado";

                  return (
                    <tr key={r.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-2 py-2 border-r border-slate-100 text-center">
                        <input type="checkbox" className="rounded text-[#009beb] w-3.5 h-3.5 cursor-pointer" />
                      </td>
                      {visibleColumns.numeroDocumento && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-bold text-[#009beb] hover:underline cursor-pointer">
                          {r.numeroDocumento}
                        </td>
                      )}
                      {visibleColumns.tipoDocumento && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-medium text-slate-700">
                          {r.tipoDocumento}
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
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700 max-w-[220px] truncate font-medium" title={r.concepto}>
                          {r.concepto || "—"}
                        </td>
                      )}
                      {visibleColumns.valor && (
                        <td className={`px-3.5 py-2 border-r border-slate-100 font-mono font-bold text-right ${isAnulado ? 'text-slate-400 line-through' : (isPositive ? 'text-emerald-600' : 'text-rose-600')}`}>
                          $ {Number(r.valor || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.consecutivo && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-600">
                          {r.consecutivo}
                        </td>
                      )}
                      {visibleColumns.docReferencia && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(r)}
                            title="Ver documento de referencia"
                            className="inline-flex items-center justify-center w-6 h-6 bg-[#009beb] hover:bg-[#0087cd] active:scale-95 text-white rounded shadow-xs transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                          </button>
                        </td>
                      )}
                      {visibleColumns.documentosAsociados && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-[#009beb] hover:underline cursor-pointer">
                          {r.documentosAsociados}
                        </td>
                      )}
                      {visibleColumns.estado && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${isAnulado ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {r.estado}
                          </span>
                        </td>
                      )}
                      {visibleColumns.tercero && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-semibold text-slate-800 uppercase">
                          {r.tercero}
                        </td>
                      )}
                      {visibleColumns.documentoTercero && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-slate-600">
                          {r.documentoTercero || "—"}
                        </td>
                      )}
                      {visibleColumns.profesional && (
                        <td className="px-3.5 py-2 border-r border-slate-100 uppercase text-slate-700">
                          {r.profesional}
                        </td>
                      )}
                      {visibleColumns.formaPago && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-700">
                          {r.formaPago}
                        </td>
                      )}
                      {visibleColumns.subtotal && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-700">
                          $ {Number(r.subtotal || r.valor || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.descuento && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-600">
                          $ {Number(r.descuento || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.iva && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-600">
                          $ {Number(r.iva || 0).toLocaleString('es-CO')}
                        </td>
                      )}
                      {visibleColumns.retencion && (
                        <td className="px-3.5 py-2 border-r border-slate-100 font-mono text-right text-slate-600">
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
                          {r.usuarioCreador}
                        </td>
                      )}
                      {visibleColumns.observaciones && (
                        <td className="px-3.5 py-2 border-r border-slate-100 text-slate-500">
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
                      className="px-6 py-12 text-center text-slate-400 font-medium text-xs"
                    >
                      No se encontraron transacciones para los filtros seleccionados.
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
            <span>Ingresos (+): <strong className="text-emerald-600">$ {totalIngresos.toLocaleString('es-CO')}</strong></span>
            <span>Egresos (-): <strong className="text-rose-600">$ {totalEgresos.toLocaleString('es-CO')}</strong></span>
            <span>Balance Neto: <strong className={totalIngresos - totalEgresos >= 0 ? "text-sky-700" : "text-rose-700"}>$ {(totalIngresos - totalEgresos).toLocaleString('es-CO')}</strong></span>
          </div>
        </div>

      </div>
      )}

      {/* ─── MODAL DETALLE DE DOCUMENTO DE REFERENCIA (OJITO) ─── */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header del modal */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#009beb] to-[#0077b6] text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-100">Documento de Referencia</span>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>{selectedDoc.tipoDocumento}</span>
                  <span className="text-sky-200 text-sm font-mono font-normal">#{selectedDoc.numeroDocumento}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs">
              
              {/* Estado y Monto */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[11px] block font-medium">Estado del Movimiento</span>
                  <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${selectedDoc.estado === 'Anulado' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedDoc.estado}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block font-medium">Monto Total</span>
                  <span className="text-base font-mono font-black text-slate-800">
                    $ {Number(selectedDoc.valor || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Datos Generales */}
              <div className="grid grid-cols-2 gap-3 text-slate-600">
                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha de Emisión</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{formatDateTime(selectedDoc.fechaCreacion)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Seleccionada</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{formatDateOnly(selectedDoc.fechaSeleccionada)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tercero / Paciente</span>
                  <span className="font-bold text-slate-800 mt-0.5 block uppercase">{selectedDoc.tercero || "—"}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{selectedDoc.documentoTercero || "Sin documento"}</span>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profesional Asignado</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block uppercase">{selectedDoc.profesional || "—"}</span>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Forma de Pago</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{selectedDoc.formaPago || "Efectivo"}</span>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Doc. Referencia</span>
                  <span className="font-mono font-bold text-[#009beb] mt-0.5 block">{selectedDoc.docReferencia || selectedDoc.numeroDocumento}</span>
                </div>
              </div>

              {/* Observaciones */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Observaciones / Notas</span>
                <p className="text-slate-700 italic">
                  {selectedDoc.observaciones ? selectedDoc.observaciones : "Sin observaciones registradas para este documento."}
                </p>
              </div>

              {/* Información Contable */}
              <div className="flex items-center justify-between px-3 py-2 bg-sky-50/60 border border-sky-100 rounded-xl text-sky-800 text-[11px]">
                <span className="font-semibold">Cuenta Contable:</span>
                <span className="font-mono">{selectedDoc.cuentaContable || "110505 - Caja General"}</span>
              </div>

            </div>

            {/* Footer del modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={async () => {
                  if (!selectedDoc) return;
                  try {
                    const isEgreso = (selectedDoc.tipoDocumento || "").toLowerCase().includes("egreso") || (selectedDoc.tipoDocumento || "").toLowerCase().includes("compra");
                    const consecutiveNumber = selectedDoc.numeroDocumento || selectedDoc.docReferencia || (isEgreso ? "EGR-0001" : "RC-0001");
                    
                    const pObj = selectedDoc.pacienteObj || {};
                    const patientData = {
                      nombreCompleto: pObj.nombreCompleto || selectedDoc.tercero || "Paciente Clínica",
                      nroDocumento: pObj.nroDocumento || selectedDoc.documentoTercero || "—",
                      tipoDocumento: pObj.tipoDocumento || pObj.tipo_documento || "CC",
                      lugarResidencia: (pObj.direccion && pObj.direccion !== "—") ? pObj.direccion : (pObj.barrio || "—"),
                      ciudadDomicilio: (pObj.ciudad && pObj.ciudad !== "—") ? pObj.ciudad : (pObj.ciudadDomicilio || "Montería"),
                      celular: (pObj.celular && pObj.celular !== "—") ? pObj.celular : (pObj.telefono || "—"),
                    };

                    const conceptoStr = (selectedDoc.tipoDocumento === "Recibo de caja+" || selectedDoc.tipoDocumento === "Factura de venta+")
                      ? (selectedDoc.documentosAsociados && selectedDoc.documentosAsociados !== "—" ? `Abono a ${selectedDoc.documentosAsociados}` : "Abono a Tratamiento Odontológico")
                      : (selectedDoc.tipoDocumento || "Comprobante de Caja");

                    const nombreElaborador = (userProfile?.nombreCompleto && !userProfile.nombreCompleto.includes("@"))
                      ? userProfile.nombreCompleto
                      : (userProfile?.nombre && !userProfile.nombre.includes("@"))
                      ? userProfile.nombre
                      : (selectedDoc.usuarioCreador && !selectedDoc.usuarioCreador.includes("@") && selectedDoc.usuarioCreador !== "Administración")
                      ? selectedDoc.usuarioCreador
                      : "Guillermo Rodríguez";

                    const pagoData = {
                      id: selectedDoc.rawId || selectedDoc.id,
                      monto: Number(selectedDoc.valor || selectedDoc.total || 0),
                      tipo: isEgreso ? "egreso" : "ingreso",
                      documentTitle: isEgreso ? "Comprobante de Egreso" : "Recibo de Caja",
                      medio: selectedDoc.formaPago || "Efectivo",
                      concepto: conceptoStr,
                      notas: selectedDoc.observaciones || "Sin observaciones adicionales",
                      fecha: selectedDoc.fechaSeleccionada || selectedDoc.fechaCreacion || new Date().toISOString(),
                      nroConsecutivo: consecutiveNumber,
                      registradoPor: nombreElaborador,
                      planTitle: selectedDoc.documentosAsociados && selectedDoc.documentosAsociados !== "—" ? selectedDoc.documentosAsociados : "Tratamiento Odontológico",
                      planId: selectedDoc.planId || null
                    };

                    const clinicData = {
                      inquilino: userProfile?.inquilino || "",
                      logo: userProfile?.tenant?.logo || userProfile?.logo || "",
                      nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "ATM CENTRO DEL DOLOR OROFACIAL",
                      nit: userProfile?.tenant?.nit || "64576359-3",
                      direccion: userProfile?.tenant?.direccion || "Sede Principal",
                      telefono: userProfile?.tenant?.telefono || "",
                      email: userProfile?.tenant?.email || "",
                    };

                    await ReceiptPrintService.generatePDF(pagoData, patientData, clinicData, userProfile);
                  } catch (err) {
                    console.error("Error generando PDF de soporte:", err);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all cursor-pointer text-xs shadow-sm active:scale-95"
              >
                <FiPrinter size={13} />
                <span>Imprimir Soporte Oficial</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-5 py-2 bg-[#009beb] hover:bg-[#0087cd] text-white font-bold rounded-xl transition-all cursor-pointer text-xs"
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
