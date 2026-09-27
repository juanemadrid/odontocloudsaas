/**
 * factusRetryService.js
 * OdontoCloud — Safe Correction & Retry Workflow for Electronic Invoicing (FEV)
 * Microfase P1-FEV2-R: Atomic Backend Guard + 409 Reconciliation + Unvalidated Bill Deletion
 *
 * Implements:
 * - Authoritative PostgreSQL backend concurrency lock (tenant_id + factura_id).
 * - Stable, persisted reference_code generation & reuse.
 * - HTTP 409 Conflict reconciliation (query Factus -> delete unvalidated if eligible -> re-emit).
 * - Safe unvalidated bill deletion via DELETE /v2/bills/destroy/reference/:reference_code.
 * - Strict CUFE & validated document protection (NEVER delete or re-emit; requires Credit Note).
 * - Extended fevAttempts history tracking operation, reference_code, is_validated, factus_status.
 */

import supabase from "../lib/supabaseClient.js";
import {
  checkFactusBill,
  deleteUnvalidatedFactusBill as proxyDeleteUnvalidated,
} from "./factusProxyService.js";

export const FEV_STAGE = {
  PRE_VALIDATION_ERROR: "PRE_VALIDATION_ERROR",
  FACTUS_VALIDATION_REJECTED: "FACTUS_VALIDATION_REJECTED",
  DIAN_REJECTED: "DIAN_REJECTED",
  ACCEPTED: "ACCEPTED",
  TECHNICAL_ERROR: "TECHNICAL_ERROR",
  PENDING: "PENDING",
  DRAFT: "DRAFT",
};

export const RETRY_DECISION = {
  ALREADY_ACCEPTED: "ALREADY_ACCEPTED",
  CREDIT_NOTE_REQUIRED: "CREDIT_NOTE_REQUIRED",
  STATUS_CHECK_REQUIRED: "STATUS_CHECK_REQUIRED",
  CORRECT_DELETE_AND_RECREATE: "CORRECT_DELETE_AND_RECREATE",
  CORRECTION_REQUIRED: "CORRECTION_REQUIRED",
  RETRY_ALLOWED: "RETRY_ALLOWED",
  NOT_RETRYABLE: "NOT_RETRYABLE",
};

export const FEV_LOCK_STATE = {
  IDLE: "IDLE",
  CHECKING_STATUS: "CHECKING_STATUS",
  RETRYING: "RETRYING",
  DELETING: "DELETING",
};

export const FEV_OPERATION = {
  EMIT: "EMIT",
  RETRY: "RETRY",
  STATUS_CHECK: "STATUS_CHECK",
  DELETE_UNVALIDATED: "DELETE_UNVALIDATED",
  RECONCILE: "RECONCILE",
};

// ─────────────────────────────────────────────────────────────
// 1. In-flight Concurrency Lock Guard (Authoritative Backend + UX Fallback)
// ─────────────────────────────────────────────────────────────

// UX Memory lock (for immediate UI state feedback within the same JS thread)
const activeRetryLocks = new Set();

export const acquireRetryLock = (invoiceId) => {
  if (!invoiceId) return;
  const key = String(invoiceId);
  if (activeRetryLocks.has(key)) {
    const error = new Error(
      "Ya hay una operación de emisión o reintento en curso para esta factura (FEV_OPERATION_ALREADY_IN_PROGRESS). Por favor espere."
    );
    error.code = "FEV_OPERATION_ALREADY_IN_PROGRESS";
    throw error;
  }
  activeRetryLocks.add(key);
};

export const releaseRetryLock = (invoiceId) => {
  if (!invoiceId) return;
  activeRetryLocks.delete(String(invoiceId));
};

export const isRetryInProgress = (invoiceId) => {
  if (!invoiceId) return false;
  return activeRetryLocks.has(String(invoiceId));
};

/**
 * Authoritative Backend Concurrency Lock via PostgreSQL RPC.
 * Guarantees atomic isolation across multiple tabs, browsers, users, and serverless instances.
 */
