import {
  validateRipsWithoutFevEligibility,
  validatePayerForRipsWithoutFev,
  RIPS_MODES,
} from "../services/ripsProviderProfileService.js";

/**
 * Parsea de forma segura el campo 'notas' que puede venir como objeto, string JSON o null.
 * @param {any} rawNotas 
 * @returns {{ data: object, error: string | null }}
 */
export function safeParseNotas(rawNotas) {
  if (!rawNotas) {
    return { data: {}, error: null };
  }
  if (typeof rawNotas === "object") {
    return { data: rawNotas, error: null };
  }
  if (typeof rawNotas === "string") {
    const trimmed = rawNotas.trim();
    if (!trimmed) {
      return { data: {}, error: null };
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return { data: parsed && typeof parsed === "object" ? parsed : {}, error: null };
      } catch (_) {
        return { data: {}, error: "RIPS_PAYMENT_METADATA_INVALID: Campo 'notas' contiene JSON inválido" };
      }
    }
  }
  return { data: {}, error: null };
}

/**
 * Normaliza cualquier fuente de cobro hacia la estructura canónica requerida por RIPS.
 *
 * @param {object} record - Documento crudo de la base de datos
 * @param {string} sourceType - 'pagos' | 'recibos_caja' | 'facturas' | 'facturas_electronicas' | 'facturas_venta'
 * @param {object} [context] - Contexto opcional con patientPlanes para resolver items del plan
 * @returns {object} Documento normalizado canónico
 */
