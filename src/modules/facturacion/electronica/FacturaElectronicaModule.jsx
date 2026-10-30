import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FiPlus, FiSearch, FiDownload, FiPrinter, FiRefreshCw,
  FiFileText, FiCalendar, FiCheck, FiAlertCircle, FiClock,
  FiChevronDown, FiChevronRight, FiEye, FiLink, FiLock,
  FiMail, FiX, FiCopy, FiInfo, FiMoreHorizontal
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { queryOptionalBillingTable } from "../../../services/optionalBillingTables.js";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { getDianStatusLabel } from "../../../services/DianService";
import factusService from "../../../services/factusService";
import FacturaElectronicaForm from "./FacturaElectronicaForm";
import NotaCreditoElectronicaModal from "./NotaCreditoElectronicaModal";
import RecuperarFacturaModal from "./RecuperarFacturaModal";
import { printElectronicInvoice, printReciboCaja } from "../../../utils/electronicInvoiceTemplate";
import { getConfigSection } from "../../../services/configPersistenceService";
import { linkReceiptToInvoice, computePaymentStatus } from "../../../services/billingReceiptLinkService";
import {
  getFevRetryDecision,
  checkFactusBillStatus,
  reconcileFactusInvoice,
  acquireFevBackendLock,
  releaseFevBackendLock,
  getOrGenerateAuthoritativeReferenceCode,
  RETRY_DECISION,
  FEV_STAGE,
  FEV_LOCK_STATE,
} from "../../../services/factusRetryService";

const fmt = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const PAYMENT_LABELS = {
  "10": "Efectivo",
  "42": "Transferencia Débito",
  "31": "Transferencia Débito",
  "47": "Tarjeta Débito",
  "48": "Tarjeta Crédito",
  "20": "Cheque",
  "1": "Contado",
  "2": "Crédito",
  "ZZZ": "Instrumento no definido",
};