export const acquireFevBackendLock = async ({
  tenantId,
  facturaId,
  state = FEV_LOCK_STATE.RETRYING,
  lockedBy = "system",
  timeoutSeconds = 120,
}) => {
  if (!tenantId || !facturaId) {
    throw new Error("tenantId y facturaId son obligatorios para adquirir lock FEV backend.");
  }

  // Acquire local UX lock first
  acquireRetryLock(facturaId);

  try {
    const { data, error } = await supabase.rpc("acquire_fev_operation_lock", {
      p_tenant_id: tenantId,
      p_factura_id: facturaId,
      p_state: state,
      p_locked_by: lockedBy,
      p_timeout_seconds: timeoutSeconds,
    });

    if (error) {
      releaseRetryLock(facturaId);
      throw error;
    }

    if (!data?.acquired) {
      releaseRetryLock(facturaId);
      const lockErr = new Error(
        data?.message || "Ya hay una operación FEV activa en curso para esta factura."
      );
      lockErr.code = data?.error || "FEV_OPERATION_ALREADY_IN_PROGRESS";
      lockErr.state = data?.state;
      lockErr.lockedAt = data?.locked_at;
      lockErr.expiresAt = data?.expires_at;
      throw lockErr;
    }

    return {
      success: true,
      lockToken: data.lock_token,
      state: data.state,
      expiresAt: data.expires_at,
    };
  } catch (err) {
    releaseRetryLock(facturaId);
    throw err;
  }
};

/**
 * Authoritative Backend Concurrency Unlock via PostgreSQL RPC.
 */
export const releaseFevBackendLock = async ({ tenantId, facturaId, lockToken }) => {
  releaseRetryLock(facturaId);

  if (!tenantId || !facturaId || !lockToken) {
    return { success: false, released: false };
  }

  try {
    const { data, error } = await supabase.rpc("release_fev_operation_lock", {
      p_tenant_id: tenantId,
      p_factura_id: facturaId,
      p_lock_token: lockToken,
    });

    if (error) {
      console.warn("Error liberando lock FEV backend:", error.message);
      return { success: false, released: false };
    }

    return { success: true, released: Boolean(data?.released) };
  } catch (err) {
    console.warn("Excepción liberando lock FEV backend:", err.message);
    return { success: false, released: false };
  }
};

// ─────────────────────────────────────────────────────────────
// 2. Authoritative Reference Code Persistence
// ─────────────────────────────────────────────────────────────

/**
 * Resolves or generates the authoritative, stable reference_code for an invoice.
 * Must be unique per tenant/document and strictly persisted across retries and status checks.
 * FACTUS_REFERENCE_CODE_PERSISTED = YES.
 */
export const getOrGenerateAuthoritativeReferenceCode = (factura) => {
  if (!factura) return `OC-${Date.now().toString(36).toUpperCase()}`;

  const detalles = factura.detalles && typeof factura.detalles === "object" ? factura.detalles : {};
  if (detalles.factusReferenceCode && typeof detalles.factusReferenceCode === "string") {
    return detalles.factusReferenceCode.trim();
  }

  if (factura.factusReferenceCode && typeof factura.factusReferenceCode === "string") {
    return factura.factusReferenceCode.trim();
  }

  // Stable derivation based on primary key if available
  if (factura.id) {
    const cleanId = String(factura.id).replace(/-/g, "").slice(0, 12).toUpperCase();
    return `OC-${cleanId}`;
  }

  return `OC-${Date.now().toString(36).toUpperCase()}`;
};

// ─────────────────────────────────────────────────────────────
// 3. Sanitization Helper
// ─────────────────────────────────────────────────────────────
export const sanitizeErrorMessage = (msg) => {
  if (!msg) return "";
  let clean = String(msg);
  // Omit bearer tokens
  clean = clean.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
  // Omit client_secret or password patterns
  clean = clean.replace(/client_secret=[^&\s]+/gi, "client_secret=[REDACTED]");
  clean = clean.replace(/password=[^&\s]+/gi, "password=[REDACTED]");
  clean = clean.replace(
    /"(factusPassword|factusClientSecret|client_secret|password)"\s*:\s*"[^"]+"/gi,
    '"$1":"[REDACTED]"'
  );
  // Omit massive base64 XML blobs
  if (clean.length > 1000) {
    clean = clean.slice(0, 1000) + "... [TRUNCATED]";
  }
  return clean;
};

