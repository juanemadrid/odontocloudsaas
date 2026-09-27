import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FiArrowLeft, FiSearch, FiUser, FiPlus, FiTrash2,
  FiSave, FiAlertCircle, FiCheckCircle, FiFileText,
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { emitirFacturaDian } from "../../../services/DianService";
import { computePaymentStatus } from "../../../services/billingReceiptLinkService";

import {
  buildBillingPeriodFromAttentions,
  buildBeneficiaryFromPatient,
  resolveHealthDataFromConfig,
  validateClinicalAttentionsForHealthInvoice,
  isClinicalStructuredItem,
  CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE,
  CLINICAL_INVOICE_CANNOT_BYPASS_ERROR_MESSAGE,
  FEV_CLINICAL_SOURCE_REQUIRED,
  FEV_CLINICAL_SOURCE_ERROR_MESSAGE,
  PARTICULAR_COVERAGE_CODE,
  PAYMENT_METHOD_EVENTO_CODE,
  FACTUS_HEALTH_PAYMENT_METHOD_CATALOG,
  FACTUS_HEALTH_COVERAGE_CATALOG,
  FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG,
  getHealthPaymentCatalogForProfile,
  resolveHealthCatalogProfile,
  preflightHealthInvoice,
} from "../../../services/factusHealthPayloadBuilder";
import {
  getFevRetryDecision,
  recordFevAttempt,
  acquireRetryLock,
  releaseRetryLock,
  acquireFevBackendLock,
  releaseFevBackendLock,
  getOrGenerateAuthoritativeReferenceCode,
  handle409Conflict,
  FEV_STAGE,
  RETRY_DECISION,
  FEV_LOCK_STATE,
  FEV_OPERATION,
  normalizeFactusError,
} from "../../../services/factusRetryService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const PAYMENT_FORMS = [
  { code: "1", label: "Contado" },
  { code: "2", label: "Crédito" },
];

const PAYMENT_METHODS = [
  { code: "10", label: "Efectivo" },
  { code: "47", label: "Tarjeta débito" },
  { code: "48", label: "Tarjeta crédito" },
  { code: "42", label: "Transferencia / Nequi" },
  { code: "20", label: "Cheque" },
  { code: "ZZZ", label: "Otro" },
];

