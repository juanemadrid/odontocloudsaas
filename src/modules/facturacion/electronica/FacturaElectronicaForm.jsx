// src/modules/facturacion/electronica/FacturaElectronicaForm.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FiArrowLeft, FiSearch, FiPlus, FiTrash2, FiSave,
  FiAlertCircle, FiCheckCircle, FiX, FiInfo
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { emitirFacturaDian } from "../../../services/DianService";
import { computePaymentStatus } from "../../../services/billingReceiptLinkService";
import { getDoctorsList } from "../../../services/supabaseServices";
import { getConfigItems, getConfigSection } from "../../../services/configPersistenceService";
import { validateTerceroForDian, formatTerceroNombre } from "../../../utils/dian/dianHelpers";

import {
  buildBillingPeriodFromAttentions,
  buildBeneficiaryFromPatient,
  resolveHealthDataFromConfig,
  isClinicalStructuredItem,
  PARTICULAR_COVERAGE_CODE,
  PAYMENT_METHOD_EVENTO_CODE,
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
  FEV_LOCK_STATE,
  FEV_OPERATION,
} from "../../../services/factusRetryService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const RETENCIONES_CATALOGO = [
  { id: "retefuente_25", nombre: "ReteFuente 2.5% (Compras Generales)", porcentaje: 0.025 },
  { id: "retefuente_35", nombre: "ReteFuente 3.5% (Compras no declarantes)", porcentaje: 0.035 },
  { id: "retefuente_4", nombre: "ReteFuente 4% (Servicios)", porcentaje: 0.04 },
  { id: "retefuente_11", nombre: "ReteFuente 11% (Honorarios)", porcentaje: 0.11 },
  { id: "reteiva_15", nombre: "ReteIVA 15%", porcentaje: 0.15 },
  { id: "reteica_0966", nombre: "ReteICA 9.66 por mil", porcentaje: 0.00966 },
  { id: "reteica_1104", nombre: "ReteICA 11.04 por mil", porcentaje: 0.01104 },
];