// ─────────────────────────────────────────────────────────────
// 4. Error Normalization Engine
// ─────────────────────────────────────────────────────────────
const FIELD_TRANSLATIONS = {
  "customer.email": "El correo electrónico del paciente no es válido o está vacío.",
  "customer.phone": "El teléfono del paciente debe tener formato válido (al menos 10 dígitos).",
  "customer.identification": "El número de identificación del paciente es inválido.",
  "customer.identification_document_code": "El tipo de documento del paciente no es válido ante la DIAN.",
  "customer.names": "El nombre del paciente es obligatorio.",
  "customer.municipality_code": "El municipio de residencia del paciente no es válido.",
  "payment_details.0.payment_method_code": "El medio de pago seleccionado no es válido ante Factus / DIAN.",
  "payment_details.0.payment_form": "La condición de pago (contado/crédito) es inválida.",
  "numbering_range_id": "El rango de numeración seleccionado es inválido o no está activo.",
  "health_fields.provider_code": "El código de prestador de salud (REPS) no es válido.",
  "health_fields.payment_method_code": "La modalidad de pago de salud seleccionada no es válida para el perfil de catálogo.",
  "health_fields.coverage_code": "El código de cobertura de salud es obligatorio.",
  "billing_period.start_date": "La fecha inicial del período de facturación es inválida.",
  "billing_period.end_date": "La fecha final del período de facturación es inválida.",
  "items": "La factura debe incluir al menos un servicio o ítem válido.",
};

export const normalizeFactusError = (error, rawResponse = null) => {
  const rawMsg = error?.message || (typeof error === "string" ? error : "");
  const status = error?.status || rawResponse?.status || 0;
  const lowerMsg = rawMsg.toLowerCase();

  // A. Timeout / Network error
  const isNetworkTimeout =
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("abort") ||
    lowerMsg.includes("econnreset") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("econnaborted") ||
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("network error") ||
    lowerMsg.includes("gateway") ||
    status === 504 ||
    status === 502;

  if (isNetworkTimeout) {
    return {
      category: FEV_STAGE.TECHNICAL_ERROR,
      code: "TIMEOUT",
      friendlyMessage:
        "Tiempo de espera agotado al conectar con Factus. No se pudo confirmar el estado del documento en la DIAN.",
      errorFields: null,
      rawMessage: sanitizeErrorMessage(rawMsg),
    };
  }

  // B. HTTP 409 Conflict: Pending bill in Factus
  const is409Conflict =
    status === 409 ||
    lowerMsg.includes("409") ||
    lowerMsg.includes("pendiente por enviar") ||
    lowerMsg.includes("factura pendiente");

  if (is409Conflict) {
    return {
      category: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
      code: "409_CONFLICT_PENDING_BILL",
      friendlyMessage:
        "Se encontró una factura pendiente en Factus con el mismo código de referencia. Se debe verificar su validación antes de continuar.",
      errorFields: null,
      rawMessage: sanitizeErrorMessage(rawMsg),
      is409Conflict: true,
    };
  }

  // C. Preflight / Local validation error
  const isPreflight =
    lowerMsg.includes("health_preflight_error") ||
    lowerMsg.includes("factus_health_catalog_profile_required") ||
    lowerMsg.includes("clinical_invoice_cannot_bypass_health_mode") ||
    lowerMsg.includes("fev_clinical_source_required") ||
    lowerMsg.includes("preflight") ||
    lowerMsg.includes("no tiene credenciales") ||
    lowerMsg.includes("campos obligatorios");

  if (isPreflight) {
    return {
      category: FEV_STAGE.PRE_VALIDATION_ERROR,
      code: "PRE_VALIDATION",
      friendlyMessage:
        "La validación previa de datos falló. Verifique los campos obligatorios del paciente, servicios y configuración de salud.",
      errorFields: null,
      rawMessage: sanitizeErrorMessage(rawMsg),
    };
  }

  // D. DIAN rejection
  const isDianRejection =
    lowerMsg.includes("dian") &&
    (lowerMsg.includes("rechaz") || lowerMsg.includes("regla") || lowerMsg.includes("not accepted"));

  if (isDianRejection) {
    return {
      category: FEV_STAGE.DIAN_REJECTED,
      code: "DIAN_REJECTED",
      friendlyMessage:
        "El documento fue transmitido pero la DIAN rechazó su validación fiscal formal.",
      errorFields: null,
      rawMessage: sanitizeErrorMessage(rawMsg),
    };
  }

  // E. Factus HTTP 422 or Semantic validation failure
  const isFactus422 =
    status === 422 || lowerMsg.includes("422") || lowerMsg.includes("invalid") || rawMsg.includes(":");
  if (isFactus422) {
    const errorFields = {};
    const parts = rawMsg.split("|").map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      const colonIdx = part.indexOf(":");
      if (colonIdx > 0) {
        const field = part.slice(0, colonIdx).trim();
        const desc = part.slice(colonIdx + 1).trim();
        errorFields[field] = FIELD_TRANSLATIONS[field] || desc;
      }
    }

    const fieldKeys = Object.keys(errorFields);
    let friendlyMessage = "Factus rechazó la validación previa del documento.";
    if (fieldKeys.length > 0) {
      friendlyMessage = `Errores de validación en: ${fieldKeys.map((f) => errorFields[f]).join("; ")}`;
    }

    return {
      category: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
      code: "422",
      friendlyMessage,
      errorFields: fieldKeys.length > 0 ? errorFields : null,
      rawMessage: sanitizeErrorMessage(rawMsg),
    };
  }

  // F. Generic fallback
  return {
    category: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
    code: String(status || "UNKNOWN"),
    friendlyMessage: sanitizeErrorMessage(rawMsg) || "Error al procesar la factura electrónica.",
    errorFields: null,
    rawMessage: sanitizeErrorMessage(rawMsg),
  };
};