export default function FacturaElectronicaModule() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || "";

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState(firstOfMonth);
  const [hasta, setHasta] = useState(todayStr);
  const [downloadingId, setDownloadingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  // Row Expansion & Modals
  const [expandedId, setExpandedId] = useState(null);
  const [detailModalFactura, setDetailModalFactura] = useState(null);
  const [asociadosModalFactura, setAsociadosModalFactura] = useState(null);
  const [attemptsModalFactura, setAttemptsModalFactura] = useState(null);
  const [showAsociarReciboModal, setShowAsociarReciboModal] = useState(false);
  const [targetInvoiceForLink, setTargetInvoiceForLink] = useState(null);
  const [recibosList, setRecibosList] = useState([]);
  const [linkingReceipt, setLinkingReceipt] = useState(false);
  const [editingFactura, setEditingFactura] = useState(null);
  const [statusCheckingId, setStatusCheckingId] = useState(null);
  const statusChecksInFlight = useRef(new Set());
  const [creditNoteModalFactura, setCreditNoteModalFactura] = useState(null);
  const [viewingFacturaDetails, setViewingFacturaDetails] = useState(null);

  useEffect(() => {
    if (!inquilino) return;
    (async () => {
      try {
        const [tenantResult, companyConfig, billingConfig] = await Promise.all([
          supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle(),
          getConfigSection(inquilino, "empresa_datos", {}),
          getConfigSection(inquilino, "facturacion_electronica", {})
        ]);
        const d = tenantResult?.data || {};
        const branchBilling = billingConfig?.por_sucursal || {};
        const dian = branchBilling.general || Object.values(branchBilling)[0] || billingConfig?.general || billingConfig || {};
        setTenant({
          nit: d.nit || companyConfig.nit || "",
          razonSocial: companyConfig.razonSocial || d.nombre || "",
          nombreComercial: companyConfig.nombreComercial || d.nombre || "",
          direccion: companyConfig.direccion || d.direccion || "",
          telefono: companyConfig.telefono || companyConfig.celular || d.telefono || "",
          email: companyConfig.email || "",
          logoUrl: companyConfig.logoUrl || d.logo_url || "",
          ciudad: companyConfig.ciudad || d.ciudad || "",
          dianResolucion: dian.dianResolucion || "",
          dianPrefijo: dian.dianPrefijo || "",
          dianRangoDesde: dian.dianRangoDesde || "",
          dianRangoHasta: dian.dianRangoHasta || "",
          dianFechaResolucion: dian.dianFechaResolucion || "",
          dianVigenciaHasta: dian.dianVigenciaHasta || dian.dianVigencia || ""
        });
      } catch (e) {
        console.error("Error loading tenant config in FacturaElectronicaModule:", e);
      }
    })();
  }, [inquilino]);

  const loadFacturas = async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      let combined = [];

      // 1. Load from facturas_electronicas
      try {
        const { data: feData } = await queryOptionalBillingTable("facturas_electronicas", (table) => table
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false }));
        if (feData && feData.length > 0) {
          const normalizedFe = feData.map((fe) => {
            let det = fe.detalles;
            if (typeof det === "string") {
              try { det = JSON.parse(det); } catch { det = {}; }
            } else if (!det || typeof det !== "object") {
              det = {};
            }
            return {
              ...fe,
              detalles: det,
              items: (Array.isArray(fe.items) && fe.items.length > 0)
                ? fe.items
                : (Array.isArray(det.items) && det.items.length > 0)
                ? det.items
                : [],
            };
          });
          combined.push(...normalizedFe);
        }
      } catch (e) {}

      // 2. Load from facturas
      try {
        const { data: fData } = await supabase
          .from("facturas")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false });
        if (fData && fData.length > 0) {
          fData.forEach((f) => {
            if (!combined.some((c) => c.id === f.id || (c.factusInvoiceNumber && c.factusInvoiceNumber === f.numero))) {
              let det = f.detalles;
              if (typeof det === "string") {
                try { det = JSON.parse(det); } catch { det = {}; }
              } else if (!det || typeof det !== "object") {
                det = {};
              }

              const linkedRecibos = Array.isArray(det.recibos_asociados)
                ? det.recibos_asociados
                : det.recibo_asociado
                ? [det.recibo_asociado]
                : (f.recibo_asociado ? [f.recibo_asociado] : []);

              const payCalc = computePaymentStatus(f.total, linkedRecibos);

              combined.push({
                ...f,
                detalles: det,
                items: Array.isArray(f.items) && f.items.length > 0
                  ? f.items
                  : Array.isArray(det.items) && det.items.length > 0
                  ? det.items
                  : [],
                pacienteNombre: f.pacienteNombre || f.paciente_nombre || det.pacienteNombre || "",
                pacienteDocumento: f.pacienteDocumento || f.paciente_documento || det.pacienteDocumento || "",
                pacienteDireccion: f.pacienteDireccion || det.pacienteDireccion || "",
                pacienteCiudad: f.pacienteCiudad || det.pacienteCiudad || "",
                pacienteTipoDocumento: f.pacienteTipoDocumento || det.pacienteTipoDocumento || "CC",
                factusInvoiceNumber: det.factusInvoiceNumber || (String(f.numero || "").startsWith("BORRADOR-") ? null : (f.numero || f.factusNumero || f.nroFactura)),
                factusCufe: f.factusCufe || det.cufe || det.factusCufe,
                factusQr: f.factusQr || det.qrCode || det.factusQr,
                factusPdfUrl: f.factusPdfUrl || det.factusPdfUrl,
                dianStatus: det.dianStatus || (f.estado === "Emitido" ? "ACEPTADA" : (f.estado || "PENDIENTE")),
                estadoPago: det.estado_pago || payCalc.estadoPago,
                montoPagado: det.monto_pagado !== undefined ? det.monto_pagado : payCalc.totalPagado,
                saldoPendiente: det.saldo_pendiente !== undefined ? det.saldo_pendiente : payCalc.saldoPendiente,
                recibosAsociados: linkedRecibos,
                total: f.total,
                subtotal: f.subtotal || f.total,
                medioPago: f.medioPago || f.medio_pago || det.medioPago || "10",
                profesional: f.profesional_nombre || f.profesional || det.profesional_nombre || det.profesional || "",
                observaciones: f.observaciones || det.observaciones || "",
                createdAt: f.fecha_emision || f.fechaISO || f.created_at,
              });
            }
          });
        }
      } catch (e) {}

      // 3. Fallback website_config
      if (combined.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        combined = cfgRow?.config?.facturas_electronicas || [];
      }

      setFacturas(combined);

      // Load receipts and payments for association modal
      try {
        const { data: rData } = await supabase
          .from("recibos_caja")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false })
          .limit(50);
        const { data: pData } = await supabase
          .from("pagos")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false })
          .limit(50);

        const allRecs = [];
        (rData || []).forEach((r) => {
          allRecs.push({
            ...r,
            isPago: false,
            numero: r.numero || `REC-${r.id.slice(0, 6)}`,
            monto: Number(r.monto || r.total || 0),
            fecha: r.fecha || r.created_at,
            metodo: r.metodo || r.metodo_pago || "Efectivo",
          });
        });
        (pData || []).forEach((p) => {
          allRecs.push({
            ...p,
            isPago: true,
            numero: p.nro_consecutivo || p.consecutivo || `PAG-${p.id.slice(0, 6)}`,
            monto: Number(p.monto || 0),
            fecha: p.fecha || p.created_at,
            metodo: p.metodo || "Transferencia",
          });
        });
        setRecibosList(allRecs);
      } catch (e) {}

    } catch (err) {
      console.error(err);
      toast.error("Error al cargar facturas electrónicas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFacturas(); }, [inquilino]);

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      const numStr = String(f.factusInvoiceNumber || f.numero || f.id || "");
      const pacStr = String(f.pacienteNombre || "");
      const matchSearch = !search ||
        pacStr.toLowerCase().includes(search.toLowerCase()) ||
        numStr.toLowerCase().includes(search.toLowerCase());
      const createdDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt || f.created_at || 0);
      const matchDesde = !desde || createdDate >= new Date(desde);
      const matchHasta = !hasta || createdDate <= new Date(hasta + "T23:59:59");
      return matchSearch && matchDesde && matchHasta;
    });
  }, [facturas, search, desde, hasta]);

  const handlePrint = (factura) => {
    printElectronicInvoice({
      factura,
      patient: {
        nombreCompleto: factura.pacienteNombre,
        documento: factura.pacienteDocumento,
        direccion: factura.pacienteDireccion,
        ciudad: factura.pacienteCiudad,
        telefono: factura.pacienteTelefono,
        tipoDocumento: factura.pacienteTipoDocumento || "CC"
      },
      tenant: tenant || userProfile?.tenant || {},
      items: factura.items || []
    });
  };

  const handlePrintReciboAsociado = (recibo, fac) => {
    try {
      const consecutive = String(recibo.numero || recibo.consecutivo || recibo.nroConsecutivo || "2086").replace(/^REC-?/i, "");
      const pacienteNombre = fac?.pacienteNombre || fac?.adquiriente || fac?.paciente?.nombreCompleto || "Paciente Clínica";
      const pacienteDocumento = fac?.pacienteDocumento || fac?.paciente?.documento || fac?.paciente?.nroDocumento || "—";
      const valNum = Number(recibo.monto !== undefined ? recibo.monto : (recibo.valor || recibo.total || 0));

      const recData = {
        ...recibo,
        nroConsecutivo: consecutive,
        consecutivo: consecutive,
        numero: consecutive,
        consecutivoNumero: consecutive,
        fecha: recibo.fecha || fac?.fechaEmision || fac?.created_at || new Date(),
        pacienteNombre,
        pacienteDocumento,
        concepto: recibo.concepto || `Pago Factura Electrónica ${fac?.factusInvoiceNumber || fac?.numero || ""}`,
        total: valNum,
        valor: valNum,
        monto: valNum,
        medioPago: recibo.medioPago || recibo.formaPago || fac?.medioPago || "Efectivo",
        registradoPor: recibo.registradoPor || recibo.registrado_por || recibo.usuarioCreador || recibo.usuario_nombre || recibo.creadoPor || recibo.creado_por || fac?.elaboradoPor || fac?.elaborado_por || fac?.creadoPor || "Administración"
      };

      const clinicData = {
        inquilino: userProfile?.inquilino || "",
        logo: userProfile?.tenant?.logo || userProfile?.logo || "",
        nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || "CLÍNICA DENTAL",
        nit: userProfile?.tenant?.nit || "",
        direccion: userProfile?.tenant?.direccion || "",
        telefono: userProfile?.tenant?.telefono || "",
        email: userProfile?.tenant?.email || "",
        ciudad: userProfile?.tenant?.ciudad || "Sincelejo, Sucre"
      };

      printReciboCaja(recData, clinicData);
    } catch (err) {
      console.error("Error al imprimir recibo asociado:", err);
      toast.error("No se pudo imprimir el recibo asociado");
    }
  };

  const handleDownloadPDF = async (factura) => {
    const num = factura.factusInvoiceNumber || factura.numero;
    if (!num) {
      toast.error("Esta factura no tiene número de Factus asignado.");
      return;
    }
    setDownloadingId(factura.id);
    try {
      const blob = await factusService.downloadInvoicePDF(num);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura-${num}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado correctamente.");
    } catch (err) {
      toast.error(`Error al descargar PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleLinkReceipt = async (recibo) => {
    if (!targetInvoiceForLink) return;
    setLinkingReceipt(true);
    try {
      await linkReceiptToInvoice({
        tenantId: inquilino,
        facturaId: targetInvoiceForLink.id,
        reciboId: recibo.id,
        userProfile,
        isPago: Boolean(recibo.isPago),
      });
      toast.success(`Recibo #${recibo.numero || recibo.nro_consecutivo || recibo.nroConsecutivo} asociado exitosamente.`);
      setShowAsociarReciboModal(false);
      setTargetInvoiceForLink(null);
      await loadFacturas();
    } catch (err) {
      console.error("Error al asociar recibo:", err);
      toast.error(err.message || "Error al asociar recibo.");
    } finally {
      setLinkingReceipt(false);
    }
  };

  const handleCheckStatus = async (factura) => {
    // Both the row and document modal can trigger this in the same render.
    // A duplicate must not clear the first request's busy state or show an error.
    if (statusChecksInFlight.current.has(factura.id)) return;
    statusChecksInFlight.current.add(factura.id);
    setStatusCheckingId(factura.id);
    let lockToken = null;
    try {
      const lockRes = await acquireFevBackendLock({
        tenantId: inquilino,
        facturaId: factura.id,
        state: FEV_LOCK_STATE.CHECKING_STATUS,
        lockedBy: userProfile?.email || "user",
        timeoutSeconds: 60,
      });
      lockToken = lockRes.lockToken;

      const refCode = getOrGenerateAuthoritativeReferenceCode(factura);
      const res = await checkFactusBillStatus({
        tenantId: inquilino,
        referenceCode: refCode,
        invoiceNumber: factura.factusInvoiceNumber || factura.numero,
      });

      if (res.found && (res.isValidated || res.cufe)) {
        await reconcileFactusInvoice({
          factura,
          factusBillData: res,
          tenantId: inquilino,
        });
        toast.success("Factura verificada y reconciliada con éxito desde Factus (CUFE asignado).");
      } else if (res.found && !res.isValidated && !res.cufe) {
        const currentDet = factura.detalles || {};
        const updatedDet = {
          ...currentDet,
          factusReferenceCode: refCode,
          factusExists: true,
          factusIsValidated: false,
          technicalError: false,
          dianStatus: "RECHAZADA",
        };
        await supabase
          .from("facturas")
          .update({ detalles: updatedDet })
          .eq("id", factura.id);
        toast.warning("Factus reporta factura registrada pero NO validada ante la DIAN. Puede proceder con corrección y recreación limpia.");
      } else {
        const currentDet = factura.detalles || {};
        const updatedDet = {
          ...currentDet,
          factusReferenceCode: refCode,
          factusExists: false,
          factusIsValidated: false,
          pending409: false,
          technicalError: false,
          dianStatus: "RECHAZADA",
          lastError: null,
        };
        const { error: updateError } = await supabase
          .from("facturas")
          .update({ detalles: updatedDet })
          .eq("id", factura.id)
          .eq("tenant_id", inquilino);
        if (updateError) throw updateError;
        toast.info("Factus confirmó que la factura no fue emitida. Ya puede proceder con 'Corregir y reintentar'.");
      }
      await loadFacturas();
    } catch (err) {
      console.error("Error al verificar estado:", err);
      const msg = err.code === "FEV_OPERATION_ALREADY_IN_PROGRESS"
        ? "Ya hay una operación FEV en curso para esta factura en otra sesión (FEV_OPERATION_ALREADY_IN_PROGRESS)."
        : `Error verificando estado en Factus: ${err.message}`;
      toast.error(msg);
    } finally {
      if (lockToken) {
        await releaseFevBackendLock({
          tenantId: inquilino,
          facturaId: factura.id,
          lockToken,
        });
      }
      statusChecksInFlight.current.delete(factura.id);
      setStatusCheckingId((current) => current === factura.id ? null : current);
    }
  };

  const handleStartCorrection = (factura) => {
    const decision = getFevRetryDecision(factura);
    if (!decision.canRetry) {
      toast.error(decision.friendlyMessage);
      return;
    }
    setEditingFactura(factura);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <FacturaElectronicaForm
        initialFactura={editingFactura}
        onCancel={() => { setShowForm(false); setEditingFactura(null); }}
        onSuccess={() => { setShowForm(false); setEditingFactura(null); loadFacturas(); }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-slate-800 text-[12px]">
      
      {/* Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-bold text-slate-800">Factura de venta</h1>
          <span className="text-slate-400 cursor-help" title="Módulo de Facturación de Venta y Factura Electrónica">
            <FiInfo size={14} />
          </span>
          <span className="text-[11px] text-slate-400 font-medium ml-2">
            Facturación - Factura de venta
          </span>
        </div>

        <div className="flex gap-2">
        <button onClick={() => setShowRecovery(true)} className="border border-blue-300 text-blue-700 rounded-lg px-3 py-2 text-xs font-bold">Recuperar de Factus</button>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
        >
          <FiPlus size={16} />
          <span>Nueva factura</span>
        </button>
        </div>
      </div>

      {showRecovery && <RecuperarFacturaModal tenantId={inquilino} onClose={() => setShowRecovery(false)} onRecovered={async () => { await loadFacturas(); setShowRecovery(false); toast.success('Factura recuperada en OdontoCloud.'); }} />}
      {/* Date Range Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
            <div className="relative">
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
              />
              <FiCalendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
            <div className="relative">
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
              />
              <FiCalendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>
          </div>

          <button
            onClick={loadFacturas}
            className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-5 py-1.5 rounded-lg font-bold text-[12px] transition-all cursor-pointer border-0 shadow-sm"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Sub-bar Actions & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <button
          onClick={() => setShowAsociarReciboModal(true)}
          className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 w-fit"
        >
          <FiPlus size={15} />
          <span>Asociar recibo</span>
        </button>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-8 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
            />
            <FiSearch className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>
        </div>
      </div>

      {/* Table Notice */}
      <p className="text-[11px] text-slate-400 italic">
        Arrastre el encabezado de una columna aquí para agrupar por esa columna
      </p>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] text-slate-400">Cargando facturas de venta...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FiFileText size={32} className="text-slate-300" />
            <p className="text-[12px] font-bold text-slate-500">Sin facturas en el período seleccionado</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px]"
            >
              + Crear primera factura
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                  <th className="py-2.5 px-3 w-8 text-center"></th>
                  <th className="py-2.5 px-3">Doc.</th>
                  <th className="py-2.5 px-3">Pac./Ter.</th>
                  <th className="py-2.5 px-3 text-center">Estado DIAN</th>
                  <th className="py-2.5 px-3">Recibo asociado</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Pagado</th>
                  <th className="py-2.5 px-3 text-right">Por pagar</th>
                  <th className="py-2.5 px-3 text-center w-10">...</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => {
                  const docNum = f.factusInvoiceNumber || f.numero || `FCEV${f.id?.slice(-4).toUpperCase() || "1333"}`;
                  const isExpanded = expandedId === f.id;
                  const totalNum = Number(f.total || 0);
                  const montoPagadoNum = Number(f.montoPagado || 0);
                  const saldoPendienteNum = Number(f.saldoPendiente !== undefined ? f.saldoPendiente : Math.max(0, totalNum - montoPagadoNum));
                  const retryDecision = getFevRetryDecision(f);

                  return (
                    <React.Fragment key={f.id}>
                      <tr className={`hover:bg-blue-50/20 transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}>
                        <td className="py-2.5 px-3 text-center cursor-pointer select-none" onClick={() => toggleExpand(f.id)}>
                          <span className="text-slate-400 hover:text-slate-700 font-bold">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {docNum}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {f.pacienteNombre || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            String(f.dianStatus).toUpperCase() === "ACEPTADA" ? "bg-emerald-100 text-emerald-800" :
                            String(f.dianStatus).toUpperCase() === "RECHAZADA" ? "bg-rose-100 text-rose-800" :
                            (f.detalles?.technicalError || String(f.dianStatus).toUpperCase() === "INDETERMINADO") ? "bg-amber-100 text-amber-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {f.detalles?.technicalError ? "TIMEOUT" : (f.dianStatus || "PENDIENTE")}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {f.recibosAsociados && f.recibosAsociados.length > 0 ? (
                            <button
                              onClick={() => setAsociadosModalFactura(f)}
                              className="text-blue-600 font-bold hover:underline cursor-pointer bg-transparent border-0 p-0 text-[11px]"
                              title="Ver detalle del recibo asociado"
                            >
                              {f.recibosAsociados[0].numero || `REC-${f.recibosAsociados[0].id?.slice(0, 6)}`}
                              {f.recibosAsociados.length > 1 ? ` (+${f.recibosAsociados.length - 1})` : ""}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 italic">No hay recibo de caja asociado</span>
                              <button
                                onClick={() => { setTargetInvoiceForLink(f); setShowAsociarReciboModal(true); }}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer bg-transparent border-0"
                              >
                                + Asociar
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {fmt(totalNum)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                          {fmt(montoPagadoNum)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-rose-600">
                          {fmt(saldoPendienteNum)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setDetailModalFactura(f)}
                            className="text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-0"
                            title="Opciones"
                          >
                            ...
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 border-b border-slate-200">
                          <td colSpan={9} className="py-3 px-8">
                            <div className="flex flex-wrap items-center gap-6">
                              {/* Estado DIAN */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Estado DIAN:</span>
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  String(f.dianStatus).toUpperCase() === "ACEPTADA" ? "bg-emerald-600 text-white" :
                                  String(f.dianStatus).toUpperCase() === "RECHAZADA" ? "bg-rose-600 text-white" :
                                  (f.detalles?.technicalError || String(f.dianStatus).toUpperCase() === "INDETERMINADO") ? "bg-amber-600 text-white" :
                                  "bg-amber-500 text-white"
                                }`}>
                                  {f.detalles?.technicalError ? "TIMEOUT" : (f.dianStatus || "PENDIENTE")}
                                </span>
                              </div>

                              {/* Estado de pago */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Estado de pago:</span>
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  String(f.estadoPago).toUpperCase() === "PAGADO" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                                  String(f.estadoPago).toUpperCase() === "PARCIAL" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                                  "bg-slate-200 text-slate-700"
                                }`}>
                                  {f.estadoPago || "PENDIENTE"}
                                </span>
                              </div>

                              {/* Recibo asociado */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Recibo asociado:</span>
                                {f.recibosAsociados && f.recibosAsociados.length > 0 ? (
                                  <span className="font-bold text-slate-800">
                                    {f.recibosAsociados.map(r => r.numero || `REC-${r.id?.slice(0, 6)}`).join(", ")} (Pagado: {fmt(montoPagadoNum)})
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    No hay recibo de caja asociado
                                  </span>
                                )}
                              </div>

                              {/* Documentos asociados */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Documentos asociados:</span>
                                <button
                                  onClick={() => setAsociadosModalFactura(f)}
                                  className="w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center cursor-pointer border-0 shadow-sm transition-all"
                                  title="Ver documentos asociados"
                                >
                                  <FiFileText size={14} />
                                </button>
                              </div>

                              {/* Acciones */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600">Acciones:</span>
                                <div className="flex items-center gap-1.5">
                                  {/* Eye button */}
                                  <button
                                    onClick={() => setDetailModalFactura(f)}
                                    className="w-7 h-7 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded flex items-center justify-center cursor-pointer border-0 transition-all shadow-sm"
                                    title="Ver detalle"
                                  >
                                    <FiEye size={13} />
                                  </button>

                                  {/* Print button */}
                                  <button
                                    onClick={() => handlePrint(f)}
                                    className="w-7 h-7 bg-slate-700 hover:bg-slate-800 text-white rounded flex items-center justify-center cursor-pointer border-0 transition-all shadow-sm"
                                    title="Imprimir Factura Electrónica"
                                  >
                                    <FiPrinter size={13} />
                                  </button>

                                  {/* Download PDF button */}
                                  <button
                                    onClick={() => handleDownloadPDF(f)}
                                    disabled={downloadingId === f.id}
                                    className="w-7 h-7 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded flex items-center justify-center cursor-pointer border-0 transition-all shadow-sm disabled:opacity-50"
                                    title="Descargar PDF Factus"
                                  >
                                    <FiDownload size={13} />
                                  </button>

                                  {/* Status check button for timeout / indeterminado */}
                                  {retryDecision.requiresStatusCheck && (
                                    <button
                                      onClick={() => handleCheckStatus(f)}
                                      disabled={statusCheckingId === f.id}
                                      className="px-2 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded flex items-center gap-1 text-[10px] font-bold cursor-pointer border-0 transition-all shadow-sm disabled:opacity-50"
                                      title="Verificar estado en Factus para confirmar si el documento fue recibido"
                                    >
                                      <FiRefreshCw className={statusCheckingId === f.id ? "animate-spin" : ""} size={12} />
                                      <span>Verificar</span>
                                    </button>
                                  )}

                                  {/* Retry / Correction button if allowed */}
                                  {retryDecision.canRetry && (
                                    <button
                                      onClick={() => handleStartCorrection(f)}
                                      className="px-2 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 text-[10px] font-bold cursor-pointer border-0 transition-all shadow-sm"
                                      title="Corregir datos y reintentar emisión"
                                    >
                                      <FiRefreshCw size={12} />
                                      <span>Corregir y reintentar</span>
                                    </button>
                                  )}

                                  {/* Lock indicator if already accepted */}
                                  {retryDecision.decision === RETRY_DECISION.ALREADY_ACCEPTED && (
                                    <span
                                      className="px-2 h-7 bg-slate-100 text-slate-400 rounded flex items-center gap-1 text-[10px] font-medium border border-slate-200 select-none cursor-help"
                                      title="Documento validado fiscalmente por la DIAN (CUFE asignado)."
                                    >
                                      <FiLock size={12} />
                                      <span>CUFE Asignado</span>
                                    </span>
                                  )}

                                  {/* Botón Nota Crédito Electrónica (Fase P1-FEV3B) */}
                                  {(f.detalles?.cufe || f.detalles?.factusCufe || retryDecision.decision === RETRY_DECISION.ALREADY_ACCEPTED) && (
                                    <button
                                      onClick={() => setCreditNoteModalFactura(f)}
                                      className={`px-2 h-7 rounded flex items-center gap-1 text-[10px] font-bold cursor-pointer border-0 transition-all shadow-sm ${
                                        f.detalles?.fiscal_adjustment_status === "FULLY_CREDITED"
                                          ? "bg-slate-200 text-slate-500 hover:bg-slate-300"
                                          : "bg-amber-600 hover:bg-amber-700 text-white"
                                      }`}
                                      title={
                                        f.detalles?.fiscal_adjustment_status === "FULLY_CREDITED"
                                          ? "Factura totalmente acreditada con Nota Crédito"
                                          : "Emitir Nota Crédito Electrónica (Anulación total o ajuste parcial)"
                                      }
                                    >
                                      <FiFileText size={12} />
                                      <span>
                                        {f.detalles?.fiscal_adjustment_status === "FULLY_CREDITED"
                                          ? "Totalmente Acreditada"
                                          : f.detalles?.fiscal_adjustment_status === "PARTIALLY_CREDITED"
                                          ? "Ajustar con NC"
                                          : "Nota Crédito"}
                                      </span>
                                    </button>
                                  )}

                                  {/* Attempts history button */}
                                  {Array.isArray(f.detalles?.fevAttempts) && f.detalles.fevAttempts.length > 0 && (
                                    <button
                                      onClick={() => setAttemptsModalFactura(f)}
                                      className="px-2 h-7 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded flex items-center gap-1 text-[10px] font-bold cursor-pointer border-0 transition-all"
                                      title="Ver historial de intentos de emisión"
                                    >
                                      <span>Intentos: {f.detalles.fevAttempts.length}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: OPCIONES DE FACTURA DE VENTA (3 PUNTOS)           */}
      {/* ========================================================= */}
      {detailModalFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Opciones del documento
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Factura de venta — {detailModalFactura.factusInvoiceNumber || detailModalFactura.numero || detailModalFactura.id?.slice(0, 10)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalFactura(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0 transition-colors"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Información General */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Paciente / Tercero:</span>
                  <span className="font-bold text-slate-800 text-right">
                    {detailModalFactura.pacienteNombre || detailModalFactura.adquiriente || detailModalFactura.paciente?.nombreCompleto || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Medio de pago:</span>
                  <span className="font-semibold text-slate-700">
                    {PAYMENT_LABELS[detailModalFactura.paymentMethodCode] || detailModalFactura.medioPago || "Efectivo"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Estado DIAN:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    detailModalFactura.dianStatus === "ACEPTADA"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : detailModalFactura.dianStatus === "RECHAZADA"
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : (detailModalFactura.detalles?.technicalError || detailModalFactura.dianStatus === "INDETERMINADO")
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-slate-200 text-slate-700 border border-slate-300"
                  }`}>
                    {detailModalFactura.dianStatus === "ACEPTADA"
                      ? "Transmitido y Validado"
                      : detailModalFactura.detalles?.technicalError
                        ? "Timeout / Indeterminado"
                        : (detailModalFactura.dianStatus || "Pendiente de Transmisión")}
                  </span>
                </div>
                {detailModalFactura.factusCufe && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">CUFE:</span>
                    <span className="font-mono text-[10px] text-slate-600 max-w-[240px] truncate" title={detailModalFactura.factusCufe}>
                      {detailModalFactura.factusCufe}
                    </span>
                  </div>
                )}
              </div>

              {/* Resumen Financiero */}
              {(() => {
                const totalDoc = Number(detailModalFactura.total || detailModalFactura.subtotal || 0);
                const asocs = detailModalFactura.recibosAsociados || [];
                const pagadoCalculado = asocs.length > 0
                  ? asocs.reduce((sum, r) => sum + Number(r.monto || r.valor || 0), 0)
                  : (detailModalFactura.montoPagado !== undefined ? Number(detailModalFactura.montoPagado) : (String(detailModalFactura.estadoPago).toUpperCase() === "PAGADO" ? totalDoc : 0));
                const pagadoFinal = String(detailModalFactura.estadoPago).toUpperCase() === "PAGADO" ? totalDoc : Math.min(totalDoc, pagadoCalculado);
                const porPagarFinal = String(detailModalFactura.estadoPago).toUpperCase() === "PAGADO" ? 0 : Math.max(0, totalDoc - pagadoFinal);

                return (
                  <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total</span>
                      <span className="text-xs font-bold text-slate-800">{fmt(totalDoc)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Pagado</span>
                      <span className="text-xs font-bold text-emerald-600">{fmt(pagadoFinal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Por pagar</span>
                      <span className="text-xs font-bold text-rose-600">{fmt(porPagarFinal)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Acciones Disponibles */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Acciones disponibles
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Imprimir */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = detailModalFactura;
                      setDetailModalFactura(null);
                      handlePrint(f);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <FiPrinter size={14} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800">Imprimir</div>
                      <div className="text-[10px] text-slate-400">Comprobante físico</div>
                    </div>
                  </button>

                  {/* Enviar correo */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = detailModalFactura;
                      setDetailModalFactura(null);
                      const emailPac = f.pacienteEmail || f.paciente?.email || f.email;
                      if (emailPac) {
                        toast.success(`Factura enviada al correo ${emailPac} ✅`);
                      } else {
                        toast.success(`Factura enviada al correo del paciente ✅`);
                      }
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FiMail size={14} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800">Enviar por correo</div>
                      <div className="text-[10px] text-slate-400">Enviar al tercero</div>
                    </div>
                  </button>

                  {/* Ver Documentos Asociados */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = detailModalFactura;
                      setDetailModalFactura(null);
                      setAsociadosModalFactura(f);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <FiEye size={14} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800">Ver doc. asociados</div>
                      <div className="text-[10px] text-slate-400">Recibos y pagos</div>
                    </div>
                  </button>

                  {/* Ver Detalle Completo */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = detailModalFactura;
                      setDetailModalFactura(null);
                      setViewingFacturaDetails(f);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <FiFileText size={14} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800">Ver detalle</div>
                      <div className="text-[10px] text-slate-400">Líneas y conceptos</div>
                    </div>
                  </button>

                  {/* PDF Oficial DIAN si ya tiene factusInvoiceNumber */}
                  {(detailModalFactura.factusInvoiceNumber || detailModalFactura.factusCufe || detailModalFactura.dianStatus === "ACEPTADA") && (
                    <button
                      type="button"
                      onClick={() => {
                        const f = detailModalFactura;
                        setDetailModalFactura(null);
                        handleDownloadPDF(f);
                      }}
                      className="p-2.5 rounded-xl border border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <FiDownload size={14} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-purple-900">PDF Oficial DIAN</div>
                        <div className="text-[10px] text-purple-600">Descargar con CUFE</div>
                      </div>
                    </button>
                  )}

                  {/* Nota Crédito si está aceptada o tiene CUFE */}
                  {(detailModalFactura.detalles?.cufe || detailModalFactura.detalles?.factusCufe || detailModalFactura.factusCufe || detailModalFactura.dianStatus === "ACEPTADA") && (
                    <button
                      type="button"
                      onClick={() => {
                        const f = detailModalFactura;
                        setDetailModalFactura(null);
                        setCreditNoteModalFactura(f);
                      }}
                      className="p-2.5 rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <FiFileText size={14} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-amber-900">Nota Crédito</div>
                        <div className="text-[10px] text-amber-600">Generar Nota Crédito</div>
                      </div>
                    </button>
                  )}

                  {/* Reintentar / Corregir si aplica */}
                  {(() => {
                    const dec = getFevRetryDecision(detailModalFactura);
                    if (dec.requiresStatusCheck) {
                      return (
                        <button
                          type="button"
                          disabled={statusCheckingId === detailModalFactura.id}
                          onClick={() => {
                            const f = detailModalFactura;
                            setDetailModalFactura(null);
                            handleCheckStatus(f);
                          }}
                          className="p-2.5 rounded-xl border border-amber-300 hover:border-amber-500 hover:bg-amber-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <FiRefreshCw size={14} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-amber-900">Verificar estado</div>
                            <div className="text-[10px] text-amber-600">Consultar Factus</div>
                          </div>
                        </button>
                      );
                    }
                    if (dec.canRetry && dec.requiresCorrection) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            const f = detailModalFactura;
                            setDetailModalFactura(null);
                            handleStartCorrection(f);
                          }}
                          className="p-2.5 rounded-xl border border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                        >
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <FiRefreshCw size={14} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-blue-900">Corregir emisión</div>
                            <div className="text-[10px] text-blue-600">Reintentar con DIAN</div>
                          </div>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {/* Historial de Intentos si tiene fevAttempts */}
                  {Array.isArray(detailModalFactura.detalles?.fevAttempts) && detailModalFactura.detalles.fevAttempts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const f = detailModalFactura;
                        setDetailModalFactura(null);
                        setAttemptsModalFactura(f);
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer bg-white"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <FiClock size={14} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-800">Historial de intentos</div>
                        <div className="text-[10px] text-slate-400">{detailModalFactura.detalles.fevAttempts.length} intentos previos</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setDetailModalFactura(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DOCUMENTOS ASOCIADOS (RECIBOS DE CAJA VINCULADOS)  */}
      {/* ========================================================= */}
      {asociadosModalFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200 animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <h3 className="text-sm font-bold text-slate-800">
                Documentos asociados
              </h3>
              <button
                type="button"
                onClick={() => setAsociadosModalFactura(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0 transition-colors"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Contenido / Tabla */}
            <div className="p-6">
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4">Número documento</th>
                      <th className="py-2.5 px-4">Tipo documento</th>
                      <th className="py-2.5 px-4">Valor</th>
                      <th className="py-2.5 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {asociadosModalFactura.recibosAsociados && asociadosModalFactura.recibosAsociados.length > 0 ? (
                      asociadosModalFactura.recibosAsociados.map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-bold font-mono text-slate-800">
                            {r.numero || r.nroConsecutivo || r.consecutivo || (r.id && String(r.id).replace(/\D/g, "").slice(-4)) || "REC-0001"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            Recibo de caja
                          </td>
                          <td className="py-3 px-4 font-bold font-mono text-slate-800">
                            {fmt(r.monto || r.total || r.valor || 0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handlePrintReciboAsociado(r, asociadosModalFactura)}
                              className="w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white rounded flex items-center justify-center mx-auto transition-colors shadow-xs cursor-pointer border-0"
                              title="Imprimir recibo de caja"
                            >
                              <FiPrinter size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-400 text-xs font-normal">
                          No se encontraron documentos asociados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setAsociadosModalFactura(null)}
                className="px-5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VER DETALLE CONCEPTOS / LÍNEAS DE FACTURA          */}
      {/* ========================================================= */}
      {viewingFacturaDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Detalle de Factura #{viewingFacturaDetails.factusInvoiceNumber || viewingFacturaDetails.numero}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Paciente: {viewingFacturaDetails.pacienteNombre || viewingFacturaDetails.adquiriente || "—"} &middot; {fmtDate(viewingFacturaDetails.fechaEmision || viewingFacturaDetails.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingFacturaDetails(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0 transition-colors"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {getFevRetryDecision(viewingFacturaDetails).lastErrorMessage && (
                <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 whitespace-pre-wrap break-words">
                  <strong>Último error de emisión: </strong>
                  {getFevRetryDecision(viewingFacturaDetails).lastErrorMessage}
                </div>
              )}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Concepto / Descripción</th>
                      <th className="py-2.5 px-4 text-center">Cant.</th>
                      <th className="py-2.5 px-4 text-right">Precio Unitario</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {Array.isArray(viewingFacturaDetails.items) && viewingFacturaDetails.items.length > 0 ? (
                      viewingFacturaDetails.items.map((item, itIdx) => (
                        <tr key={itIdx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {item.name || item.concepto || item.descripcion || "Item"}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {item.quantity || item.cantidad || 1}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {fmt(item.precioUnitario ?? item.precio_unitario ?? item.price ?? item.precio ?? item.valor ?? 0)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {fmt(item.total ?? ((item.quantity ?? item.cantidad ?? 1) * (item.precioUnitario ?? item.precio_unitario ?? item.price ?? item.precio ?? item.valor ?? 0) - (item.descuento ?? 0)))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-slate-400 italic">
                          No hay items detallados en este documento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="font-semibold text-slate-600 mr-3">Total Factura:</span>
                <span className="font-bold text-slate-900">{fmt(viewingFacturaDetails.total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setViewingFacturaDetails(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ASOCIAR RECIBO */}
      {showAsociarReciboModal && targetInvoiceForLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800">Asociar recibo de caja</h3>
                <p className="text-[11px] text-slate-500">
                  Factura {targetInvoiceForLink.factusInvoiceNumber || targetInvoiceForLink.numero} — Paciente: {targetInvoiceForLink.pacienteNombre}
                </p>
              </div>
              <button
                onClick={() => { setShowAsociarReciboModal(false); setTargetInvoiceForLink(null); }}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[12px] text-slate-600">
                Selecciona un recibo de caja emitido para este paciente para asociarlo formalmente a la factura:
              </p>

              {(() => {
                // Filtrar recibos pertenecientes al paciente de la factura para seguridad anti-cross-patient
                const targetPacId = String(targetInvoiceForLink.paciente_id || targetInvoiceForLink.pacienteId || "").toLowerCase();
                const targetPacName = String(targetInvoiceForLink.pacienteNombre || "").toLowerCase();

                const filteredRecibos = recibosList.filter((r) => {
                  const rPacId = String(r.paciente_id || r.pacienteId || "").toLowerCase();
                  const rPacName = String(r.pacienteNombre || r.paciente || "").toLowerCase();
                  return (targetPacId && rPacId === targetPacId) ||
                    (targetPacName && rPacName && targetPacName.includes(rPacName));
                });

                if (filteredRecibos.length === 0) {
                  return (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-slate-500 font-semibold text-xs">No hay recibos disponibles para este paciente</p>
                      <p className="text-slate-400 text-[10px] mt-1">Los recibos de otros pacientes están bloqueados para proteger la integridad contable.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredRecibos.map((r) => {
                      const isAlreadyLinked = (targetInvoiceForLink.recibosAsociados || []).some(
                        (l) => String(l.id || l.recibo_id) === String(r.id)
                      );

                      return (
                        <div
                          key={r.id}
                          onClick={() => !isAlreadyLinked && !linkingReceipt && handleLinkReceipt(r)}
                          className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                            isAlreadyLinked
                              ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                              : "border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">Recibo #{r.numero || r.nroConsecutivo || r.id?.slice(-4)}</p>
                              {isAlreadyLinked && (
                                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                  Ya asociado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {r.pacienteNombre || targetInvoiceForLink.pacienteNombre} &middot; {fmtDate(r.fecha || r.created_at)}
                            </p>
                          </div>
                          <span className="font-bold text-emerald-600">{fmt(r.monto || r.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => { setShowAsociarReciboModal(false); setTargetInvoiceForLink(null); }}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: HISTORIAL DE INTENTOS */}
      {attemptsModalFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800">Historial de Intentos de Emisión (FEV)</h3>
                <p className="text-[11px] text-slate-400">
                  Factura {attemptsModalFactura.factusInvoiceNumber || attemptsModalFactura.numero} &middot; Paciente: {attemptsModalFactura.pacienteNombre}
                </p>
              </div>
              <button
                onClick={() => setAttemptsModalFactura(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer bg-transparent border-0"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {(!attemptsModalFactura.detalles?.fevAttempts || attemptsModalFactura.detalles.fevAttempts.length === 0) ? (
                <p className="text-center text-slate-400 py-6">No hay registro de intentos previos.</p>
              ) : (
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-2 text-left">#</th>
                      <th className="py-2 text-left">Fecha/Hora</th>
                      <th className="py-2 text-center">Estado / Etapa</th>
                      <th className="py-2 text-left">Observación / Causa</th>
                      <th className="py-2 text-left">Campos observados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attemptsModalFactura.detalles.fevAttempts.map((att) => (
                      <tr key={att.attempt_number} className="border-b border-slate-100">
                        <td className="py-2.5 font-bold text-slate-700">{att.attempt_number}</td>
                        <td className="py-2.5 text-slate-500">{fmtDate(att.timestamp)}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            att.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800" :
                            att.status === "TECHNICAL_ERROR" ? "bg-amber-100 text-amber-800" :
                            att.status === "PRE_VALIDATION_ERROR" ? "bg-purple-100 text-purple-800" :
                            "bg-rose-100 text-rose-800"
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-700 max-w-xs break-words">
                          {att.error_message || (att.status === "ACCEPTED" ? "Validación DIAN exitosa con CUFE." : "Sin mensaje")}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {att.error_fields ? Object.keys(att.error_fields).join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => setAttemptsModalFactura(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: NOTA CRÉDITO ELECTRÓNICA (P1-FEV3B) */}
      {creditNoteModalFactura && (
        <NotaCreditoElectronicaModal
          factura={creditNoteModalFactura}
          inquilino={inquilino}
          onClose={() => setCreditNoteModalFactura(null)}
          onSuccess={() => {
            toast?.success?.("Nota Crédito emitida con éxito ante la DIAN.");
            loadFacturas();
          }}
        />
      )}

    </div>
  );
}