export function normalizeRipsBillingSource(record, sourceType, context = {}) {
  if (!record || typeof record !== "object") {
    throw new Error("INVALID_BILLING_SOURCE: El registro debe ser un objeto válido.");
  }

  const { data: notasData, error: metadataError } = safeParseNotas(record.notas);

  // 1. Identificación del modo de documento (OFFICIAL_FEV vs OFFICIAL_RIPS_WITHOUT_FEV vs LOCAL_PREVIEW)
  const isOfficialInvoice = Boolean(
    sourceType === "facturas" ||
    sourceType === "facturas_electronicas" ||
    sourceType === "facturas_venta"
  );

  let sourceMode = RIPS_MODES.LOCAL_PREVIEW;
  let isOfficialRips = false;
  let numFactura = null;
  let modeEligibilityError = null;

  if (isOfficialInvoice) {
    sourceMode = RIPS_MODES.OFFICIAL_FEV;
    isOfficialRips = true;
    numFactura = record.numeroFactura || record.numero_factura || record.nroConsecutivo || record.numero || record.consecutivo || null;
  } else {
    // Fuentes de cobro locales (pagos / recibos_caja)
    const requestedMode = context.mode || context.requestedMode || null;
    const providerContext = context.providerContext || null;
    const providerProfile = context.providerProfile || providerContext || null;
    const isWithoutFevRequested = requestedMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV ||
      context.allowRipsWithoutFev ||
      providerContext?.ripsMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV;

    if (isWithoutFevRequested) {
      const eligibility = validateRipsWithoutFevEligibility(providerProfile);
      const payerCheck = validatePayerForRipsWithoutFev(
        record.pagador || record.eps || notasData.pagador || notasData.eps
      );

      if (eligibility.eligible && payerCheck.allowed) {
        sourceMode = RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV;
        isOfficialRips = true;
        numFactura = null; // DT1 MinSalud: estrictamente null
      } else {
        sourceMode = RIPS_MODES.LOCAL_PREVIEW;
        isOfficialRips = false;
        numFactura = null;
        modeEligibilityError = !eligibility.eligible ? eligibility.reason : payerCheck.reason;
      }
    } else {
      sourceMode = RIPS_MODES.LOCAL_PREVIEW;
      isOfficialRips = false;
      numFactura = null; // Para preview local, el recibo NO es numFactura oficial
    }
  }

  // 2. Resolución robusta del paciente (respetando snake_case de Supabase)
  const pacienteId =
    record.paciente_id ||
    record.pacienteId ||
    record.patientId ||
    record.paciente?.id ||
    notasData.pacienteId ||
    notasData.paciente_id ||
    null;

  const pacienteNombre =
    record.pacienteNombre ||
    record.patientName ||
    record.paciente_nombre ||
    record.paciente?.nombre ||
    notasData.pacienteNombre ||
    notasData.patientNombre ||
    null;

  const pacienteDocumento =
    record.pacienteDocumento ||
    record.pacienteCedula ||
    record.paciente_documento ||
    record.paciente?.cedula ||
    record.paciente?.documento ||
    notasData.pacienteDocumento ||
    null;

  // 3. Resolución del identificador visible / consecutivo
  let documentNumber = null;
  if (isOfficialInvoice) {
    documentNumber =
      record.numeroFactura ||
      record.nroConsecutivo ||
      record.numero ||
      record.consecutivo ||
      (record.cufe ? record.cufe.substring(0, 12) : null) ||
      (record.id ? record.id.substring(0, 10) : "SIN_NUMERO");
  } else {
    // Fuentes locales (pagos / recibos_caja)
    const rawCons =
      notasData.nroConsecutivo ||
      notasData.consecutivo ||
      record.nroConsecutivo ||
      record.nro_consecutivo ||
      record.numero ||
      record.consecutivo ||
      null;

    if (rawCons) {
      const strCons = String(rawCons).trim();
      if (/^RC-/i.test(strCons) || /^REC-/i.test(strCons)) {
        documentNumber = strCons.toUpperCase();
      } else if (/^\d+$/.test(strCons)) {
        documentNumber = `RC-${strCons.padStart(4, "0")}`;
      } else {
        documentNumber = `RC-${strCons}`;
      }
    } else {
      documentNumber = record.id ? `REC-${record.id.substring(0, 6).toUpperCase()}` : "REC-0001";
    }
  }

  // 4. Extracción y enriquecimiento de líneas / atenciones cobradas
  const patientPlanes = context.patientPlanes || [];
  const patientPlanItems = [];
  patientPlanes.forEach(pl => {
    const items = Array.isArray(pl.items) ? pl.items : (Array.isArray(pl._items) ? pl._items : (pl.detalles?.items || []));
    patientPlanItems.push(...items);
  });

  const normalizedItems = [];

  if (Array.isArray(notasData.itemPayments) && notasData.itemPayments.length > 0) {
    // Caso de pagos vinculados a items específicos de tratamiento
    notasData.itemPayments.forEach(ip => {
      const targetItemId = ip.itemId || ip.id || ip.planItemId || null;
      let matchedPlanItem = null;
      if (targetItemId) {
        matchedPlanItem = patientPlanItems.find(pi => pi.id === targetItemId || pi._id === targetItemId);
      }
      if (!matchedPlanItem && ip.desc) {
        const upperDesc = String(ip.desc).trim().toUpperCase();
        matchedPlanItem = patientPlanItems.find(pi => (pi.nombre || pi.desc || "").trim().toUpperCase() === upperDesc);
      }

      const explicitCups =
        ip.cups ||
        ip.codigo_cups ||
        ip.codigo ||
        matchedPlanItem?.codigo_cups ||
        matchedPlanItem?.codigo ||
        "";

      const asocConsultaId =
        ip.asocConsultaId ||
        matchedPlanItem?.asocConsultaId ||
        null;

      const evolutionId =
        ip.evolutionId ||
        matchedPlanItem?.evolutionId ||
        null;

      const isConsulta = Boolean(
        ip.es_consulta ||
        matchedPlanItem?.es_consulta ||
        asocConsultaId ||
        (explicitCups && explicitCups.startsWith("890"))
      );

      const isOtroServicio = Boolean(
        ip.es_otro_servicio ||
        matchedPlanItem?.es_otro_servicio ||
        ip.tipoOS
      );

      normalizedItems.push({
        id: targetItemId,
        planItemId: targetItemId,
        asocConsultaId,
        evolutionId,
        clinicalSourceId: asocConsultaId || evolutionId || null,
        clinicalSourceType: asocConsultaId ? "documentos_clinicos" : (evolutionId ? "evoluciones" : null),
        codigo: explicitCups,
        codigo_cups: explicitCups,
        cups: explicitCups,
        descripcion: ip.desc || ip.descripcion || matchedPlanItem?.nombre || matchedPlanItem?.desc || "Atención Clínica",
        valor: Number(ip.monto || ip.valor || matchedPlanItem?.amount || 0),
        total: Number(ip.monto || ip.valor || matchedPlanItem?.amount || 0),
        cantidad: Number(ip.cantidad || matchedPlanItem?.qty || 1),
        realizado: matchedPlanItem?.realizado ?? true,
        fechaRealizado: matchedPlanItem?.fechaRealizado || record.fecha || record.created_at,
        es_consulta: isConsulta,
        es_otro_servicio: isOtroServicio,
        tipoOS: ip.tipoOS || matchedPlanItem?.tipoOS || null,
      });
    });
  } else {
    // Si no viene en itemPayments, verificar items / conceptos directos
    const rawItems = record.items || (record.detalles && Array.isArray(record.detalles.items) ? record.detalles.items : null) || record.conceptos || record.servicios || [];
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      rawItems.forEach(it => {
        const explicitCups = it.codigo || it.codigo_cups || it.cups || it.code || "";
        const asocConsultaId = it.asocConsultaId || null;
        const evolutionId = it.evolutionId || null;

        const isConsulta = Boolean(
          it.es_consulta ||
          asocConsultaId ||
          (explicitCups && explicitCups.startsWith("890"))
        );

        const isOtroServicio = Boolean(
          it.es_otro_servicio ||
          it.tipoOS
        );

        normalizedItems.push({
          id: it.id || null,
          planItemId: it.planItemId || it.id || null,
          asocConsultaId,
          evolutionId,
          clinicalSourceId: asocConsultaId || evolutionId || null,
          clinicalSourceType: asocConsultaId ? "documentos_clinicos" : (evolutionId ? "evoluciones" : null),
          codigo: explicitCups,
          codigo_cups: explicitCups,
          cups: explicitCups,
          descripcion: it.descripcion || it.concepto || it.desc || it.nombre || "Atención Clínica",
          valor: Number(it.total || it.valor || it.precio || it.subtotal || 0),
          total: Number(it.total || it.valor || it.precio || it.subtotal || 0),
          cantidad: Number(it.cantidad || 1),
          realizado: it.realizado ?? true,
          fechaRealizado: it.fechaRealizado || record.fecha || record.created_at,
          es_consulta: isConsulta,
          es_otro_servicio: isOtroServicio,
          tipoOS: it.tipoOS || null,
        });
      });
    } else {
      // Fallback básico si solo existe monto global
      const montoTotal = Number(record.monto || record.total || record.valor || record.valorTotal || 0);
      const descGlobal = record.concepto || record.descripcion || notasData.concepto || "Atención Odontológica";
      normalizedItems.push({
        id: null,
        planItemId: null,
        asocConsultaId: null,
        evolutionId: null,
        clinicalSourceId: null,
        clinicalSourceType: null,
        codigo: "",
        codigo_cups: "",
        cups: "",
        descripcion: descGlobal,
        valor: montoTotal,
        total: montoTotal,
        cantidad: 1,
        realizado: true,
        fechaRealizado: record.fecha || record.created_at,
        es_consulta: false,
        es_otro_servicio: false,
        tipoOS: null,
      });
    }
  }

  return {
    sourceType,
    sourceMode,
    isOfficialInvoice,
    isOfficialRips,
    numFactura,
    modeEligibilityError,
    id: record.id,
    documentNumber,
    displayNumber: documentNumber,
    invoiceId: documentNumber,
    pacienteId,
    pacienteNombre,
    pacienteDocumento,
    facturaId: record.factura_id || record.facturaId || null,
    planId: notasData.planId || record.plan_id || record.planId || null,
    items: normalizedItems,
    fecha: record.fecha || record.fecha_emision || record.created_at,
    fechaRealizado: record.fechaRealizado || record.fecha_realizado || record.fecha || record.created_at,
    tenantId: record.tenant_id || record.inquilino,
    sedeId: record.sede_id || record.sucursal_id || null,
    cufe: record.cufe || record.cufeFactura || null,
    tipoNota: record.tipoNota || record.tipo_nota || null,
    rawDoc: record,
    metadataNotas: notasData,
    metadataError,
  };
}