// ─────────────────────────────────────────────────────────────
// 5. Authoritative Decision Engine
// ─────────────────────────────────────────────────────────────
export const getFevRetryDecision = (factura) => {
  if (!factura) {
    return {
      decision: RETRY_DECISION.NOT_RETRYABLE,
      canRetry: false,
      requiresCorrection: false,
      requiresStatusCheck: false,
      requiresDeletion: false,
      reason: "NO_INVOICE_DATA",
      friendlyMessage: "No se proporcionaron datos de factura.",
      lastAttempt: null,
      errorCategory: null,
      errorFields: null,
      lastErrorMessage: null,
    };
  }

  const detalles = factura.detalles && typeof factura.detalles === "object" ? factura.detalles : {};
  const cufe = factura.factusCufe || factura.cufe || detalles.cufe || detalles.factusCufe || null;
  const dianStatus = String(factura.dianStatus || detalles.dianStatus || "").toUpperCase();

  const attempts = Array.isArray(detalles.fevAttempts) ? detalles.fevAttempts : [];
  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  // RULE 1: STRICT CUFE BLOCK — Fiscal double-emission blocker
  if (cufe || dianStatus === "ACEPTADA" || (dianStatus === "SIMULADA" && (cufe || factura.numero))) {
    return {
      decision: RETRY_DECISION.ALREADY_ACCEPTED,
      canRetry: false,
      requiresCorrection: false,
      requiresStatusCheck: false,
      requiresDeletion: false,
      reason: "DOCUMENT_ALREADY_VALIDATED",
      friendlyMessage:
        "Documento ya emitido y validado fiscalmente por la DIAN (CUFE asignado). Para corregir errores fiscales en este documento debe emitir una Nota Crédito (P1-FEV3).",
      lastAttempt,
      errorCategory: null,
      errorFields: null,
      lastErrorMessage: null,
      cufe,
    };
  }

  // RULE 2: TECHNICAL TIMEOUT / UNKNOWN OUTCOME — Must query Factus first
  const isTechnicalError =
    detalles.technicalError === true ||
    dianStatus === "INDETERMINADO" ||
    (lastAttempt?.status === FEV_STAGE.TECHNICAL_ERROR && detalles.technicalError !== false);

  if (isTechnicalError) {
    return {
      decision: RETRY_DECISION.STATUS_CHECK_REQUIRED,
      canRetry: false,
      requiresCorrection: false,
      requiresStatusCheck: true,
      requiresDeletion: false,
      reason: "TIMEOUT_UNKNOWN_OUTCOME",
      friendlyMessage:
        "La emisión previa sufrió un corte de red o tiempo de espera sin confirmación. Verifique primero el estado en Factus antes de reintentar para no generar facturas duplicadas.",
      lastAttempt,
      errorCategory: FEV_STAGE.TECHNICAL_ERROR,
      errorFields: null,
      lastErrorMessage: lastAttempt?.error_message || detalles.lastError || "Tiempo de espera agotado.",
    };
  }

  // RULE 3: DIAN_REJECTED RECONCILIATION
  if (lastAttempt?.status === FEV_STAGE.DIAN_REJECTED || dianStatus === "RECHAZADA") {
    // CASO B: Si tuviese CUFE o validación DIAN confirmada
    if (cufe || lastAttempt?.cufe) {
      return {
        decision: RETRY_DECISION.CREDIT_NOTE_REQUIRED,
        canRetry: false,
        requiresCorrection: false,
        requiresStatusCheck: false,
        requiresDeletion: false,
        requiresCreditNote: true,
        reason: "FISCAL_DOCUMENT_EXISTS_CREDIT_NOTE_REQUIRED",
        friendlyMessage:
          "El documento ya cuenta con existencia fiscal / CUFE. No es reintentable directamente; requiere Nota Crédito (P1-FEV3).",
        lastAttempt,
        errorCategory: FEV_STAGE.DIAN_REJECTED,
        errorFields: null,
        lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
      };
    }

    // CASO A: Rechazada / no validada y eliminable en Factus
    if (lastAttempt?.is_validated === false || detalles.factusIsValidated === false || detalles.factusExists === true) {
      return {
        decision: RETRY_DECISION.CORRECT_DELETE_AND_RECREATE,
        canRetry: true,
        requiresCorrection: true,
        requiresStatusCheck: false,
        requiresDeletion: true,
        reason: "UNVALIDATED_REJECTED_DELETE_AND_RECREATE",
        friendlyMessage:
          "La DIAN rechazó el documento y no está validado. Se debe eliminar el borrador pendiente en Factus antes de reemitir.",
        lastAttempt,
        errorCategory: FEV_STAGE.DIAN_REJECTED,
        errorFields: lastAttempt?.error_fields || null,
        lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
      };
    }

    // CASO C: Estado indeterminado / no verificado aún
    return {
      decision: RETRY_DECISION.CORRECTION_REQUIRED,
      canRetry: true,
      requiresCorrection: true,
      requiresStatusCheck: false,
      requiresDeletion: false,
      reason: "DIAN_REJECTED_DOCUMENT",
      friendlyMessage:
        lastAttempt?.error_message ||
        "La DIAN rechazó formalmente el documento. Corrija las causales del rechazo antes de reintentar.",
      lastAttempt,
      errorCategory: FEV_STAGE.DIAN_REJECTED,
      errorFields: lastAttempt?.error_fields || null,
      lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
    };
  }

  // RULE 4: HTTP 409 CONFLICT OR PENDING UNVALIDATED BILL
  if (lastAttempt?.error_code === "409_CONFLICT_PENDING_BILL" || detalles.pending409 === true) {
    return {
      decision: RETRY_DECISION.CORRECT_DELETE_AND_RECREATE,
      canRetry: true,
      requiresCorrection: true,
      requiresStatusCheck: true,
      requiresDeletion: true,
      reason: "HTTP_409_PENDING_BILL_DELETE_REQUIRED",
      friendlyMessage:
        "Factus tiene una factura previa no validada con este código de referencia. Se debe eliminar en Factus antes de volver a emitir.",
      lastAttempt,
      errorCategory: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
      errorFields: null,
      lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
    };
  }

  // RULE 5: FACTUS 422 VALIDATION REJECTION
  if (lastAttempt?.status === FEV_STAGE.FACTUS_VALIDATION_REJECTED) {
    // Si Factus creó documento no validado -> DELETE_AND_RECREATE
    if (detalles.factusExists === true && detalles.factusIsValidated === false) {
      return {
        decision: RETRY_DECISION.CORRECT_DELETE_AND_RECREATE,
        canRetry: true,
        requiresCorrection: true,
        requiresStatusCheck: false,
        requiresDeletion: true,
        reason: "FACTUS_UNVALIDATED_BILL_EXISTS",
        friendlyMessage:
          "Factus registró un documento no validado con errores. Debe eliminarse antes de recrearlo.",
        lastAttempt,
        errorCategory: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
        errorFields: lastAttempt?.error_fields || null,
        lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
      };
    }

    return {
      decision: RETRY_DECISION.CORRECTION_REQUIRED,
      canRetry: true,
      requiresCorrection: true,
      requiresStatusCheck: false,
      requiresDeletion: false,
      reason: "FACTUS_VALIDATION_FAILED",
      friendlyMessage:
        lastAttempt?.error_message ||
        "Factus rechazó la validación previa. Corrija los datos señalados antes de volver a emitir.",
      lastAttempt,
      errorCategory: lastAttempt?.error_category || FEV_STAGE.FACTUS_VALIDATION_REJECTED,
      errorFields: lastAttempt?.error_fields || null,
      lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
    };
  }

  // RULE 6: PRE-VALIDATION / LOCAL ERROR — Local preflight failed
  if (lastAttempt?.status === FEV_STAGE.PRE_VALIDATION_ERROR) {
    return {
      decision: RETRY_DECISION.CORRECTION_REQUIRED,
      canRetry: true,
      requiresCorrection: true,
      requiresStatusCheck: false,
      requiresDeletion: false,
      reason: "LOCAL_PREFLIGHT_FAILED",
      friendlyMessage:
        lastAttempt?.error_message ||
        "La validación previa falló debido a campos faltantes o inconsistencias normativas. Corrija los datos requeridos.",
      lastAttempt,
      errorCategory: FEV_STAGE.PRE_VALIDATION_ERROR,
      errorFields: lastAttempt?.error_fields || null,
      lastErrorMessage: lastAttempt?.error_message || detalles.lastError || null,
    };
  }

  // RULE 7: DRAFT / INITIAL EMISSION — Safe to emit
  return {
    decision: RETRY_DECISION.RETRY_ALLOWED,
    canRetry: true,
    requiresCorrection: false,
    requiresStatusCheck: false,
    requiresDeletion: false,
    reason: "DOCUMENT_READY_TO_EMIT",
    friendlyMessage: "Documento listo para emisión electrónica.",
    lastAttempt: null,
    errorCategory: null,
    errorFields: null,
    lastErrorMessage: null,
  };
};