const StepIndicator = ({ step }) => (
  <div className="flex items-center gap-2 mb-8">
    {[1, 2, 3].map((s) => (
      <React.Fragment key={s}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
          ${step === s ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : step > s ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"}`}>
          {step > s ? "✓" : s}
        </div>
        {s < 3 && <div className={`flex-1 h-0.5 rounded ${step > s ? "bg-green-400" : "bg-slate-100"}`} />}
      </React.Fragment>
    ))}
  </div>
);

const inputCls = "w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all";
const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";

export default function FacturaElectronicaForm({ onCancel, onSuccess, initialFactura = null }) {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || "";

  const isCorrectionMode = Boolean(initialFactura);
  const initialDetalles = useMemo(() => {
    let det = initialFactura?.detalles;
    if (typeof det === "string") {
      try { det = JSON.parse(det); } catch { det = {}; }
    }
    return det || {};
  }, [initialFactura]);

  const retryDecision = useMemo(() => {
    if (!initialFactura) return null;
    return getFevRetryDecision(initialFactura);
  }, [initialFactura]);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [noCredsWarning, setNoCredsWarning] = useState(false);

  // Configuración institucional persistida
  const [billingConfig, setBillingConfig] = useState(null);

  // Tipo de Facturación: Salud (SS-CUFE) vs Comercial Estándar
  const [tipoOperacion, setTipoOperacion] = useState(() => {
    if (initialDetalles?.tipoOperacion) return initialDetalles.tipoOperacion;
    if (initialDetalles?.esSectorSalud) return "SALUD";
    return "SALUD";
  });

  // Step 1: Patient
  const [paciente, setPaciente] = useState(() => {
    if (!initialFactura) return null;
    return {
      id: initialFactura.paciente_id || initialFactura.pacienteId || initialDetalles.paciente_id,
      nombre: initialFactura.pacienteNombre || initialDetalles.pacienteNombre || "",
      documento: initialFactura.pacienteDocumento || initialDetalles.pacienteDocumento || "",
      tipoDocumento: initialFactura.pacienteTipoDocumento || initialDetalles.pacienteTipoDocumento || "CC",
      email: initialFactura.pacienteEmail || initialDetalles.pacienteEmail || initialDetalles.customer?.email || "",
      telefono: initialFactura.pacienteTelefono || initialDetalles.pacienteTelefono || initialDetalles.customer?.phone || "",
      direccion: initialFactura.pacienteDireccion || initialDetalles.pacienteDireccion || initialDetalles.customer?.address || "",
      ciudad: initialFactura.pacienteCiudad || initialDetalles.pacienteCiudad || "",
    };
  });
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  // Atenciones clínicas realizadas del paciente
  const [atencionesDisponibles, setAtencionesDisponibles] = useState([]);
  const [loadingAtenciones, setLoadingAtenciones] = useState(false);

  // Step 2: Items
  const [items, setItems] = useState(() => {
    if (Array.isArray(initialFactura?.items) && initialFactura.items.length > 0) return initialFactura.items;
    if (Array.isArray(initialDetalles?.items) && initialDetalles.items.length > 0) return initialDetalles.items;
    return [];
  });

  // Recibos de caja existentes del paciente para asociación (P1-FEV1)
  const [recibosDisponibles, setRecibosDisponibles] = useState([]);
  const [loadingRecibos, setLoadingRecibos] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState(() => {
    return initialDetalles?.recibo_asociado || null;
  });

  // Configuración FEV Salud MinSalud / Factus V2 (Reconciliado)
  const [modalidadSalud, setModalidadSalud] = useState(() => {
    return initialDetalles?.healthData?.modalidadPago || PAYMENT_METHOD_EVENTO_CODE;
  });
  const [coberturaSalud, setCoberturaSalud] = useState(() => {
    return initialDetalles?.healthData?.coberturaCode || PARTICULAR_COVERAGE_CODE;
  });
  const [numeroContratoSalud, setNumeroContratoSalud] = useState(() => {
    return initialDetalles?.healthData?.contractNumber || "";
  });
  const [sinContratoSalud, setSinContratoSalud] = useState(() => {
    return initialDetalles?.healthData?.withoutContractCode || "05";
  });

  // Cargar configuración de facturación electrónica del tenant
  useEffect(() => {
    if (!inquilino) return;
    const loadBillingCfg = async () => {
      try {
        const { getConfigSection } = await import("../../../services/configPersistenceService");
        const cfg = await getConfigSection(inquilino, "facturacion_electronica", {});
        const generalCfg = cfg?.general || cfg?.por_sucursal?.general || cfg || {};
        setBillingConfig(generalCfg);
        if (!initialFactura) {
          if (generalCfg.health_payment_method_code) setModalidadSalud(generalCfg.health_payment_method_code);
          if (generalCfg.coverage_code) setCoberturaSalud(generalCfg.coverage_code);
          if (generalCfg.contract_number) setNumeroContratoSalud(generalCfg.contract_number);
          if (generalCfg.without_contract_code) setSinContratoSalud(generalCfg.without_contract_code);
        }
      } catch (err) {
        console.warn("No se pudo cargar la configuración de facturación:", err?.message);
      }
    };
    loadBillingCfg();
  }, [inquilino, initialFactura]);

  // Perfil activo de catálogo resuelto desde configuración autoritativa
  const activeCatalogProfile = useMemo(() => {
    try {
      return resolveHealthCatalogProfile({ tenantConfig: billingConfig });
    } catch {
      return "SHARED_SANDBOX_LEGACY_4";
    }
  }, [billingConfig]);

  // Catálogo de modalidades activo para el perfil resuelto
  const activePaymentCatalog = useMemo(() => {
    try {
      return getHealthPaymentCatalogForProfile(activeCatalogProfile);
    } catch {
      return { "04": "Pago por evento" };
    }
  }, [activeCatalogProfile]);

  const hasClinicalItems = useMemo(() => items.some(isClinicalStructuredItem), [items]);

  const handleSwitchToComercial = () => {
    if (hasClinicalItems) {
      const msg = CLINICAL_INVOICE_CANNOT_BYPASS_ERROR_MESSAGE;
      setError(`${CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE}: ${msg}`);
      toast.error(msg);
      return;
    }
    setTipoOperacion("COMERCIAL");
    if (items.length === 0) {
      setItems([{ descripcion: "", cantidad: 1, precioUnitario: 0, descuento: 0 }]);
    }
  };

  // Step 3: Payment
  const [condicionPago, setCondicionPago] = useState(() => initialDetalles?.condicionPago || initialFactura?.condicionPago || "1");
  const [medioPago, setMedioPago] = useState(() => initialDetalles?.medioPago || initialFactura?.medioPago || "10");
  const [referenciaPago, setReferenciaPago] = useState(() => initialDetalles?.referenciaPago || "");
  const [observaciones, setObservaciones] = useState(() => initialDetalles?.observaciones || initialFactura?.observaciones || "");

  // Cargar atenciones clínicas realizadas para el paciente seleccionado
  const loadAtencionesRealizadas = useCallback(async (pacienteId) => {
    if (!pacienteId || !inquilino) {
      setAtencionesDisponibles([]);
      return;
    }
    setLoadingAtenciones(true);
    try {
      const { data: planes } = await supabase
        .from("planes_tratamiento")
        .select("id, nombre, items")
        .eq("tenant_id", inquilino)
        .eq("paciente_id", pacienteId);

      const realized = [];
      (planes || []).forEach((plan) => {
        const planItems = Array.isArray(plan.items) ? plan.items : [];
        planItems.forEach((it) => {
          if ((it.realizado === true || it.fechaRealizado) && it.facturado !== true) {
            const cupsCode = it.codigo_cups || it.cups || it.code || "";
            const fechaAtencion = (it.fechaRealizado || it.fecha || new Date().toISOString()).slice(0, 10);
            realized.push({
              id: it.id,
              planItemId: it.id,
              clinicalSourceId: it.clinicalSourceId || it.id,
              clinicalSourceType: it.clinicalSourceType || "PLAN_ITEM",
              planId: plan.id,
              planNombre: plan.nombre,
              descripcion: it.desc || it.nombre || "Procedimiento Odontológico",
              cantidad: Number(it.qty || 1),
              precioUnitario: Number(it.amount || 0),
              descuento: Number(it.descuento || 0),
              fechaAtencion: fechaAtencion,
              fechaRealizado: fechaAtencion,
              cups: cupsCode,
              code: cupsCode,
              codigo_cups: cupsCode,
              realizado: true,
            });
          }
        });
      });
      setAtencionesDisponibles(realized);
    } catch (err) {
      console.warn("Error consultando atenciones realizadas:", err);
      setAtencionesDisponibles([]);
    } finally {
      setLoadingAtenciones(false);
    }
  }, [inquilino]);

  // ─── Patient search ───
  const searchPatients = useCallback(async (term) => {
    if (!term || term.length < 2 || !inquilino) { setPatients([]); return; }
    setLoadingPacientes(true);
    try {
      const { data: snap } = await supabase
        .from("pacientes")
        .select("*")
        .eq("tenant_id", inquilino);
      const all = snap || [];
      const q = term.toLowerCase();
      setPatients(
        all.filter(
          (p) =>
            (p.nombre || "").toLowerCase().includes(q) ||
            (p.apellido || "").toLowerCase().includes(q) ||
            (p.documento || "").includes(q) ||
            (p.cedula || "").includes(q)
        ).slice(0, 8)
      );
    } catch (_) {
      setPatients([]);
    } finally {
      setLoadingPacientes(false);
    }
  }, [inquilino]);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients]);

  // Cargar recibos previos del paciente para asociación persistente (P1-FEV1)
  const loadRecibosPaciente = useCallback(async (pacienteId) => {
    if (!pacienteId || !inquilino) {
      setRecibosDisponibles([]);
      setSelectedRecibo(null);
      return;
    }
    setLoadingRecibos(true);
    try {
      const { data: recs } = await supabase
        .from("recibos_caja")
        .select("*")
        .eq("tenant_id", inquilino)
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      const { data: pagos } = await supabase
        .from("pagos")
        .select("*")
        .eq("tenant_id", inquilino)
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      const combined = [];
      (recs || []).forEach((r) => {
        combined.push({
          ...r,
          isPago: false,
          numero: r.numero || `REC-${r.id.slice(0, 6)}`,
          monto: Number(r.monto || r.total || 0),
          fecha: r.fecha || r.created_at,
          metodo: r.metodo || r.metodo_pago || "Efectivo",
        });
      });
      (pagos || []).forEach((p) => {
        combined.push({
          ...p,
          isPago: true,
          numero: p.nro_consecutivo || p.consecutivo || `PAG-${p.id.slice(0, 6)}`,
          monto: Number(p.monto || 0),
          fecha: p.fecha || p.created_at,
          metodo: p.metodo || "Transferencia",
        });
      });
      setRecibosDisponibles(combined);
    } catch (e) {
      console.warn("Error cargando recibos del paciente:", e);
      setRecibosDisponibles([]);
    } finally {
      setLoadingRecibos(false);
    }
  }, [inquilino]);

  const selectPatient = (p) => {
    setPaciente(p);
    setPatientSearch(`${p.nombre || ""} ${p.apellido || ""}`.trim());
    setShowPatientDrop(false);
    if (tipoOperacion === "SALUD") {
      loadAtencionesRealizadas(p.id);
    }
    loadRecibosPaciente(p.id);
  };

  // ─── Item helpers ───
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { descripcion: "", cantidad: 1, precioUnitario: 0, descuento: 0 },
    ]);

  const addAtencionItem = (atencion) => {
    // Evitar agregar dos veces el mismo procedimiento clínico
    if (items.some((it) => it.id === atencion.id)) {
      toast.info("Esta atención clínica ya está agregada a la factura.");
      return;
    }
    setItems((prev) => [...prev, atencion]);
    toast.success("Procedimiento clínico agregado.");
  };

  const removeItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );

  const itemTotal = (it) => {
    const q = parseFloat(it.cantidad) || 0;
    const p = parseFloat(it.precioUnitario) || 0;
    const d = parseFloat(it.descuento) || 0;
    return q * p * (1 - d / 100);
  };

  const totals = useMemo(() => {
    const subtotalBruto = items.reduce(
      (s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0),
      0
    );
    const totalDescuento = items.reduce((s, it) => {
      const gross = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0);
      return s + gross * ((parseFloat(it.descuento) || 0) / 100);
    }, 0);
    const total = subtotalBruto - totalDescuento;
    return { subtotalBruto, totalDescuento, total };
  }, [items]);

  // ─── Validation ───
  const validateStep = (s) => {
    if (s === 1) {
      if (!paciente) { toast.error("Selecciona un paciente."); return false; }
      return true;
    }
    if (s === 2) {
      if (items.length === 0) {
        if (tipoOperacion === "SALUD") {
          setError(`${FEV_CLINICAL_SOURCE_REQUIRED}: ${FEV_CLINICAL_SOURCE_ERROR_MESSAGE}`);
          toast.error(FEV_CLINICAL_SOURCE_ERROR_MESSAGE);
        } else {
          toast.error("Agrega al menos un ítem.");
        }
        return false;
      }

      if (tipoOperacion === "SALUD") {
        try {
          validateClinicalAttentionsForHealthInvoice(items);
        } catch (errClinical) {
          setError(`${errClinical.code || FEV_CLINICAL_SOURCE_REQUIRED}: ${errClinical.message}`);
          toast.error(errClinical.message);
          return false;
        }
      }

      // Bloqueo de Bypass: una prestación clínica NO puede emitirse como COMERCIAL
      if (tipoOperacion === "COMERCIAL") {
        if (hasClinicalItems) {
          const msg = CLINICAL_INVOICE_CANNOT_BYPASS_ERROR_MESSAGE;
          setError(`${CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE}: ${msg}`);
          toast.error(msg);
          return false;
        }
      }

      for (const it of items) {
        if (!it.descripcion) { toast.error("Todos los ítems deben tener descripción."); return false; }
        if ((parseFloat(it.precioUnitario) || 0) <= 0) { toast.error("El precio unitario debe ser mayor a 0."); return false; }
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => s + 1);
  };

  // ─── Save ───
  const handleSave = async () => {
    if (!validateStep(step)) return;

    let backendLockToken = null;

    // Check if retrying an already accepted invoice and acquire atomic backend lock
    if (initialFactura?.id) {
      const decision = getFevRetryDecision(initialFactura);
      if (!decision.canRetry) {
        setError(decision.friendlyMessage);
        toast.error(decision.friendlyMessage);
        return;
      }
      try {
        const lockRes = await acquireFevBackendLock({
          tenantId: inquilino,
          facturaId: initialFactura.id,
          state: FEV_LOCK_STATE.RETRYING,
          lockedBy: userProfile?.email || "user",
          timeoutSeconds: 120,
        });
        backendLockToken = lockRes.lockToken;
      } catch (lockErr) {
        const msg = lockErr.code === "FEV_OPERATION_ALREADY_IN_PROGRESS"
          ? "Operación en curso: ya existe un reintento o verificación activa para esta factura (FEV_OPERATION_ALREADY_IN_PROGRESS)."
          : lockErr.message;
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    setSaving(true);
    setError("");
    setNoCredsWarning(false);
    try {
      // Bloqueo estricto del Bypass Comercial en save
      if (tipoOperacion === "COMERCIAL") {
        if (hasClinicalItems) {
          const msg = CLINICAL_INVOICE_CANNOT_BYPASS_ERROR_MESSAGE;
          setError(`${CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE}: ${msg}`);
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      // Load tenant credentials
      const { getFactusCredentialsForTenant } = await import("../../../services/factusAdminService");
      const tenantData = await getFactusCredentialsForTenant(inquilino) || {};
      const hasCredentials = Boolean(
        tenantData.factusClientId &&
        tenantData.factusClientSecret
      );

      if (!hasCredentials) setNoCredsWarning(true);

      const stableRefCode = getOrGenerateAuthoritativeReferenceCode(initialFactura);

      const invoiceData = {
        tenant_id: inquilino,
        inquilino,
        items: items.map((it, idx) => {
          const cups = it.cups || it.codigo_cups || it.code || (tipoOperacion === "SALUD" ? "SERV-0001" : `ITEM-${Date.now().toString(36)}`);
          const lineId = it.invoiceLineId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `line-${idx + 1}-${Date.now()}`);
          const sourceId = it.clinicalSourceId || it.planItemId || it.evolucionId || it.atencionId || (it.planId && it.id ? it.id : null);
          const sourceType = it.clinicalSourceType || (it.planItemId || it.planId ? "PLAN_ITEM" : it.evolucionId ? "EVOLUCION" : it.atencionId ? "DOCUMENTO_CLINICO" : null);
          const totalVal = itemTotal(it);
          const fechaAtencion = (it.fechaAtencion || it.fechaRealizado || it.fecha || new Date().toISOString()).slice(0, 10);
          return {
            ...it,
            invoiceLineId: lineId,
            clinicalSourceId: sourceId,
            clinicalSourceType: sourceType,
            code: cups,
            code_reference: cups,
            cups,
            fechaAtencion,
            valor: totalVal,
            total: totalVal,
          };
        }),
        subtotal: totals.subtotalBruto,
        descuento: totals.totalDescuento,
        total: totals.total,
        condicionPago,
        medioPago,
        referenciaPago: medioPago !== "10" ? referenciaPago : "",
        observaciones,
        factusReferenceCode: stableRefCode,
      };

      // Si es Sector Salud: conectar builder oficial SS-CUFE
      if (tipoOperacion === "SALUD") {
        // Cargar código de prestador REPS de la clínica
        const { getConfigSection } = await import("../../../services/configPersistenceService");
        const [companyCfg, tenantRow, sisproSecrets] = await Promise.all([
          getConfigSection(inquilino, "empresa_datos", {}),
          supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle(),
          supabase.from("tenant_secrets").select("sispro_config").eq("tenant_id", inquilino).maybeSingle(),
        ]);
        const dTenant = tenantRow?.data || {};
        const dSispro = sisproSecrets?.data?.sispro_config || {};
        const providerCode = String(
          billingConfig?.provider_code ||
          dTenant.codigoPrestador ||
          dSispro.codigoPrestador ||
          companyCfg?.codigoPrestador ||
          companyCfg?.reps ||
          ""
        ).trim();

        let billingPeriod = null;
        try {
          billingPeriod = buildBillingPeriodFromAttentions(items, new Date());
        } catch (errDate) {
          setError(`Error en fechas de atención: ${errDate.message}`);
          toast.error(errDate.message);
          setSaving(false);
          return;
        }

        const beneficiary = buildBeneficiaryFromPatient(paciente);

        // Resolver perfil de catálogo de salud autoritativo (NO inferido silenciosamente)
        let catalogProfile = null;
        try {
          catalogProfile = resolveHealthCatalogProfile({
            tenantConfig: billingConfig,
            factusConfig: tenantData,
          });
        } catch (errProf) {
          const code = errProf.code || "FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED";
          setError(`${code}: ${errProf.message}`);
          toast.error(errProf.message);
          setSaving(false);
          return;
        }

        // Resolver rango de numeración autoritativo
        const numberingRangeId = billingConfig?.numbering_range_id || tenantData?.factusNumberingRangeId;

        // Ejecutar Preflight formal estricto FEV Salud
        let preflightResult = null;
        try {
          preflightResult = preflightHealthInvoice({
            catalogProfile,
            numberingRangeId,
            providerCode,
            paymentMethodCode: modalidadSalud,
            coverageCode: coberturaSalud,
            contractNumber: numeroContratoSalud ? numeroContratoSalud.trim() : null,
            withoutContractCode: numeroContratoSalud ? null : (sinContratoSalud || "05"),
            items,
            beneficiary,
            billingPeriod,
          });
        } catch (errPreflight) {
          const code = errPreflight.code || "HEALTH_PREFLIGHT_ERROR";
          setError(`${code}: ${errPreflight.message}`);
          toast.error(errPreflight.message);
          setSaving(false);
          return;
        }

        const healthData = resolveHealthDataFromConfig({
          providerCode: preflightResult.providerCode,
          modalidadPago: preflightResult.paymentMethodCode,
          coberturaCode: preflightResult.coverageCode,
          contractNumber: preflightResult.contractNumber,
          withoutContractCode: preflightResult.withoutContractCode,
          catalogProfile,
        });

        invoiceData.esSectorSalud = true;
        invoiceData.tipoOperacion = "SS-CUFE";
        invoiceData.numbering_range_id = preflightResult.numberingRangeId;
        invoiceData.numberingRangeId = preflightResult.numberingRangeId;
        invoiceData.fevRipsFlagEnabled = true;
        invoiceData.healthData = healthData;
        invoiceData.billing_period = preflightResult.billingPeriod;
        invoiceData.beneficiary = preflightResult.beneficiary;
      }

      const result = await emitirFacturaDian(
        invoiceData,
        paciente,
        hasCredentials ? tenantData : null
      );

      const finalNumero = result.factusInvoiceNumber || initialFactura?.numero || invoiceData.nroFactura || `FE-${Date.now().toString().slice(-4)}`;

      // Cálculo formal de estado de pago según recibos vinculados
      const linkedReceiptsList = selectedRecibo ? [selectedRecibo] : [];
      const paymentCalc = computePaymentStatus(totals.total, linkedReceiptsList);

      let dbDetalles = {
        ...initialDetalles,
        items: invoiceData.items,
        subtotal: totals.subtotalBruto,
        descuento: totals.totalDescuento,
        medioPago,
        condicionPago,
        referenciaPago: invoiceData.referenciaPago,
        observaciones,
        factusReferenceCode: invoiceData.factusReferenceCode,
        factusResponse: result.factusResponse || null,
        dianStatus: result.dianStatus || "NO_CONFIGURADA",
        cufe: result.cufe || null,
        qrCode: result.qrCode || null,
        factusInvoiceNumber: result.factusInvoiceNumber || null,
        esSectorSalud: invoiceData.esSectorSalud || false,
        tipoOperacion: invoiceData.tipoOperacion || "COMERCIAL",
        healthData: invoiceData.healthData || null,
        billing_period: invoiceData.billing_period || null,
        beneficiary: invoiceData.beneficiary || null,
        pacienteNombre: `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim(),
        pacienteDocumento: paciente.documento || paciente.cedula || "",
        recibo_asociado: selectedRecibo ? {
          id: selectedRecibo.id,
          recibo_id: selectedRecibo.id,
          numero: selectedRecibo.numero || selectedRecibo.nro_consecutivo || `REC-${selectedRecibo.id.slice(0, 6)}`,
          monto: Number(selectedRecibo.monto || selectedRecibo.total || 0),
          fecha: selectedRecibo.fecha || selectedRecibo.created_at,
          metodo: selectedRecibo.metodo || selectedRecibo.metodo_pago || "Efectivo",
          tabla_origen: selectedRecibo.isPago ? "pagos" : "recibos_caja",
        } : null,
        recibos_asociados: selectedRecibo ? [{
          id: selectedRecibo.id,
          recibo_id: selectedRecibo.id,
          numero: selectedRecibo.numero || selectedRecibo.nro_consecutivo || `REC-${selectedRecibo.id.slice(0, 6)}`,
          monto: Number(selectedRecibo.monto || selectedRecibo.total || 0),
          fecha: selectedRecibo.fecha || selectedRecibo.created_at,
          metodo: selectedRecibo.metodo || selectedRecibo.metodo_pago || "Efectivo",
          tenant_id: inquilino,
          paciente_id: paciente.id,
          asociado_at: new Date().toISOString(),
          asociado_por: userProfile?.nombreCompleto || userProfile?.email || "Usuario",
          tabla_origen: selectedRecibo.isPago ? "pagos" : "recibos_caja",
        }] : (initialDetalles?.recibos_asociados || []),
        monto_pagado: paymentCalc.totalPagado,
        saldo_pendiente: paymentCalc.saldoPendiente,
        estado_pago: paymentCalc.estadoPago,
      };

      // Registrar intento con factusRetryService
      const currentOperation = initialFactura?.id ? FEV_OPERATION.RETRY : FEV_OPERATION.EMIT;

      if (result.success && result.cufe) {
        dbDetalles = recordFevAttempt(dbDetalles, {
          operation: currentOperation,
          status: FEV_STAGE.ACCEPTED,
          reference_code: stableRefCode,
          is_validated: true,
          factus_status: result.dianStatus === "SIMULADA" ? "SIMULADA" : "ACEPTADA",
          cufe: result.cufe,
          factus_invoice_number: result.factusInvoiceNumber,
          error_message: null,
          isTestMode: result.dianStatus === "SIMULADA",
        });
      } else if (!hasCredentials) {
        // Draft mode sin credenciales
      } else {
        dbDetalles = recordFevAttempt(dbDetalles, {
          operation: currentOperation,
          status: result.errorCategory || FEV_STAGE.FACTUS_VALIDATION_REJECTED,
          reference_code: stableRefCode,
          is_validated: false,
          factus_status: result.errorCode === "409_CONFLICT_PENDING_BILL" ? "PENDIENTE_409" : "RECHAZADA",
          error_category: result.errorCategory,
          error_code: result.errorCode,
          error_message: result.message,
          error_fields: result.errorFields,
        });
      }

      const dbFactura = {
        tenant_id: inquilino,
        paciente_id: paciente.id,
        numero: finalNumero,
        subtotal: totals.subtotalBruto,
        impuestos: totals.iva || 0,
        total: totals.total,
        estado: (result.success && result.cufe) ? "Emitido" : "Pendiente",
        fecha_emision: initialFactura?.fecha_emision || new Date().toISOString(),
        detalles: dbDetalles,
        ...(initialFactura?.id ? { updated_at: new Date().toISOString() } : { created_at: new Date().toISOString() }),
      };

      // Persistir en tabla facturas (UPDATE si es reintento, INSERT si es nueva)
      let savedFactura = null;
      try {
        if (initialFactura?.id) {
          const { data: invRow, error: invErr } = await supabase
            .from("facturas")
            .update(dbFactura)
            .eq("id", initialFactura.id)
            .select()
            .single();
          if (invErr) throw invErr;
          savedFactura = invRow;
        } else {
          const { data: invRow, error: invErr } = await supabase
            .from("facturas")
            .insert([dbFactura])
            .select()
            .single();
          if (invErr) throw invErr;
          savedFactura = invRow;
        }
      } catch (errDb) {
        console.warn("Error guardando en facturas:", errDb.message);
      }

      // Si hay recibo vinculado, actualizar referencia en el recibo (sin duplicar movimientos de caja)
      const targetFacturaId = savedFactura?.id || initialFactura?.id;
      if (selectedRecibo?.id && targetFacturaId) {
        try {
          const recTable = selectedRecibo.isPago ? "pagos" : "recibos_caja";
          await supabase.from(recTable).update({ factura_id: targetFacturaId }).eq("id", selectedRecibo.id);
        } catch (colErr) {
          console.warn("Actualización factura_id en recibo diferida:", colErr?.message);
        }
      }

      if (result.success && result.cufe) {
        setSuccessData(result);
        toast.success("¡Factura electrónica emitida con éxito!");
      } else if (!hasCredentials) {
        toast.info("Factura guardada como borrador (sin credenciales Factus).");
        setSuccessData({ ...result, draft: true });
      } else if (result.errorCode === "409_CONFLICT_PENDING_BILL" || String(result.message).includes("409")) {
        toast.info("Factus reportó factura pendiente (409). Conciliando y preparando recreación limpia...");
        try {
          const resolution = await handle409Conflict({
            factura: initialFactura || { id: targetFacturaId, detalles: dbDetalles },
            tenantId: inquilino,
            referenceCode: stableRefCode,
          });

          if (resolution.outcome === "FEV_ALREADY_VALIDATED") {
            setSuccessData({
              success: true,
              cufe: resolution.factura?.detalles?.cufe,
              factusInvoiceNumber: resolution.factura?.numero,
              message: "Documento ya validado previamente ante la DIAN.",
            });
            toast.success("Factura ya validada en Factus / DIAN. Datos reconciliados.");
            return;
          } else if (resolution.outcome === "DELETED_READY_FOR_RECREATE") {
            toast.warning("Factura previa pendiente fue eliminada de Factus. Puede volver a emitir de inmediato.");
          }
        } catch (resErr) {
          console.warn("Error en resolución 409:", resErr.message);
        }
        setError(result.message || "Factura pendiente encontrada en Factus.");
      } else {
        setError(result.message || "Error al emitir la factura.");
        toast.error(result.message || "Error al emitir la factura.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error inesperado al guardar la factura.");
      toast.error(err.message || "Error inesperado.");
    } finally {
      setSaving(false);
      if (initialFactura?.id && backendLockToken) {
        await releaseFevBackendLock({
          tenantId: inquilino,
          facturaId: initialFactura.id,
          lockToken: backendLockToken,
        });
      } else if (initialFactura?.id) {
        releaseRetryLock(initialFactura.id);
      }
    }
  };

  // ─── Success screen ───
  if (successData) {
    return (
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-10 animate-in fade-in duration-500 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <FiCheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-lg font-black text-slate-800 mb-1">
          {successData.draft ? "Factura guardada como borrador" : "¡Factura emitida con éxito!"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">{successData.message}</p>
        {successData.cufe && (
          <div className="bg-slate-50 rounded-2xl p-4 text-left mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CUFE</p>
            <p className="text-xs font-mono text-slate-700 break-all">{successData.cufe}</p>
          </div>
        )}
        {successData.factusInvoiceNumber && (
          <div className="bg-blue-50 rounded-2xl p-4 text-left mb-6">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Número de Factura</p>
            <p className="text-2xl font-black text-blue-700">{successData.factusInvoiceNumber}</p>
          </div>
        )}
        <button onClick={onSuccess} className="bg-blue-600 text-white px-8 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest">
          Volver a la lista
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onCancel} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
          <FiArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">
            {isCorrectionMode ? `Corregir y Reintentar Factura #${initialFactura.numero || initialFactura.id}` : "Nueva Factura Electrónica"}
          </h2>
          <p className="text-[10px] text-slate-400 font-bold">
            {step === 1 ? "Paso 1: Selección de paciente" : step === 2 ? "Paso 2: Ítems de la factura" : "Paso 3: Datos de pago"}
          </p>
        </div>
      </div>

      {isCorrectionMode && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <FiAlertCircle className="text-amber-600 shrink-0" size={18} />
            <span className="font-black text-xs uppercase tracking-wider">
              Modo Corrección y Reintento — Factura #{initialFactura.numero || initialFactura.id}
            </span>
          </div>
          {retryDecision?.lastErrorMessage && (
            <p className="text-xs text-amber-800 ml-6">
              <strong>Causa del rechazo anterior:</strong> {retryDecision.lastErrorMessage}
            </p>
          )}
          {retryDecision?.errorFields && Object.keys(retryDecision.errorFields).length > 0 && (
            <ul className="text-xs text-amber-700 ml-10 list-disc mt-1">
              {Object.entries(retryDecision.errorFields).map(([k, v]) => (
                <li key={k}>
                  <strong>{k}:</strong> {v}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-amber-600 ml-6 mt-1 italic">
            Edite los campos requeridos y guarde para reintentar la emisión. La factura actualizará este mismo documento sin generar duplicados fiscales.
          </p>
        </div>
      )}

      <StepIndicator step={step} />

      {/* No credentials warning */}
      {noCredsWarning && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
          <FiAlertCircle className="text-orange-500 mt-0.5 shrink-0" size={18} />
          <p className="text-xs font-bold text-orange-700">
            Configura las credenciales Factus en <strong>Configuración → Facturación Electrónica</strong> para emitir facturas con validez ante la DIAN. La factura se guardará como borrador.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <FiAlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
          <p className="text-xs font-bold text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 space-y-6">
        {/* ── Selector de Tipo de Factura ── */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Régimen / Tipo de Facturación</span>
            <span className="text-xs font-bold text-slate-700">
              {tipoOperacion === "SALUD" ? "Sector Salud (MinSalud FEV-RIPS SS-CUFE)" : "Comercial Estándar (Venta no-salud)"}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setTipoOperacion("SALUD");
                setItems([]);
                if (paciente?.id) loadAtencionesRealizadas(paciente.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                tipoOperacion === "SALUD"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🏥 Sector Salud (SS-CUFE)
            </button>
            <button
              type="button"
              disabled={hasClinicalItems}
              onClick={handleSwitchToComercial}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                hasClinicalItems
                  ? "opacity-40 cursor-not-allowed text-slate-400 bg-slate-100"
                  : tipoOperacion === "COMERCIAL"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title={hasClinicalItems ? "Bloqueado: prestaciones clínicas requieren régimen Salud obligatorio" : ""}
            >
              🛍️ Comercial Estándar
            </button>
          </div>
        </div>
        {hasClinicalItems && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
            <span className="text-xs">🔒</span>
            <p className="text-[11px] font-bold text-amber-800">
              Régimen <strong>SALUD (SS-CUFE)</strong> obligatorio: se han detectado prestaciones clínicas realizadas / CUPS en la factura. El régimen Comercial está bloqueado.
            </p>
          </div>
        )}

        {/* ── STEP 1: Patient ── */}
        {step === 1 && (
          <>
            <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Buscar Paciente</p>
            <div className="relative">
              <label className={labelCls}>Nombre o documento</label>
              <div className="relative mt-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); setPaciente(null); }}
                  onFocus={() => setShowPatientDrop(true)}
                  placeholder="Buscar por nombre o cédula..."
                  className={`${inputCls} pl-9`}
                />
              </div>
              {showPatientDrop && (patientSearch.length >= 2) && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                  {loadingPacientes ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">Buscando...</div>
                  ) : patients.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">Sin resultados</div>
                  ) : patients.map((p) => (
                    <button key={p.id} type="button" onClick={() => selectPatient(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-all text-left border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">
                        {(p.nombre || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{p.nombre} {p.apellido}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{p.tipoDocumento || "CC"}: {p.documento || p.cedula}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {paciente && (
              <div className="bg-blue-50 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-black text-sm">
                    {(paciente.nombre || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{paciente.nombre} {paciente.apellido}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{paciente.tipoDocumento || "CC"}: {paciente.documento || paciente.cedula}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {paciente.email && <div><span className="text-slate-400 font-black uppercase tracking-widest">Email</span><p className="font-bold text-slate-700">{paciente.email}</p></div>}
                  {(paciente.telefono || paciente.celular) && <div><span className="text-slate-400 font-black uppercase tracking-widest">Teléfono</span><p className="font-bold text-slate-700">{paciente.telefono || paciente.celular}</p></div>}
                  {paciente.direccion && <div><span className="text-slate-400 font-black uppercase tracking-widest">Dirección</span><p className="font-bold text-slate-700">{paciente.direccion}</p></div>}
                  {paciente.ciudad && <div><span className="text-slate-400 font-black uppercase tracking-widest">Ciudad</span><p className="font-bold text-slate-700">{paciente.ciudad}</p></div>}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Items ── */}
        {step === 2 && (
          <>
            {tipoOperacion === "SALUD" && (
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                      Atenciones Clínicas Realizadas Disponibles
                    </p>
                    <p className="text-[10px] text-indigo-600 font-bold">
                      Selecciona los procedimientos clínicos ejecutados que deseas incluir en esta FEV Salud.
                    </p>
                  </div>
                  {loadingAtenciones && (
                    <span className="text-[10px] text-indigo-500 font-black animate-pulse uppercase">Cargando atenciones...</span>
                  )}
                </div>

                {atencionesDisponibles.length === 0 ? (
                  <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
                    <p className="text-xs font-black text-slate-600 mb-1">
                      ⚠️ No se encontraron atenciones clínicas realizadas pendientes de facturación para este paciente.
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Debe registrarse y marcarse como realizada la atención clínica en su plan de tratamiento antes de emitir la FEV Salud.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {atencionesDisponibles.map((at) => (
                      <div
                        key={at.id}
                        className="bg-white border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs hover:border-indigo-300 transition-all"
                      >
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-800 truncate">{at.descripcion}</p>
                          <p className="text-[10px] text-indigo-600 font-bold">
                            CUPS: {at.cups || "Sin CUPS"} · Fecha: {at.fechaAtencion}
                          </p>
                          <p className="text-[11px] font-black text-slate-700">{fmt(at.precioUnitario)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addAtencionItem(at)}
                          className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
                        >
                          + Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-800 uppercase tracking-widest">
                Ítems de la Factura ({items.length})
              </p>
              {tipoOperacion === "COMERCIAL" && (
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-[14px] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                  <FiPlus size={13} /> Agregar Ítem
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 pr-2">Descripción</th>
                    <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-20">Cant.</th>
                    <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-28">Precio Unit.</th>
                    <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-20">Dto. %</th>
                    <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-28">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="py-2 pr-2">
                        {tipoOperacion === "SALUD" ? (
                          <div>
                            <span className="text-xs font-black text-slate-800 uppercase block">{it.descripcion}</span>
                            <span className="text-[9px] font-bold text-indigo-600 block">CUPS: {it.cups || it.code} · Fecha: {it.fechaAtencion || it.fechaRealizado}</span>
                          </div>
                        ) : (
                          <input value={it.descripcion} onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                            placeholder="Descripción del servicio" className={inputCls} />
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="1" value={it.cantidad} onChange={(e) => updateItem(idx, "cantidad", e.target.value)}
                          className={`${inputCls} text-center`} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" value={it.precioUnitario} onChange={(e) => updateItem(idx, "precioUnitario", e.target.value)}
                          className={`${inputCls} text-right`} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" max="100" value={it.descuento} onChange={(e) => updateItem(idx, "descuento", e.target.value)}
                          className={`${inputCls} text-center`} />
                      </td>
                      <td className="py-2 px-2 text-right text-sm font-black text-slate-700">{fmt(itemTotal(it))}</td>
                      <td className="py-2 pl-2">
                        <button type="button" onClick={() => removeItem(idx)}
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-all">
                          <FiTrash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-1 text-right">
              <p className="text-xs text-slate-500 font-bold">Subtotal: <span className="text-slate-700">{fmt(totals.subtotalBruto)}</span></p>
              {totals.totalDescuento > 0 && (
                <p className="text-xs text-red-500 font-bold">Descuento: <span>-{fmt(totals.totalDescuento)}</span></p>
              )}
              <p className="text-lg font-black text-slate-800">TOTAL: <span className="text-blue-600">{fmt(totals.total)}</span></p>
            </div>
          </>
        )}

        {/* ── STEP 3: Payment ── */}
        {step === 3 && (
          <>
            {/* ASOCIACIÓN DE RECIBO DE CAJA (P1-FEV1) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    Recibo de Caja Asociado
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Vincula un pago previo existente para evitar la duplicación de ingresos en caja.
                  </p>
                </div>
                {selectedRecibo && (
                  <button
                    type="button"
                    onClick={() => setSelectedRecibo(null)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold cursor-pointer bg-transparent border-0"
                  >
                    Quitar asociación
                  </button>
                )}
              </div>

              {loadingRecibos ? (
                <p className="text-xs text-slate-400">Cargando recibos del paciente...</p>
              ) : recibosDisponibles.length === 0 ? (
                <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center">
                  <p className="text-xs font-semibold text-slate-500">No hay recibos de caja previos para este paciente</p>
                  <p className="text-[10px] text-slate-400">La factura se creará con estado de pago PENDIENTE sin registrar ingreso duplicado.</p>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Seleccionar Recibo de Pago Existente</label>
                  <select
                    value={selectedRecibo?.id || ""}
                    onChange={(e) => {
                      const found = recibosDisponibles.find((r) => r.id === e.target.value);
                      setSelectedRecibo(found || null);
                    }}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">-- Sin recibo de caja asociado --</option>
                    {recibosDisponibles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.numero} | {new Date(r.fecha).toLocaleDateString("es-CO")} | {fmt(r.monto)} ({r.metodo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* CARD ESTADO DEL RECIBO ASOCIADO */}
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recibo asociado</span>
                  <span className="font-bold text-slate-800">
                    {selectedRecibo ? selectedRecibo.numero : "No hay recibo de caja asociado"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor pagado</span>
                  <span className="font-bold text-emerald-600">
                    {selectedRecibo ? fmt(selectedRecibo.monto) : "$0"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado de pago</span>
                  {(() => {
                    const payCalc = computePaymentStatus(totals.total, selectedRecibo ? [selectedRecibo] : []);
                    const colorMap = {
                      PAGADO: "bg-emerald-100 text-emerald-800",
                      PARCIAL: "bg-amber-100 text-amber-800",
                      PENDIENTE: "bg-slate-100 text-slate-700",
                    };
                    return (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${colorMap[payCalc.estadoPago]}`}>
                        {payCalc.estadoPago} {payCalc.estadoPago === "PARCIAL" ? `(Resta: ${fmt(payCalc.saldoPendiente)})` : ""}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado DIAN</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    PENDIENTE EMISIÓN
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs font-black text-slate-800 uppercase tracking-widest mt-4">Datos de Pago</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Condición de Pago *</label>
                <select value={condicionPago} onChange={(e) => setCondicionPago(e.target.value)} className={`${inputCls} mt-1`}>
                  {PAYMENT_FORMS.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Medio de Pago *</label>
                <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className={`${inputCls} mt-1`}>
                  {PAYMENT_METHODS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                </select>
              </div>
              {medioPago !== "10" && (
                <div className="sm:col-span-2">
                  <label className={labelCls}>Referencia de Pago</label>
                  <input value={referenciaPago} onChange={(e) => setReferenciaPago(e.target.value)}
                    placeholder="Número de transacción o referencia" className={`${inputCls} mt-1`} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelCls}>Observaciones (máx. 250 caracteres)</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value.slice(0, 250))}
                  rows={3} placeholder="Observaciones opcionales..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all mt-1 resize-none" />
                <p className="text-[10px] text-slate-400 font-bold text-right mt-1">{observaciones.length}/250</p>
              </div>
            </div>

            {/* Configuración FEV Salud */}
            {tipoOperacion === "SALUD" && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                  Parámetros Contractuales FEV Salud (Factus V2 / MinSalud)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Modalidad de Pago Salud *</label>
                    <select
                      value={modalidadSalud}
                      onChange={(e) => setModalidadSalud(e.target.value)}
                      className={`${inputCls} mt-1`}
                    >
                      {Object.entries(activePaymentCatalog).map(([code, desc]) => (
                        <option key={code} value={code}>
                          {code} — {desc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Cobertura en Salud *</label>
                    <select
                      value={coberturaSalud}
                      onChange={(e) => setCoberturaSalud(e.target.value)}
                      className={`${inputCls} mt-1`}
                    >
                      {Object.entries(FACTUS_HEALTH_COVERAGE_CATALOG).map(([code, desc]) => (
                        <option key={code} value={code}>
                          {code} — {desc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Número de Contrato (Opcional para particular, obligatorio para convenio)</label>
                    <input
                      value={numeroContratoSalud}
                      onChange={(e) => setNumeroContratoSalud(e.target.value)}
                      placeholder="Ej: CONV-2026-001 (dejar vacío si es particular sin contrato)"
                      className={`${inputCls} mt-1`}
                    />
                  </div>
                  {!numeroContratoSalud && (
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Motivo Sin Contrato (Factus V2) *</label>
                      <select
                        value={sinContratoSalud}
                        onChange={(e) => setSinContratoSalud(e.target.value)}
                        className={`${inputCls} mt-1`}
                      >
                        {Object.entries(FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG).map(([code, desc]) => (
                          <option key={code} value={code}>
                            {code} — {desc}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resumen</p>
              <p className="text-sm font-bold text-slate-700">Paciente: <span className="text-slate-900">{paciente?.nombre} {paciente?.apellido}</span></p>
              <p className="text-sm font-bold text-slate-700">{items.length} ítem(s) · {fmt(totals.total)}</p>
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button type="button" onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
          className="flex items-center gap-2 px-6 py-3 rounded-[18px] border border-slate-200 bg-white text-slate-600 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">
          <FiArrowLeft size={14} /> {step === 1 ? "Cancelar" : "Atrás"}
        </button>
        {step < 3 ? (
          <button type="button" onClick={goNext}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all">
            Siguiente →
          </button>
        ) : (
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#8cc33f] text-white px-8 py-3 rounded-full font-black text-[11px] uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shadow-md shadow-green-100">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Emitiendo...</>
            ) : (
              <><FiSave size={14} /> Emitir Factura Electrónica</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