const CIUDADES_COLOMBIA = [
  "Sincelejo", "Bogotá D.C.", "Medellín", "Cali", "Barranquilla",
  "Cartagena", "Bucaramanga", "Montería", "Santa Marta", "Valledupar",
  "Pereira", "Manizales", "Armenia", "Cúcuta", "Ibagué", "Villavicencio",
  "Neiva", "Pasto", "Popayán", "Tunja", "Riohacha", "Florencia", "Yopal"
];

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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [noCredsWarning, setNoCredsWarning] = useState(false);

  // Configuración institucional persistida
  const [billingConfig, setBillingConfig] = useState(null);

  // CARD 1: Datos generales
  const [fecha, setFecha] = useState(() => {
    if (initialFactura?.fecha_emision) return String(initialFactura.fecha_emision).slice(0, 10);
    if (initialFactura?.fecha) return String(initialFactura.fecha).slice(0, 10);
    return new Date().toISOString().split("T")[0];
  });
  const [profesionalId, setProfesionalId] = useState(() => {
    return initialFactura?.profesional || initialDetalles?.profesional || "";
  });
  const [profesionales, setProfesionales] = useState([]);

  // CARD 2: Datos tercero
  const [terceros, setTerceros] = useState([]);
  const [terceroId, setTerceroId] = useState("");
  const [selectedTerceroObj, setSelectedTerceroObj] = useState(null);
  const [terceroSearchQuery, setTerceroSearchQuery] = useState("");
  const [isSearchingTercero, setIsSearchingTercero] = useState(false);
  const searchContainerRef = useRef(null);

  const [condicionPago, setCondicionPago] = useState(() => initialDetalles?.condicionPago || initialFactura?.condicionPago || "Contado");
  const [condicionesPagoList, setCondicionesPagoList] = useState([]);

  const [medioPago, setMedioPago] = useState(() => initialDetalles?.medioPago || initialFactura?.medioPago || "Efectivo");
  const [mediosPagoList, setMediosPagoList] = useState([]);

  const [facturaBorrador, setFacturaBorrador] = useState(false);

  // Modal para Crear Tercero al Instante (Exacto OralDrive)
  const [showNewTerceroModal, setShowNewTerceroModal] = useState(false);
  const [savingTercero, setSavingTercero] = useState(false);
  const [newTerceroData, setNewTerceroData] = useState({
    nombre: "",
    apellidos: "",
    tipoDocumento: "CC",
    nroDocumento: "",
    razonSocial: "",
    telefono: "",
    direccion: "",
    pais: "Colombia",
    ciudad: "Sincelejo",
    email: "",
  });

  // CARD 3: Conceptos
  const [items, setItems] = useState(() => {
    const raw = initialFactura?.items || initialDetalles?.items;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((it) => ({
        id: it.id || Date.now() + Math.random(),
        concepto: it.concepto || it.cups || it.code || "",
        descripcion: it.descripcion || it.nombre || "",
        precioUnitario: Number(it.precioUnitario || it.valor || it.price || 0),
        cantidad: Number(it.cantidad || it.qty || 1),
        descuento: Number(it.descuento || it.discount || 0),
        total: Number(it.total || 0) || Math.max(0, (Number(it.precioUnitario || 0) * Number(it.cantidad || 1)) - Number(it.descuento || 0)),
        cups: it.cups || it.code || "",
        code: it.cups || it.code || "",
        clinicalSourceId: it.clinicalSourceId || it.planItemId || it.id || null,
        clinicalSourceType: it.clinicalSourceType || (it.planItemId ? "PLAN_ITEM" : null),
        planId: it.planId || null,
        fechaAtencion: it.fechaAtencion || it.fechaRealizado || null,
        realizado: Boolean(it.realizado),
      }));
    }
    return [
      {
        id: Date.now(),
        concepto: "",
        descripcion: "",
        precioUnitario: 0,
        cantidad: 1,
        descuento: 0,
        total: 0,
      },
    ];
  });

  // CARD 4: Retenciones (Anticipos se omitió según indicación del usuario)
  const [retencionesSeleccionadas, setRetencionesSeleccionadas] = useState(() => {
    return Array.isArray(initialDetalles?.retenciones) ? initialDetalles.retenciones : [];
  });
  const [selectedRetencionId, setSelectedRetencionId] = useState("");
  const [baseRetencion, setBaseRetencion] = useState("");

  // CARD 5: Observaciones
  const [observaciones, setObservaciones] = useState(() => initialDetalles?.observaciones || initialFactura?.observaciones || "");

  // Recibos disponibles para asociación
  const [selectedRecibo, setSelectedRecibo] = useState(() => initialDetalles?.recibo_asociado || null);

  // Parámetros de Salud FEV MinSalud
  const [modalidadSalud, setModalidadSalud] = useState(() => initialDetalles?.healthData?.modalidadPago || PAYMENT_METHOD_EVENTO_CODE);
  const [coberturaSalud, setCoberturaSalud] = useState(() => initialDetalles?.healthData?.coberturaCode || PARTICULAR_COVERAGE_CODE);
  const [numeroContratoSalud, setNumeroContratoSalud] = useState(() => initialDetalles?.healthData?.contractNumber || "");
  const [sinContratoSalud, setSinContratoSalud] = useState(() => initialDetalles?.healthData?.withoutContractCode || "05");

  // Cerrar búsqueda flotante al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchingTercero(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar configuración de facturación electrónica institucional
  useEffect(() => {
    if (!inquilino) return;
    const loadBillingCfg = async () => {
      try {
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

  // Cargar datos iniciales
  useEffect(() => {
    if (!inquilino) return;
    const loadInitialData = async () => {
      try {
        // 1. Cargar Doctores / Profesionales
        try {
          const dList = await getDoctorsList(userProfile || { inquilino });
          if (dList && dList.length > 0) {
            setProfesionales(dList.map((d) => ({
              id: d.id,
              nombre: d.nombreCompleto || d.nombre,
              role: d.role,
            })));
          }
        } catch (e) {
          console.warn("Error cargando profesionales:", e);
        }

        // 2. Cargar Terceros y Pacientes unificados
        let tercerosList = [];
        try {
          const { data: tDb } = await supabase
            .from("terceros")
            .select("*")
            .eq("tenant_id", inquilino);
          if (tDb && tDb.length > 0) {
            tercerosList = tDb.map((t) => ({
              ...t,
              id: t.id,
              nombre: formatTerceroNombre(t),
              apellidos: t.apellidos || t.apellido || "",
              razonSocial: t.razon_social || t.razonSocial || "",
              documento: t.numero_documento || t.documento || t.nit || t.nroDocumento || "",
              tipoDocumento: t.tipo_documento || t.tipoDocumento || "NIT",
              telefono: t.telefono || "",
              email: t.email || "",
              direccion: t.direccion || "",
              pais: t.pais || "Colombia",
              ciudad: t.ciudad || "Sincelejo",
              tipo: "tercero",
            }));
          }
        } catch (e) {}

        if (tercerosList.length === 0) {
          try {
            const { data: cfgRow } = await supabase
              .from("website_config")
              .select("config")
              .eq("tenant_id", inquilino)
              .maybeSingle();
            const cfg = cfgRow?.config || {};
            const rawT = cfg.terceros || cfg.proveedores || [];
            tercerosList = rawT.map((t) => ({
              ...t,
              id: t.id || t.documento || t.nombre,
              nombre: formatTerceroNombre(t),
              apellidos: t.apellidos || t.apellido || "",
              razonSocial: t.razon_social || t.razonSocial || "",
              documento: t.documento || t.nit || t.nroDocumento || "",
              tipoDocumento: t.tipoDocumento || "NIT",
              telefono: t.telefono || "",
              email: t.email || "",
              direccion: t.direccion || "",
              pais: t.pais || "Colombia",
              ciudad: t.ciudad || "Sincelejo",
              tipo: "tercero",
            }));
          } catch (e) {}
        }

        // Cargar Pacientes
        let pacientesList = [];
        try {
          const { data: pDb } = await supabase.from("pacientes").select("*");
          const tenantMatches = (pDb || []).filter((p) =>
            !p.tenant_id ||
            p.tenant_id === inquilino ||
            p.tenant_id === userProfile?.tenant_id
          );
          pacientesList = (tenantMatches.length > 0 ? tenantMatches : (pDb || [])).map((p) => {
            const full = `${p.nombres || p.nombre || ""} ${p.apellidos || p.apellido || ""}`.trim() || p.nombreCompleto || "Paciente";
            return {
              id: p.id,
              nombre: full,
              nombres: p.nombres || p.nombre || "",
              apellidos: p.apellidos || p.apellido || "",
              razonSocial: "",
              documento: p.documento || p.nroDocumento || p.identificacion || p.cedula || "",
              tipoDocumento: p.tipoDocumento || p.tipo_documento || "CC",
              telefono: p.telefono || p.celular || p.movil || "",
              email: p.email || p.correo || "",
              direccion: p.direccion || "",
              pais: "Colombia",
              ciudad: p.ciudad || "Sincelejo",
              tipo: "paciente",
            };
          });
        } catch (e) {
          console.warn("Error cargando pacientes:", e);
        }

        const combinedTerceros = [...pacientesList, ...tercerosList];
        setTerceros(combinedTerceros);

        // Si viene initialFactura, preseleccionar
        if (initialFactura) {
          const targetId = initialFactura.paciente_id || initialFactura.pacienteId || initialDetalles.paciente_id || initialFactura.tercero_id;
          const targetDoc = initialFactura.pacienteDocumento || initialDetalles.pacienteDocumento;
          const found = combinedTerceros.find((t) => t.id === targetId || (targetDoc && t.documento === targetDoc));
          if (found) {
            setSelectedTerceroObj(found);
            setTerceroId(found.id);
            setTerceroSearchQuery(found.nombre);
          }
        }

        // 3. Cargar Condiciones de pago
        let condList = [];
        try {
          const cpData = await getConfigItems(inquilino, "condiciones_pago", "condiciones_pago");
          if (cpData && cpData.length > 0) condList = cpData;
        } catch (e) {}

        if (condList.length === 0) {
          condList = [
            { id: "contado", nombre: "Contado" },
            { id: "credito_30", nombre: "Crédito 30 días", dias: 30 },
            { id: "credito_60", nombre: "Crédito 60 días", dias: 60 },
          ];
        }
        setCondicionesPagoList(condList);

        // 4. Cargar Medios de pago
        let mpList = [];
        try {
          const mpData = await getConfigItems(inquilino, "metodos_pago", null);
          if (mpData && mpData.length > 0) mpList = mpData;
        } catch (e) {}

        if (mpList.length === 0) {
          try {
            const { data: mpDb } = await supabase.from("metodos_pago").select("*").eq("tenant_id", inquilino);
            if (mpDb && mpDb.length > 0) mpList = mpDb;
          } catch (e) {}
        }

        if (mpList.length === 0) {
          mpList = [
            { id: "efectivo", nombre: "Efectivo" },
            { id: "tarjeta_debito", nombre: "Tarjeta Débito" },
            { id: "tarjeta_credito", nombre: "Tarjeta Crédito" },
            { id: "transferencia", nombre: "Transferencia Bancaria" },
            { id: "nequi", nombre: "Nequi / Daviplata" },
            { id: "cheque", nombre: "Cheque" },
          ];
        }
        setMediosPagoList(mpList);
      } catch (err) {
        console.error("Error cargando catálogos iniciales:", err);
      }
    };
    loadInitialData();
  }, [inquilino, initialFactura, userProfile]);

  // Filtrado reactivo de Terceros y Pacientes
  const filteredTerceros = useMemo(() => {
    const q = (terceroSearchQuery || "").toLowerCase().trim();
    if (!q) return terceros.slice(0, 30);
    return terceros.filter((t) => {
      const name = String(t.nombre || "").toLowerCase();
      const doc = String(t.documento || "").toLowerCase();
      const tel = String(t.telefono || "").toLowerCase();
      return name.includes(q) || doc.includes(q) || tel.includes(q);
    }).slice(0, 30);
  }, [terceros, terceroSearchQuery]);

  const selectTercero = (t) => {
    setSelectedTerceroObj(t);
    setTerceroId(t.id || t.nombre);
    setTerceroSearchQuery(t.nombre);
    setIsSearchingTercero(false);
  };

  // Manejo de Conceptos / Ítems
  const handleAddConcepto = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        concepto: "",
        descripcion: "",
        precioUnitario: 0,
        cantidad: 1,
        descuento: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveConcepto = (id) => {
    if (items.length === 1) {
      setItems([
        {
          id: Date.now(),
          concepto: "",
          descripcion: "",
          precioUnitario: 0,
          cantidad: 1,
          descuento: 0,
          total: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const pu = field === "precioUnitario" ? parseFloat(value) || 0 : parseFloat(item.precioUnitario) || 0;
        const cant = field === "cantidad" ? parseFloat(value) || 0 : parseFloat(item.cantidad) || 0;
        const desc = field === "descuento" ? parseFloat(value) || 0 : parseFloat(item.descuento) || 0;
        const subtotal = pu * cant;
        updated.total = Math.max(0, subtotal - desc);
        return updated;
      })
    );
  };

  // Manejo de Retenciones
  const handleAddRetencion = () => {
    if (!selectedRetencionId) {
      toast.error("Seleccione una retención");
      return;
    }
    const retObj = RETENCIONES_CATALOGO.find((r) => r.id === selectedRetencionId);
    const baseNum = parseFloat(baseRetencion) || totalConceptos;
    const valorRetencion = Math.round(baseNum * (retObj?.porcentaje || 0));

    const newRet = {
      id: Date.now(),
      retencionId: selectedRetencionId,
      nombre: retObj?.nombre || "Retención",
      base: baseNum,
      porcentaje: retObj?.porcentaje || 0,
      valor: valorRetencion,
    };

    setRetencionesSeleccionadas((prev) => [...prev, newRet]);
    setSelectedRetencionId("");
    setBaseRetencion("");
  };

  const handleRemoveRetencion = (id) => {
    setRetencionesSeleccionadas((prev) => prev.filter((r) => r.id !== id));
  };

  // Totales
  const subtotalBruto = useMemo(() => {
    return items.reduce((acc, it) => acc + ((parseFloat(it.precioUnitario) || 0) * (parseFloat(it.cantidad) || 0)), 0);
  }, [items]);

  const totalDescuentos = useMemo(() => {
    return items.reduce((acc, it) => acc + (parseFloat(it.descuento) || 0), 0);
  }, [items]);

  const totalConceptos = useMemo(() => {
    return items.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
  }, [items]);

  const totalRetenciones = useMemo(() => {
    return retencionesSeleccionadas.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);
  }, [retencionesSeleccionadas]);

  const totalNetoPagar = useMemo(() => {
    return Math.max(0, totalConceptos - totalRetenciones);
  }, [totalConceptos, totalRetenciones]);

  // Guardar nuevo Tercero desde Modal (Todos los datos requeridos por OralDrive)
  const handleSaveNewTercero = async (e) => {
    e.preventDefault();
    if (!newTerceroData.nombre.trim()) {
      toast.error("El nombre del tercero es obligatorio");
      return;
    }
    if (!newTerceroData.nroDocumento.trim()) {
      toast.error("El número de documento es obligatorio");
      return;
    }
    if (!newTerceroData.telefono.trim()) {
      toast.error("El teléfono es obligatorio");
      return;
    }
    if (!newTerceroData.direccion.trim()) {
      toast.error("La dirección es obligatoria");
      return;
    }

    setSavingTercero(true);
    try {
      const nuevoTerceroObj = {
        id: crypto?.randomUUID ? crypto.randomUUID() : `tercero_${Date.now()}`,
        tenant_id: inquilino,
        nombre: newTerceroData.nombre.trim(),
        apellidos: newTerceroData.apellidos.trim(),
        razon_social: newTerceroData.razonSocial.trim(),
        tipo_documento: newTerceroData.tipoDocumento,
        tipoDocumento: newTerceroData.tipoDocumento,
        numero_documento: newTerceroData.nroDocumento.trim(),
        nroDocumento: newTerceroData.nroDocumento.trim(),
        telefono: newTerceroData.telefono.trim(),
        direccion: newTerceroData.direccion.trim(),
        pais: newTerceroData.pais || "Colombia",
        ciudad: newTerceroData.ciudad || "Sincelejo",
        email: newTerceroData.email.trim(),
        created_at: new Date().toISOString(),
      };

      try {
        await supabase.from("terceros").insert([nuevoTerceroObj]);
      } catch (e) {}

      const fullName = formatTerceroNombre(nuevoTerceroObj) || `${nuevoTerceroObj.nombre} ${nuevoTerceroObj.apellidos}`.trim() || nuevoTerceroObj.razon_social;
      const formattedNew = {
        id: nuevoTerceroObj.id,
        nombre: fullName,
        apellidos: nuevoTerceroObj.apellidos,
        razonSocial: nuevoTerceroObj.razon_social,
        documento: nuevoTerceroObj.nroDocumento,
        tipoDocumento: nuevoTerceroObj.tipoDocumento,
        telefono: nuevoTerceroObj.telefono,
        email: nuevoTerceroObj.email,
        direccion: nuevoTerceroObj.direccion,
        pais: nuevoTerceroObj.pais,
        ciudad: nuevoTerceroObj.ciudad,
        tipo: "tercero",
      };

      setTerceros((prev) => [formattedNew, ...prev]);
      setSelectedTerceroObj(formattedNew);
      setTerceroId(formattedNew.id);
      setTerceroSearchQuery(formattedNew.nombre);
      setIsSearchingTercero(false);
      setShowNewTerceroModal(false);
      setNewTerceroData({
        nombre: "",
        apellidos: "",
        tipoDocumento: "CC",
        nroDocumento: "",
        razonSocial: "",
        telefono: "",
        direccion: "",
        pais: "Colombia",
        ciudad: "Sincelejo",
        email: "",
      });
      toast.success("Tercero registrado correctamente ✅");
    } catch (err) {
      console.error("Error creating tercero:", err);
      toast.error("Error al registrar el tercero");
    } finally {
      setSavingTercero(false);
    }
  };

  // Validaciones antes de guardar
  const validateForm = () => {
    if (!selectedTerceroObj && !terceroId) {
      toast.error("Debe seleccionar un tercero o paciente");
      return false;
    }
    if (items.length === 0) {
      toast.error("Agregue al menos un concepto a la factura");
      return false;
    }
    const hasValidItem = items.some((it) => (it.descripcion || it.concepto) && (parseFloat(it.precioUnitario) || 0) > 0);
    if (!hasValidItem) {
      toast.error("La factura debe tener al menos un concepto con descripción y precio unitario válido");
      return false;
    }
    return true;
  };

  // ─── Proceso de Guardado / Emisión ───
  const handleSaveFactura = async () => {
    if (!validateForm()) return;

    let backendLockToken = null;

    if (initialFactura?.id && !facturaBorrador) {
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
          ? "Operación en curso: ya existe un reintento activo para esta factura."
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
      const targetTercero = selectedTerceroObj || terceros.find((t) => t.id === terceroId || t.nombre === terceroId) || {};
      const pacienteData = {
        id: targetTercero.id || crypto?.randomUUID?.() || `cli_${Date.now()}`,
        nombre: targetTercero.nombre || "Cliente OdontoCloud",
        apellido: targetTercero.apellidos || targetTercero.apellido || "",
        documento: targetTercero.documento || targetTercero.nroDocumento || "222222222222",
        tipoDocumento: targetTercero.tipoDocumento || "CC",
        email: targetTercero.email || userProfile?.email || "",
        telefono: targetTercero.telefono || "3000000000",
        direccion: targetTercero.direccion || "Dirección no registrada",
        ciudad: targetTercero.ciudad || "Sincelejo",
      };

      const stableRefCode = getOrGenerateAuthoritativeReferenceCode(initialFactura);

      const hasClinicalItems = items.some(isClinicalStructuredItem);
      const isSalud = hasClinicalItems || targetTercero.tipo === "paciente";

      const mapMedioPagoCode = (mp) => {
        const s = String(mp || "").toLowerCase();
        if (s.includes("efectivo")) return "10";
        if (s.includes("débito") || s.includes("debito")) return "47";
        if (s.includes("crédito") || s.includes("credito")) return "48";
        if (s.includes("transfer") || s.includes("nequi") || s.includes("banc")) return "42";
        if (s.includes("cheque")) return "20";
        return "10";
      };

      const mapCondicionPagoCode = (cp) => {
        const s = String(cp || "").toLowerCase();
        if (s.includes("crédito") || s.includes("credito")) return "2";
        return "1";
      };

      const medioPagoCode = mapMedioPagoCode(medioPago);
      const condicionPagoCode = mapCondicionPagoCode(condicionPago);

      const invoiceData = {
        tenant_id: inquilino,
        inquilino,
        fecha,
        profesional: profesionalId,
        profesional_id: profesionalId,
        items: items.map((it, idx) => {
          const cups = it.cups || it.codigo_cups || it.concepto || (isSalud ? "SERV-0001" : `ITEM-${Date.now().toString(36)}`);
          const lineId = it.invoiceLineId || (crypto?.randomUUID ? crypto.randomUUID() : `line-${idx + 1}-${Date.now()}`);
          const sourceId = it.clinicalSourceId || it.planItemId || (it.planId && it.id ? it.id : null);
          const sourceType = it.clinicalSourceType || (it.planItemId || it.planId ? "PLAN_ITEM" : null);
          const totalVal = parseFloat(it.total) || Math.max(0, (parseFloat(it.precioUnitario) || 0) * (parseFloat(it.cantidad) || 1) - (parseFloat(it.descuento) || 0));
          const fechaAtencion = (it.fechaAtencion || it.fechaRealizado || fecha || new Date().toISOString()).slice(0, 10);
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
        subtotal: subtotalBruto,
        descuento: totalDescuentos,
        total: totalConceptos,
        totalNeto: totalNetoPagar,
        retenciones: retencionesSeleccionadas,
        condicionPago: condicionPagoCode,
        condicionPagoNombre: condicionPago,
        medioPago: medioPagoCode,
        medioPagoNombre: medioPago,
        observaciones,
        factusReferenceCode: stableRefCode,
      };

      // Si es guardado en BORRADOR (No emite a Factus)
      if (facturaBorrador) {
        const dbDetallesBorrador = {
          ...initialDetalles,
          items: invoiceData.items,
          subtotal: subtotalBruto,
          descuento: totalDescuentos,
          total: totalConceptos,
          totalNeto: totalNetoPagar,
          retenciones: retencionesSeleccionadas,
          medioPago,
          condicionPago,
          observaciones,
          profesional: profesionalId,
          profesional_id: profesionalId,
          fecha,
          esBorrador: true,
          dianStatus: "BORRADOR",
          pacienteNombre: pacienteData.nombre,
          pacienteDocumento: pacienteData.documento,
          tercero: targetTercero,
        };

        const dbFacturaBorrador = {
          tenant_id: inquilino,
          paciente_id: targetTercero.tipo === "paciente" ? targetTercero.id : null,
          numero: initialFactura?.numero || `BORR-${Date.now().toString().slice(-4)}`,
          subtotal: subtotalBruto,
          impuestos: 0,
          total: totalConceptos,
          estado: "Borrador",
          fecha_emision: new Date(fecha).toISOString(),
          detalles: dbDetallesBorrador,
          ...(initialFactura?.id ? { updated_at: new Date().toISOString() } : { created_at: new Date().toISOString() }),
        };

        if (initialFactura?.id) {
          await supabase.from("facturas").update(dbFacturaBorrador).eq("id", initialFactura.id);
        } else {
          await supabase.from("facturas").insert([dbFacturaBorrador]);
        }

        toast.success("Factura guardada en borrador exitosamente ✅");
        if (onSuccess) onSuccess();
        return;
      }

      // Emisión oficial ante la DIAN vía Factus API
      const { getFactusCredentialsForTenant } = await import("../../../services/factusAdminService");
      const tenantData = (await getFactusCredentialsForTenant(inquilino)) || {};
      const hasCredentials = Boolean(tenantData.factusClientId && tenantData.factusClientSecret);

      if (!hasCredentials) setNoCredsWarning(true);

      if (isSalud) {
        const { getConfigSection: getPersistedCfg } = await import("../../../services/configPersistenceService");
        const [companyCfg, tenantRow, sisproSecrets] = await Promise.all([
          getPersistedCfg(inquilino, "empresa_datos", {}),
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
          billingPeriod = buildBillingPeriodFromAttentions(invoiceData.items, new Date(fecha));
        } catch (errDate) {
          setError(`Error en fechas de atención: ${errDate.message}`);
          toast.error(errDate.message);
          setSaving(false);
          return;
        }

        const beneficiary = buildBeneficiaryFromPatient(pacienteData);

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

        const numberingRangeId = billingConfig?.numbering_range_id || tenantData?.factusNumberingRangeId;

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
            items: invoiceData.items,
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
        pacienteData,
        hasCredentials ? tenantData : null
      );

      const finalNumero = result.factusInvoiceNumber || initialFactura?.numero || `FE-${Date.now().toString().slice(-4)}`;
      const linkedReceiptsList = selectedRecibo ? [selectedRecibo] : [];
      const paymentCalc = computePaymentStatus(totalConceptos, linkedReceiptsList);

      let dbDetalles = {
        ...initialDetalles,
        items: invoiceData.items,
        subtotal: subtotalBruto,
        descuento: totalDescuentos,
        total: totalConceptos,
        totalNeto: totalNetoPagar,
        retenciones: retencionesSeleccionadas,
        medioPago,
        condicionPago,
        observaciones,
        profesional: profesionalId,
        profesional_id: profesionalId,
        fecha,
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
        pacienteNombre: pacienteData.nombre,
        pacienteDocumento: pacienteData.documento,
        tercero: targetTercero,
        recibo_asociado: selectedRecibo ? {
          id: selectedRecibo.id,
          recibo_id: selectedRecibo.id,
          numero: selectedRecibo.numero || `REC-${selectedRecibo.id.slice(0, 6)}`,
          monto: Number(selectedRecibo.monto || selectedRecibo.total || 0),
          fecha: selectedRecibo.fecha || selectedRecibo.created_at,
          metodo: selectedRecibo.metodo || "Efectivo",
          tabla_origen: selectedRecibo.isPago ? "pagos" : "recibos_caja",
        } : null,
        monto_pagado: paymentCalc.totalPagado,
        saldo_pendiente: paymentCalc.saldoPendiente,
        estado_pago: paymentCalc.estadoPago,
      };

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
        // Borrador por falta de credenciales
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
        paciente_id: targetTercero.tipo === "paciente" ? targetTercero.id : null,
        numero: finalNumero,
        subtotal: subtotalBruto,
        impuestos: 0,
        total: totalConceptos,
        estado: (result.success && result.cufe) ? "Emitido" : "Pendiente",
        fecha_emision: new Date(fecha).toISOString(),
        detalles: dbDetalles,
        ...(initialFactura?.id ? { updated_at: new Date().toISOString() } : { created_at: new Date().toISOString() }),
      };

      let savedFactura = null;
      try {
        if (initialFactura?.id) {
          const { data: invRow } = await supabase.from("facturas").update(dbFactura).eq("id", initialFactura.id).select().single();
          savedFactura = invRow;
        } else {
          const { data: invRow } = await supabase.from("facturas").insert([dbFactura]).select().single();
          savedFactura = invRow;
        }
      } catch (errDb) {
        console.warn("Error guardando en facturas:", errDb.message);
      }

      if (result.success && result.cufe) {
        setSuccessData(result);
        toast.success("¡Factura electrónica emitida exitosamente con la DIAN! ✅");
      } else if (!hasCredentials) {
        toast.info("Factura guardada como borrador (credenciales Factus pendientes).");
        setSuccessData({ ...result, draft: true });
      } else if (result.errorCode === "409_CONFLICT_PENDING_BILL" || String(result.message).includes("409")) {
        toast.info("Factus reportó factura pendiente (409). Conciliando...");
        try {
          const resolution = await handle409Conflict({
            factura: initialFactura || { id: savedFactura?.id, detalles: dbDetalles },
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
            toast.success("Factura ya validada en Factus / DIAN. Reconciliada.");
            return;
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
      setError(err.message || "Error inesperado al emitir la factura.");
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

  // ─── Vista de Éxito ───
  if (successData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-10 animate-fadeIn text-center max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-3xl">
          <FiCheckCircle size={34} />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">
          {successData.draft ? "Factura guardada en borrador" : "¡Factura electrónica emitida con éxito!"}
        </h2>
        <p className="text-xs text-slate-500 mb-6">{successData.message}</p>

        {successData.cufe && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">CUFE DIAN</span>
            <p className="text-[11px] font-mono text-slate-700 break-all">{successData.cufe}</p>
          </div>
        )}

        {successData.factusInvoiceNumber && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mb-6">
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-1">Número de Factura</span>
            <p className="text-2xl font-black text-blue-700">{successData.factusInvoiceNumber}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onSuccess}
          className="px-8 py-2.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full font-bold text-xs shadow-sm transition-all cursor-pointer border-0 active:scale-95"
        >
          Volver a la lista
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 animate-fadeIn text-slate-800">
      
      {/* ── BARRA SUPERIOR STICKY (CABECERA Y ACCIONES) ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 shadow-xs">
        <div className="max-w-[1300px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <FiArrowLeft size={14} />
              <span>Volver</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                Factura de venta • Nueva factura
              </span>
              <h1 className="text-base font-bold text-slate-800 tracking-tight">
                {isCorrectionMode ? `Corregir Factura #${initialFactura.numero || initialFactura.id}` : "Nueva factura"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-full text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveFactura}
              disabled={saving}
              className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{facturaBorrador ? "Guardando..." : "Emitiendo..."}</span>
                </>
              ) : (
                <>
                  <FiSave size={14} />
                  <span>{facturaBorrador ? "Guardar borrador" : "Guardar y Emitir"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1300px] mx-auto px-6 py-6 space-y-6">

        {/* ALERTA EN MODO CORRECCIÓN */}
        {isCorrectionMode && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 animate-fadeIn space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              <FiAlertCircle className="text-amber-600 shrink-0" size={17} />
              <span>Modo Corrección y Reintento — Factura #{initialFactura.numero || initialFactura.id}</span>
            </div>
            {retryDecision?.lastErrorMessage && (
              <p className="text-xs text-amber-800 ml-6">
                <strong>Causa del rechazo anterior:</strong> {retryDecision.lastErrorMessage}
              </p>
            )}
            <p className="text-[11px] text-amber-700 ml-6 italic">
              Ajuste los datos requeridos y guarde para reenviar ante la DIAN sin duplicar números fiscales.
            </p>
          </div>
        )}

        {/* ADVERTENCIA CREDENCIALES FACTUS */}
        {noCredsWarning && (
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
            <FiAlertCircle className="text-orange-500 mt-0.5 shrink-0" size={18} />
            <p className="text-xs font-medium text-orange-800">
              Configure las credenciales Factus en <strong>Configuración → Facturación Electrónica</strong> para emitir facturas oficiales ante la DIAN. Esta factura se guardará como borrador local.
            </p>
          </div>
        )}

        {/* MENSAJE DE ERROR */}
        {error && (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
            <FiAlertCircle className="text-rose-500 mt-0.5 shrink-0" size={18} />
            <p className="text-xs font-bold text-rose-700">{error}</p>
          </div>
        )}

        {/* ========================================================= */}
        {/* CARD 1: DATOS GENERALES                                   */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
            <h2 className="text-sm font-semibold text-slate-800">Datos generales</h2>
          </div>

          <div className="p-6 space-y-4 max-w-4xl">
            {/* Fecha */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                Fecha <span className="text-rose-500">*</span>
              </label>
              <div className="md:col-span-9">
                <div className="relative max-w-md">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Profesional */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                Profesional
              </label>
              <div className="md:col-span-9">
                <select
                  value={profesionalId}
                  onChange={(e) => setProfesionalId(e.target.value)}
                  className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="">Seleccione...</option>
                  {profesionales.map((p) => (
                    <option key={p.id} value={p.nombre || p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 2: DATOS TERCERO                                     */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
            <h2 className="text-sm font-semibold text-slate-800">Datos tercero</h2>
          </div>

          <div className="p-6 space-y-4 max-w-4xl">
            {/* Tercero con Buscador Interactivo */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <label className="md:col-span-3 text-right text-xs font-medium text-slate-600 pt-2">
                Tercero <span className="text-rose-500">*</span>
              </label>
              <div className="md:col-span-9 flex items-start gap-2">
                <div ref={searchContainerRef} className="relative w-full max-w-md">
                  <div className="relative flex items-center">
                    <FiSearch className="absolute left-3 text-slate-400 pointer-events-none" size={14} />
                    <input
                      type="text"
                      value={terceroSearchQuery}
                      onChange={(e) => {
                        setTerceroSearchQuery(e.target.value);
                        setIsSearchingTercero(true);
                        if (selectedTerceroObj && selectedTerceroObj.nombre !== e.target.value) {
                          setSelectedTerceroObj(null);
                          setTerceroId("");
                        }
                      }}
                      onFocus={() => setIsSearchingTercero(true)}
                      placeholder="Seleccione..."
                      className={`w-full h-9 pl-9 pr-8 bg-white border ${selectedTerceroObj ? "border-emerald-400 bg-emerald-50/20 font-medium text-slate-800" : "border-slate-200 text-slate-700"} rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                      required
                    />
                    {terceroSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setTerceroSearchQuery("");
                          setSelectedTerceroObj(null);
                          setTerceroId("");
                          setIsSearchingTercero(false);
                        }}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer border-0 bg-transparent"
                        title="Limpiar búsqueda"
                      >
                        <FiX size={14} />
                      </button>
                    )}
                  </div>

                  {/* Badge de Selección Activa */}
                  {selectedTerceroObj && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-medium">
                      <span className={`font-bold uppercase text-[9px] px-1.5 py-0.2 rounded text-white ${
                        selectedTerceroObj.tipo === "paciente" ? "bg-purple-600" : "bg-emerald-600"
                      }`}>
                        {selectedTerceroObj.tipo === "paciente" ? "Paciente" : "Tercero"}
                      </span>
                      <span className="truncate">{selectedTerceroObj.nombre}</span>
                      {selectedTerceroObj.documento && (
                        <span className="text-emerald-600 text-[10px]">
                          ({selectedTerceroObj.tipoDocumento || "Doc"}: {selectedTerceroObj.documento})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Menú Flotante de Resultados Filtrados */}
                  {isSearchingTercero && terceroSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
                      {filteredTerceros.length > 0 ? (
                        filteredTerceros.map((t) => (
                          <button
                            key={t.id + t.tipo}
                            type="button"
                            onClick={() => selectTercero(t)}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer border-0 bg-transparent"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{t.nombre}</span>
                              <span className="text-[10px] text-slate-500">
                                {t.tipoDocumento || "Doc"}: {t.documento || "Sin doc"} {t.telefono ? `• Tel: ${t.telefono}` : ""}
                              </span>
                            </div>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              t.tipo === "paciente" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {t.tipo === "paciente" ? "Paciente" : "Tercero"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                          No se encontraron terceros ni pacientes con "<strong>{terceroSearchQuery}</strong>"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewTerceroModal(true)}
                  className="w-8 h-8 rounded-full bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-95 mt-0.5 cursor-pointer border-0"
                  title="Crear nuevo tercero"
                >
                  <FiPlus size={16} />
                </button>
              </div>
            </div>

            {/* Condición de pago */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                Condición de pago <span className="text-rose-500">*</span>
              </label>
              <div className="md:col-span-9">
                <select
                  value={condicionPago}
                  onChange={(e) => setCondicionPago(e.target.value)}
                  className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  required
                >
                  <option value="">Seleccione...</option>
                  {condicionesPagoList.map((cond, idx) => {
                    const condName = typeof cond === "string" ? cond : (cond.nombre || cond.label || "Condición");
                    const diasInfo = cond.dias ? ` (${cond.dias} días)` : "";
                    return (
                      <option key={idx} value={condName}>
                        {condName}{diasInfo}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Medio de pago */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                Medio de pago
              </label>
              <div className="md:col-span-9">
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="">Seleccione...</option>
                  {mediosPagoList.map((mp, idx) => {
                    const mpName = typeof mp === "string" ? mp : (mp.nombre || mp.metodo || "Medio");
                    return (
                      <option key={idx} value={mpName}>
                        {mpName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Factura borrador */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-3 text-right flex items-center justify-end gap-1">
                <span className="text-xs font-medium text-slate-600">Factura borrador</span>
                <span title="Guarda la factura en estado borrador sin transmitirla inmediatamente a la DIAN" className="text-slate-400 cursor-help">
                  <FiInfo size={12} />
                </span>
              </div>
              <div className="md:col-span-9 flex items-center">
                <button
                  type="button"
                  onClick={() => setFacturaBorrador(!facturaBorrador)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out border-0 ${
                    facturaBorrador ? "bg-[#8dc63f]" : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      facturaBorrador ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 3: TABLA DE CONCEPTOS                                */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleAddConcepto}
              className="px-5 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer border-0"
            >
              + Nuevo concepto
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-white">
                  <th className="py-3 px-4 w-[22%]">Concepto</th>
                  <th className="py-3 px-4 w-[28%]">Descripción</th>
                  <th className="py-3 px-4 w-[14%]">Precio unitario</th>
                  <th className="py-3 px-4 w-[10%]">Cantidad</th>
                  <th className="py-3 px-4 w-[12%]">Descuento</th>
                  <th className="py-3 px-4 w-[10%]">Total</th>
                  <th className="py-3 px-4 w-[4%] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={item.concepto}
                        onChange={(e) => handleItemChange(item.id, "concepto", e.target.value)}
                        placeholder="Concepto..."
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => handleItemChange(item.id, "descripcion", e.target.value)}
                        placeholder="Descripción..."
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.precioUnitario || ""}
                        onChange={(e) => handleItemChange(item.id, "precioUnitario", e.target.value)}
                        placeholder="0"
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad || ""}
                        onChange={(e) => handleItemChange(item.id, "cantidad", e.target.value)}
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none text-center"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.descuento || ""}
                        onChange={(e) => handleItemChange(item.id, "descuento", e.target.value)}
                        placeholder="0"
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {fmt(item.total)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveConcepto(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer border-0 bg-transparent"
                        title="Eliminar fila"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 mr-2">Total:</span>
              <span className="text-sm font-bold text-slate-900">{fmt(totalConceptos)}</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 4: RETENCIONES (Anticipos se eliminó por solicitud)  */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Retenciones</h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center max-w-3xl">
            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
              Retención
            </label>
            <div className="md:col-span-4">
              <select
                value={selectedRetencionId}
                onChange={(e) => setSelectedRetencionId(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
              >
                <option value="">Seleccione...</option>
                {RETENCIONES_CATALOGO.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <label className="md:col-span-1 text-right text-xs font-medium text-slate-600 flex items-center justify-end gap-0.5">
              Base <span className="text-rose-500">*</span>
              <span title="Base gravable sobre la cual se calcula la retención" className="text-slate-400 cursor-help">
                <FiInfo size={11} />
              </span>
            </label>
            <div className="md:col-span-3">
              <input
                type="number"
                min="0"
                value={baseRetencion}
                onChange={(e) => setBaseRetencion(e.target.value)}
                placeholder={totalConceptos > 0 ? String(totalConceptos) : "Base gravable"}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="md:col-span-1 flex items-center justify-start">
              <button
                type="button"
                onClick={handleAddRetencion}
                className="w-8 h-8 rounded bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer border-0"
                title="Agregar retención"
              >
                <FiPlus size={16} />
              </button>
            </div>
          </div>

          {/* Tabla de retenciones asociadas */}
          {retencionesSeleccionadas.length > 0 && (
            <div className="overflow-x-auto border border-slate-100 rounded-lg max-w-2xl mt-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-4 w-[45%]">Retención</th>
                    <th className="py-2.5 px-4 w-[25%]">Base</th>
                    <th className="py-2.5 px-4 w-[20%]">Valor</th>
                    <th className="py-2.5 px-4 w-[10%] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retencionesSeleccionadas.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-4 font-medium text-slate-800">{r.nombre}</td>
                      <td className="py-2 px-4 text-slate-600">{fmt(r.base)}</td>
                      <td className="py-2 px-4 font-bold text-slate-900">{fmt(r.valor)}</td>
                      <td className="py-2 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRetencion(r.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer border-0 bg-transparent"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* CARD 5: OBSERVACIONES                                     */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Observaciones</h2>
          <textarea
            rows={4}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones..."
            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y transition-all"
          />
        </div>

        {/* BOTÓN INFERIOR GUARDAR */}
        <div className="flex items-center justify-end gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-full text-xs font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveFactura}
            disabled={saving}
            className="px-8 py-2.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer border-0"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{facturaBorrador ? "Guardando..." : "Emitiendo..."}</span>
              </>
            ) : (
              <span>{facturaBorrador ? "Guardar borrador" : "Guardar y Emitir"}</span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: NUEVO TERCERO * (DISEÑO EXACTO ORALDRIVE)          */}
      {/* ========================================================= */}
      {showNewTerceroModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden">
            {/* Header del Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Nuevo tercero *</h3>
              <button
                type="button"
                onClick={() => setShowNewTerceroModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer border-0 bg-transparent"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Formulario en rejilla horizontal como en OralDrive */}
            <form onSubmit={handleSaveNewTercero} className="p-6 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* Nombre * */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Nombre <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-8">
                  <input
                    type="text"
                    required
                    value={newTerceroData.nombre}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, nombre: e.target.value })}
                    placeholder="Nombre del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Apellidos */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Apellidos
                </label>
                <div className="md:col-span-8">
                  <input
                    type="text"
                    value={newTerceroData.apellidos}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, apellidos: e.target.value })}
                    placeholder="Apellidos del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Tipo de documento * */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Tipo de documento <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-8">
                  <select
                    value={newTerceroData.tipoDocumento}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, tipoDocumento: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="">Seleccione...</option>
                    <option value="CC">Cédula de ciudadanía (CC)</option>
                    <option value="NIT">NIT (Número de identificación tributaria)</option>
                    <option value="CE">Cédula de extranjería (CE)</option>
                    <option value="PP">Pasaporte (PP)</option>
                    <option value="TI">Tarjeta de identidad (TI)</option>
                    <option value="RC">Registro civil (RC)</option>
                  </select>
                </div>
              </div>

              {/* Número de documento * */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Número de documento <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-8">
                  <input
                    type="text"
                    required
                    value={newTerceroData.nroDocumento}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, nroDocumento: e.target.value })}
                    placeholder="Nro. de documento del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Razón social */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Razón social
                </label>
                <div className="md:col-span-8">
                  <input
                    type="text"
                    value={newTerceroData.razonSocial}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, razonSocial: e.target.value })}
                    placeholder="Razón social del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Teléfono * */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Teléfono <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-8">
                  <input
                    type="text"
                    required
                    value={newTerceroData.telefono}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, telefono: e.target.value })}
                    placeholder="Teléfono del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Dirección * */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Dirección <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-8">
                  <input
                    type="text"
                    required
                    value={newTerceroData.direccion}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, direccion: e.target.value })}
                    placeholder="Dirección del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* País de domicilio */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  País de domicilio
                </label>
                <div className="md:col-span-8">
                  <select
                    value={newTerceroData.pais}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, pais: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Estados Unidos">Estados Unidos</option>
                    <option value="España">España</option>
                    <option value="México">México</option>
                    <option value="Venezuela">Venezuela</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Perú">Perú</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Ciudad de domicilio */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Ciudad de domicilio
                </label>
                <div className="md:col-span-8">
                  <select
                    value={newTerceroData.ciudad}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, ciudad: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  >
                    <option value="">Seleccione...</option>
                    {CIUDADES_COLOMBIA.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Correo electrónico */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                  Correo electrónico
                </label>
                <div className="md:col-span-8">
                  <input
                    type="email"
                    value={newTerceroData.email}
                    onChange={(e) => setNewTerceroData({ ...newTerceroData, email: e.target.value })}
                    placeholder="Correo del tercero"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Botones inferiores del modal */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTerceroModal(false)}
                  className="px-5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={savingTercero}
                  className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border-0 active:scale-95 disabled:opacity-50"
                >
                  {savingTercero ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