// ─────────────────────────────────────────────────────────────
// 6. Attempt History Recorder (fevAttempts Extended)
// ─────────────────────────────────────────────────────────────
export const recordFevAttempt = (detalles = {}, attemptData = {}) => {
  const currentAttempts = Array.isArray(detalles?.fevAttempts) ? [...detalles.fevAttempts] : [];
  const attemptNumber = currentAttempts.length + 1;

  const operation = attemptData.operation || (
    attemptData.status === FEV_STAGE.ACCEPTED
      ? FEV_OPERATION.EMIT
      : FEV_OPERATION.RETRY
  );

  const sanitizedAttempt = {
    attempt_number: attemptNumber,
    timestamp: new Date().toISOString(),
    operation,
    status: attemptData.status || FEV_STAGE.PENDING,
    reference_code: attemptData.reference_code || attemptData.referenceCode || detalles.factusReferenceCode || null,
    is_validated: attemptData.is_validated !== undefined ? Boolean(attemptData.is_validated) : null,
    factus_status: attemptData.factus_status || null,
    error_category: attemptData.error_category || null,
    error_code: attemptData.error_code || null,
    error_message: sanitizeErrorMessage(attemptData.error_message || null),
    error_fields: attemptData.error_fields || null,
    payload_hash: attemptData.payload_hash || null,
    factus_invoice_number: attemptData.factus_invoice_number || null,
    cufe: attemptData.cufe || null,
  };

  currentAttempts.push(sanitizedAttempt);

  const isAccepted = attemptData.status === FEV_STAGE.ACCEPTED;
  const isTechnical = attemptData.status === FEV_STAGE.TECHNICAL_ERROR;

  return {
    ...detalles,
    fevAttempts: currentAttempts,
    lastFevAttempt: sanitizedAttempt,
    factusReferenceCode: sanitizedAttempt.reference_code || detalles.factusReferenceCode,
    lastError: isAccepted ? null : sanitizedAttempt.error_message,
    technicalError: isTechnical,
    dianStatus: isAccepted
      ? attemptData.isTestMode
        ? "SIMULADA"
        : "ACEPTADA"
      : isTechnical
      ? "INDETERMINADO"
      : "RECHAZADA",
    cufe: isAccepted ? attemptData.cufe || detalles.cufe : detalles.cufe,
    factusInvoiceNumber: isAccepted
      ? attemptData.factus_invoice_number || detalles.factusInvoiceNumber
      : detalles.factusInvoiceNumber,
    factusIsValidated: attemptData.is_validated !== undefined ? Boolean(attemptData.is_validated) : detalles.factusIsValidated,
  };
};

// ─────────────────────────────────────────────────────────────
// 7. Factus Status Verification & Reconciliation
// ─────────────────────────────────────────────────────────────
export const checkFactusBillStatus = async ({ tenantId, referenceCode, invoiceNumber }) => {
  if (!referenceCode && !invoiceNumber) {
    throw new Error("Se requiere referenceCode o invoiceNumber para verificar estado en Factus.");
  }

  try {
    const response = await checkFactusBill({
      billNumber: invoiceNumber,
      referenceCode,
      tenantId,
    });

    if (response?.exists && response?.result?.bill) {
      const bill = response.result.bill;
      const cufe = bill.cufe || bill.cude || null;
      const number = bill.number || bill.invoice_number || null;
      const qrCode = bill.qr_code || bill.qr || null;
      const isValidated = Boolean(
        bill.is_validated === true ||
        bill.is_validated === 1 ||
        String(bill.status || "").toUpperCase() === "ACEPTADA" ||
        cufe
      );

      return {
        found: true,
        exists: true,
        cufe,
        invoiceNumber: number,
        qrCode,
        isValidated,
        is_validated: isValidated,
        status: cufe ? "ACEPTADA" : (bill.status || "PROCESANDO"),
        factus_status: bill.status || (cufe ? "ACEPTADA" : "PENDIENTE"),
        referenceCode: bill.reference_code || referenceCode,
        billData: bill,
      };
    }

    return {
      found: false,
      exists: false,
      not_found: true,
      message: "El documento no fue encontrado en Factus. Se puede proceder con el reenvío seguro.",
    };
  } catch (err) {
    if (String(err.message).includes("404") || String(err.message).toLowerCase().includes("not found")) {
      return {
        found: false,
        exists: false,
        not_found: true,
        message: "Factus confirmó que el documento no existe.",
      };
    }
    throw err;
  }
};

/**
 * Reconciles local database invoice with official Factus data without re-emitting.
 */
export const reconcileFactusInvoice = async ({ factura, factusBillData, tenantId }) => {
  if (!factura?.id) throw new Error("Factura ID es obligatorio para reconciliar.");

  const cufe = factusBillData.cufe || factusBillData.billData?.cufe;
  const invoiceNumber = factusBillData.invoiceNumber || factusBillData.billData?.number;
  const qrCode = factusBillData.qrCode || factusBillData.billData?.qr_code;
  const referenceCode = factusBillData.referenceCode || factusBillData.billData?.reference_code || factura.detalles?.factusReferenceCode;

  let currentDetalles = factura.detalles || {};
  if (typeof currentDetalles === "string") {
    try {
      currentDetalles = JSON.parse(currentDetalles);
    } catch {
      currentDetalles = {};
    }
  }

  const updatedDetalles = recordFevAttempt(currentDetalles, {
    operation: FEV_OPERATION.RECONCILE,
    status: FEV_STAGE.ACCEPTED,
    reference_code: referenceCode,
    is_validated: true,
    factus_status: "ACEPTADA",
    cufe,
    factus_invoice_number: invoiceNumber,
    error_message: "Reconciliación exitosa tras verificación de estado en Factus.",
    isTestMode: false,
  });

  updatedDetalles.cufe = cufe;
  updatedDetalles.qrCode = qrCode;
  updatedDetalles.factusInvoiceNumber = invoiceNumber;
  updatedDetalles.factusReferenceCode = referenceCode;
  updatedDetalles.technicalError = false;
  updatedDetalles.dianStatus = "ACEPTADA";
  updatedDetalles.factusIsValidated = true;

  const { data: updatedRow, error: updateErr } = await supabase
    .from("facturas")
    .update({
      numero: invoiceNumber || factura.numero,
      estado: "Emitido",
      detalles: updatedDetalles,
    })
    .eq("id", factura.id)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return updatedRow;
};

// ─────────────────────────────────────────────────────────────
// 8. Safe Unvalidated Bill Deletion & 409 Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Safely deletes an unvalidated bill from Factus via backend proxy.
 * Strictly blocked if bill is validated or has a CUFE.
 */
export const deleteUnvalidatedFactusBill = async ({ referenceCode, invoiceId, tenantId }) => {
  if (!referenceCode) {
    throw new Error("Se requiere referenceCode para eliminar factura no validada.");
  }

  const response = await proxyDeleteUnvalidated({
    referenceCode,
    invoiceId,
    tenantId,
  });

  return response;
};

/**
 * Resolves an HTTP 409 Conflict: "Se encontró una factura pendiente por enviar a la DIAN".
 * Step 1: Query Factus by reference_code.
 * Step 2: If validated or CUFE exists -> reconcile and return FEV_ALREADY_VALIDATED.
 * Step 3: If unvalidated -> delete via official endpoint, record attempt, return READY_FOR_RECREATE.
 */
export const handle409Conflict = async ({ factura, tenantId, referenceCode }) => {
  const refCode = referenceCode || getOrGenerateAuthoritativeReferenceCode(factura);

  // Step 1: Query Factus
  const statusCheck = await checkFactusBillStatus({
    tenantId,
    referenceCode: refCode,
  });

  if (statusCheck.found && (statusCheck.isValidated || statusCheck.cufe)) {
    // Document already accepted by DIAN
    const reconciled = await reconcileFactusInvoice({
      factura,
      factusBillData: statusCheck,
      tenantId,
    });

    return {
      outcome: "FEV_ALREADY_VALIDATED",
      actionTaken: "RECONCILED",
      factura: reconciled,
      message: "La factura ya fue validada por la DIAN. Datos reconciliados localmente.",
    };
  }

  // Step 2: Unvalidated bill -> Delete in Factus
  if (statusCheck.found && !statusCheck.isValidated && !statusCheck.cufe) {
    await deleteUnvalidatedFactusBill({
      referenceCode: refCode,
      invoiceId: factura?.id,
      tenantId,
    });

    // Record DELETE_UNVALIDATED attempt
    let currentDetalles = factura?.detalles || {};
    if (typeof currentDetalles === "string") {
      try {
        currentDetalles = JSON.parse(currentDetalles);
      } catch {
        currentDetalles = {};
      }
    }

    const updatedDetalles = recordFevAttempt(currentDetalles, {
      operation: FEV_OPERATION.DELETE_UNVALIDATED,
      status: FEV_STAGE.PENDING,
      reference_code: refCode,
      is_validated: false,
      factus_status: "ELIMINADA_PARA_RECREAR",
      error_message: "Factura pendiente no validada eliminada exitosamente en Factus para recreación limpia.",
    });

    if (factura?.id) {
      await supabase
        .from("facturas")
        .update({ detalles: updatedDetalles })
        .eq("id", factura.id);
    }

    return {
      outcome: "DELETED_READY_FOR_RECREATE",
      actionTaken: "DELETED_UNVALIDATED",
      referenceCode: refCode,
      message: "Factura pendiente eliminada de Factus; autorizada para recreación y reemisión limpia.",
    };
  }

  // If not found in Factus, it is already clean
  return {
    outcome: "READY_FOR_RECREATE",
    actionTaken: "VERIFIED_ABSENT",
    referenceCode: refCode,
    message: "Factura no encontrada en Factus; autorizada para emisión.",
  };
};

// ─────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────
const factusRetryService = {
  FEV_STAGE,
  RETRY_DECISION,
  FEV_LOCK_STATE,
  FEV_OPERATION,
  acquireRetryLock,
  releaseRetryLock,
  isRetryInProgress,
  acquireFevBackendLock,
  releaseFevBackendLock,
  getOrGenerateAuthoritativeReferenceCode,
  sanitizeErrorMessage,
  normalizeFactusError,
  getFevRetryDecision,
  recordFevAttempt,
  checkFactusBillStatus,
  reconcileFactusInvoice,
  deleteUnvalidatedFactusBill,
  handle409Conflict,
};

export default factusRetryService;
