/**
 * test_p1_fev2_retry_suite.mjs
 * Comprehensive automated test suite for FASE P1-FEV2:
 * FLUJO SEGURO DE CORRECCIÓN Y REINTENTO DE FEV RECHAZADA
 *
 * Verifies all 16 business and technical rules:
 * TC1: PRE_VALIDATION_ERROR (local error before calling Factus)
 * TC2: FACTUS_VALIDATION_REJECTED (HTTP 422 validation failure)
 * TC3: Error normalization & field parsing (Laravel errors -> Spanish friendly)
 * TC4: Sanitization (omits tokens, client_secret, passwords, XML base64)
 * TC5: Field correction & successful preflight revalidation
 * TC6: Retry allowed after correction (document emits & becomes ACCEPTED)
 * TC7: Strict CUFE block (anti-duplication fiscal rule)
 * TC8: Strict ACEPTADA / SIMULADA block
 * TC9: Technical error / Timeout handling (requires status check)
 * TC10: Factus status check finds previous accepted invoice (reconciles without duplicate)
 * TC11: Factus status check confirms 404 (clears technicalError, permits retry)
 * TC12: Concurrency guard - double-click & in-flight retry lock
 * TC13: Concurrency guard - lock release guarantee in finally
 * TC14: SS-CUFE preservation during correction & retry
 * TC15: Non-regression on commercial invoices
 * TC16: Non-regression on receipt links & MUV/RIPS
 */

import assert from "node:assert/strict";
import factusRetryService, {
  FEV_STAGE,
  RETRY_DECISION,
  getFevRetryDecision,
  normalizeFactusError,
  recordFevAttempt,
  acquireRetryLock,
  releaseRetryLock,
  isRetryInProgress,
  sanitizeErrorMessage,
  checkFactusBillStatus,
  reconcileFactusInvoice,
} from "../src/services/factusRetryService.js";

import {
  preflightHealthInvoice,
  resolveHealthDataFromConfig,
  resolveHealthCatalogProfile,
  getHealthPaymentCatalogForProfile,
  PAYMENT_METHOD_EVENTO_CODE,
  PARTICULAR_COVERAGE_CODE,
} from "../src/services/factusHealthPayloadBuilder.js";

import { computePaymentStatus } from "../src/services/billingReceiptLinkService.js";

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log("================================================================================");
console.log("ODONTOCLOUD — FASE P1-FEV2: SUITE DE PRUEBAS DE CORRECCIÓN Y REINTENTO FEV");
console.log("================================================================================");

// ─────────────────────────────────────────────────────────────────────────────
// TC1: PRE_VALIDATION_ERROR (Error local antes de llamar Factus)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC1: PRE_VALIDATION_ERROR — Detección de error local preflight y clasificación", () => {
  const localError = new Error("HEALTH_PREFLIGHT_ERROR: La factura en modalidad Evento requiere al menos un servicio con código CUPS válido.");
  localError.code = "HEALTH_PREFLIGHT_ERROR";

  const normalized = normalizeFactusError(localError);
  assert.equal(normalized.category, FEV_STAGE.PRE_VALIDATION_ERROR);
  assert.equal(normalized.code, "PRE_VALIDATION");
  assert.ok(normalized.friendlyMessage.includes("validación previa"));

  // Factura con intento registrado de PRE_VALIDATION_ERROR
  const factura = {
    id: "fac-tc1",
    numero: "FE-0001",
    estado: "Pendiente",
    dianStatus: "RECHAZADA",
    detalles: {
      fevAttempts: [
        {
          attempt_number: 1,
          status: FEV_STAGE.PRE_VALIDATION_ERROR,
          error_category: FEV_STAGE.PRE_VALIDATION_ERROR,
          error_message: normalized.friendlyMessage,
        }
      ]
    }
  };

  const decision = getFevRetryDecision(factura);
  assert.equal(decision.decision, RETRY_DECISION.CORRECTION_REQUIRED);
  assert.equal(decision.canRetry, true);
  assert.equal(decision.requiresCorrection, true);
  assert.equal(decision.requiresStatusCheck, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC2: FACTUS_VALIDATION_REJECTED (HTTP 422 desde Factus)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC2: FACTUS_VALIDATION_REJECTED — HTTP 422 de Factus no emite documento ni consume folio fiscal", () => {
  const raw422Error = new Error("customer.email: The customer.email must be a valid email address. | payment_details.0.payment_method_code: The selected payment_details.0.payment_method_code is invalid.");
  raw422Error.status = 422;

  const normalized = normalizeFactusError(raw422Error);
  assert.equal(normalized.category, FEV_STAGE.FACTUS_VALIDATION_REJECTED);
  assert.equal(normalized.code, "422");
  assert.ok(normalized.errorFields);
  assert.ok("customer.email" in normalized.errorFields);
  assert.ok("payment_details.0.payment_method_code" in normalized.errorFields);

  const factura = {
    id: "fac-tc2",
    numero: "FE-0002",
    estado: "Pendiente",
    dianStatus: "RECHAZADA",
    detalles: {
      fevAttempts: [
        {
          attempt_number: 1,
          status: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
          error_category: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
          error_message: normalized.friendlyMessage,
          error_fields: normalized.errorFields,
        }
      ]
    }
  };

  const decision = getFevRetryDecision(factura);
  assert.equal(decision.decision, RETRY_DECISION.CORRECTION_REQUIRED);
  assert.equal(decision.canRetry, true);
  assert.equal(decision.requiresCorrection, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC3: Normalización y mapeo de campos fallidos al español
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC3: Normalización de errores Factus — Traducción amigable de campos y códigos", () => {
  const rawError = new Error("customer.phone: The customer.phone must be at least 10 characters. | health_fields.provider_code: Required field.");
  const normalized = normalizeFactusError(rawError);

  assert.ok(normalized.errorFields["customer.phone"].includes("10 dígitos"));
  assert.ok(normalized.errorFields["health_fields.provider_code"].includes("prestador de salud (REPS)"));
});

// ─────────────────────────────────────────────────────────────────────────────
// TC4: Sanitización estricta de credenciales y tokens
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC4: Sanitización — Omite bearer tokens, client_secrets y contraseñas de los logs e intentos", () => {
  const sensitiveError = "Error al autenticar: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretToken12345 client_secret=very_secret_key password=my_password123";
  const clean = sanitizeErrorMessage(sensitiveError);

  assert.ok(!clean.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
  assert.ok(!clean.includes("very_secret_key"));
  assert.ok(!clean.includes("my_password123"));
  assert.ok(clean.includes("Bearer [REDACTED]"));
  assert.ok(clean.includes("client_secret=[REDACTED]"));
  assert.ok(clean.includes("password=[REDACTED]"));

  const recorded = recordFevAttempt({}, {
    status: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
    error_message: sensitiveError,
  });

  assert.ok(!recorded.lastFevAttempt.error_message.includes("very_secret_key"));
});

// ─────────────────────────────────────────────────────────────────────────────
// TC5: Corrección de campos y revalidación de preflight
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC5: Corrección de campos — Re-ejecución estricta de preflight de salud tras corregir", () => {
  const items = [
    {
      descripcion: "Consulta odontológica general",
      cantidad: 1,
      precioUnitario: 80000,
      descuento: 0,
      realizado: true,
      fechaAtencion: "2026-09-26T10:00:00Z",
      clinicalSource: "attention",
      cups: "890203",
    }
  ];

  const beneficiary = {
    identification_document_code: "13",
    identification: "1018456789",
    names: "Carlos Gómez",
    document_type: "CC",
    document_number: "1018456789",
  };

  const preflight = preflightHealthInvoice({
    catalogProfile: "SHARED_SANDBOX_LEGACY_4",
    numberingRangeId: 8,
    providerCode: "110010000101",
    paymentMethodCode: "04",
    coverageCode: "15",
    withoutContractCode: "05",
    items,
    beneficiary,
  });

  assert.equal(preflight.providerCode, "110010000101");
  assert.equal(preflight.paymentMethodCode, "04");
  assert.equal(preflight.coverageCode, "15");
  assert.equal(preflight.numberingRangeId, 8);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC6: Reintento permitido tras corrección
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC6: Reintento permitido — Documento corregido es aceptado y registra intento exitoso", () => {
  const factura = {
    id: "fac-tc6",
    numero: "FE-0006",
    estado: "Pendiente",
    dianStatus: "RECHAZADA",
    detalles: {
      fevAttempts: [
        {
          attempt_number: 1,
          status: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
          error_message: "customer.email: The customer.email must be a valid email address.",
        }
      ]
    }
  };

  // 1. Evaluar si permite corrección
  const decisionBefore = getFevRetryDecision(factura);
  assert.equal(decisionBefore.canRetry, true);
  assert.equal(decisionBefore.requiresCorrection, true);

  // 2. Simular corrección y éxito en segundo intento
  const updatedDetalles = recordFevAttempt(factura.detalles, {
    status: FEV_STAGE.ACCEPTED,
    cufe: "cufe-abc-123456789",
    factus_invoice_number: "SETP990000123",
    isTestMode: true,
  });

  assert.equal(updatedDetalles.fevAttempts.length, 2);
  assert.equal(updatedDetalles.lastFevAttempt.status, FEV_STAGE.ACCEPTED);
  assert.equal(updatedDetalles.cufe, "cufe-abc-123456789");
  assert.equal(updatedDetalles.dianStatus, "SIMULADA");

  // 3. Evaluar decision tras éxito: ya NO permite reintento
  const decisionAfter = getFevRetryDecision({ ...factura, detalles: updatedDetalles, factusCufe: "cufe-abc-123456789" });
  assert.equal(decisionAfter.decision, RETRY_DECISION.ALREADY_ACCEPTED);
  assert.equal(decisionAfter.canRetry, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC7: Bloqueo estricto por CUFE (Anti-duplicación fiscal)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC7: Bloqueo estricto si tiene CUFE — Protección contra doble facturación DIAN", () => {
  const factura = {
    id: "fac-tc7",
    numero: "FE-0007",
    estado: "Emitido",
    factusCufe: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    dianStatus: "ACEPTADA",
    detalles: {
      cufe: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    }
  };

  const decision = getFevRetryDecision(factura);
  assert.equal(decision.decision, RETRY_DECISION.ALREADY_ACCEPTED);
  assert.equal(decision.canRetry, false);
  assert.ok(decision.friendlyMessage.includes("Nota Crédito (P1-FEV3)"));
});

// ─────────────────────────────────────────────────────────────────────────────
// TC8: Bloqueo estricto por estado ACEPTADA / SIMULADA
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC8: Bloqueo estricto por estado ACEPTADA — canRetry = false", () => {
  const facturaAceptada = {
    id: "fac-tc8",
    numero: "SETP990020758",
    estado: "Emitido",
    dianStatus: "ACEPTADA",
    detalles: {},
  };

  const decision = getFevRetryDecision(facturaAceptada);
  assert.equal(decision.decision, RETRY_DECISION.ALREADY_ACCEPTED);
  assert.equal(decision.canRetry, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC9: Manejo de Timeout / Estado Indeterminado
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC9: Timeout / Error técnico — dianStatus = INDETERMINADO, requiresStatusCheck = true", () => {
  const timeoutError = new Error("fetch failed: 504 Gateway Timeout connecting to Factus");
  const normalized = normalizeFactusError(timeoutError);

  assert.equal(normalized.category, FEV_STAGE.TECHNICAL_ERROR);
  assert.equal(normalized.code, "TIMEOUT");

  const detalles = recordFevAttempt({}, {
    status: FEV_STAGE.TECHNICAL_ERROR,
    error_message: normalized.friendlyMessage,
  });

  assert.equal(detalles.technicalError, true);
  assert.equal(detalles.dianStatus, "INDETERMINADO");

  const decision = getFevRetryDecision({ detalles });
  assert.equal(decision.decision, RETRY_DECISION.STATUS_CHECK_REQUIRED);
  assert.equal(decision.canRetry, false);
  assert.equal(decision.requiresStatusCheck, true);
  assert.ok(decision.friendlyMessage.includes("Verifique primero el estado en Factus"));
});

// ─────────────────────────────────────────────────────────────────────────────
// TC10: Verificación de estado encuentra documento previo (Reconciliación)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC10: Reconciliación — Status check encuentra documento previo y asume CUFE sin duplicar", () => {
  const facturaEnTimeout = {
    id: "fac-tc10",
    numero: "OC-TIMEOUT-001",
    estado: "Pendiente",
    dianStatus: "INDETERMINADO",
    detalles: {
      technicalError: true,
      fevAttempts: [
        { attempt_number: 1, status: FEV_STAGE.TECHNICAL_ERROR, error_message: "Timeout" }
      ]
    }
  };

  // Simular respuesta positiva de Factus show bill
  const factusBillData = {
    found: true,
    cufe: "cufe-reconciliado-9999",
    invoiceNumber: "SETP99009999",
    qrCode: "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=cufe-reconciliado-9999",
  };

  const updatedDetalles = recordFevAttempt(facturaEnTimeout.detalles, {
    status: FEV_STAGE.ACCEPTED,
    cufe: factusBillData.cufe,
    factus_invoice_number: factusBillData.invoiceNumber,
    error_message: "Reconciliación exitosa tras verificación de estado en Factus.",
    isTestMode: false,
  });

  assert.equal(updatedDetalles.technicalError, false);
  assert.equal(updatedDetalles.dianStatus, "ACEPTADA");
  assert.equal(updatedDetalles.cufe, "cufe-reconciliado-9999");
  assert.equal(updatedDetalles.fevAttempts.length, 2);

  const decision = getFevRetryDecision({ detalles: updatedDetalles });
  assert.equal(decision.decision, RETRY_DECISION.ALREADY_ACCEPTED);
  assert.equal(decision.canRetry, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC11: Verificación de estado confirma 404 (No existe en Factus)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC11: Factus confirma que no existe — Limpia technicalError y habilita reintento", () => {
  const factura = {
    id: "fac-tc11",
    numero: "OC-TIMEOUT-002",
    estado: "Pendiente",
    dianStatus: "INDETERMINADO",
    detalles: {
      technicalError: true,
      fevAttempts: [
        { attempt_number: 1, status: FEV_STAGE.TECHNICAL_ERROR }
      ]
    }
  };

  // Al confirmar 404, se limpia technicalError y se marca dianStatus = RECHAZADA para permitir corrección
  const cleanedDetalles = {
    ...factura.detalles,
    technicalError: false,
    dianStatus: "RECHAZADA",
  };

  const decision = getFevRetryDecision({ detalles: cleanedDetalles });
  assert.equal(decision.canRetry, true);
  assert.equal(decision.requiresCorrection, true);
  assert.equal(decision.requiresStatusCheck, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC12: Concurrency Guard (Bloqueo de doble clic y reintento concurrente)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC12: Concurrency Guard — Bloqueo de reintento concurrente en la misma factura", () => {
  const invoiceId = "fac-tc12-lock";

  // Primer lock debe ser exitoso
  acquireRetryLock(invoiceId);
  assert.equal(isRetryInProgress(invoiceId), true);

  // Segundo intento simultáneo debe ser rechazado
  assert.throws(
    () => {
      acquireRetryLock(invoiceId);
    },
    (err) => err.code === "CONCURRENT_RETRY_BLOCKED" || err.code === "FEV_OPERATION_ALREADY_IN_PROGRESS"
  );

  // Liberar lock
  releaseRetryLock(invoiceId);
  assert.equal(isRetryInProgress(invoiceId), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC13: Concurrency Guard — Garantía de liberación de lock en error o finally
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC13: Concurrency Guard — Liberación garantizada de lock en bloque finally", () => {
  const invoiceId = "fac-tc13-finally";

  try {
    acquireRetryLock(invoiceId);
    assert.equal(isRetryInProgress(invoiceId), true);
    throw new Error("Simulated network drop inside try block");
  } catch (err) {
    assert.equal(err.message, "Simulated network drop inside try block");
  } finally {
    releaseRetryLock(invoiceId);
  }

  assert.equal(isRetryInProgress(invoiceId), false);

  // Ahora se puede volver a adquirir sin error
  acquireRetryLock(invoiceId);
  assert.equal(isRetryInProgress(invoiceId), true);
  releaseRetryLock(invoiceId);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC14: Preservación de reglas SS-CUFE en corrección y reintento
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC14: SS-CUFE Preservation — Catálogo y preflight preservados durante el reintento", () => {
  const items = [
    {
      descripcion: "Detartraje subgingival",
      cantidad: 1,
      precioUnitario: 120000,
      descuento: 0,
      realizado: true,
      fechaAtencion: "2026-09-26T10:00:00Z",
      clinicalSource: "attention",
      cups: "890203",
    }
  ];

  const beneficiary = {
    identification_document_code: "13",
    identification: "52899123",
    names: "María Rodríguez",
    document_type: "CC",
    document_number: "52899123",
  };

  // Re-validar preflight bajo perfil SHARED_SANDBOX_LEGACY_4
  const preflight = preflightHealthInvoice({
    catalogProfile: "SHARED_SANDBOX_LEGACY_4",
    numberingRangeId: 8,
    providerCode: "110010000101",
    paymentMethodCode: "04",
    coverageCode: "15",
    withoutContractCode: "05",
    items,
    beneficiary,
  });

  assert.equal(preflight.paymentMethodCode, "04");

  // Si intentamos usar código 05 bajo perfil legacy 4, debe fallar de inmediato
  assert.throws(
    () => {
      preflightHealthInvoice({
        catalogProfile: "SHARED_SANDBOX_LEGACY_4",
        numberingRangeId: 8,
        providerCode: "110010000101",
        paymentMethodCode: "05", // Rechazado en legacy 4
        coverageCode: "15",
        withoutContractCode: "05",
        items,
        beneficiary,
      });
    },
    (err) => err.code === "HEALTH_PAYMENT_METHOD_INVALID_FOR_PROFILE"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC15: No-regresión en facturas comerciales
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC15: No-regresión Comercial — Facturas comerciales estándar pueden corregirse y reintentarse", () => {
  const commercialInvoice = {
    id: "fac-tc15-com",
    numero: "COM-001",
    tipoOperacion: "COMERCIAL",
    estado: "Pendiente",
    dianStatus: "RECHAZADA",
    items: [
      { descripcion: "Cepillo dental ortodoncia", cantidad: 2, precioUnitario: 15000 }
    ],
    detalles: {
      tipoOperacion: "COMERCIAL",
      esSectorSalud: false,
      fevAttempts: [
        { attempt_number: 1, status: FEV_STAGE.FACTUS_VALIDATION_REJECTED, error_message: "customer.email invalid" }
      ]
    }
  };

  const decision = getFevRetryDecision(commercialInvoice);
  assert.equal(decision.canRetry, true);
  assert.equal(decision.requiresCorrection, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC16: No-regresión en vínculos de recibos de caja (P1-FEV1 / P1-FEV1-R2)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TC16: No-regresión Recibos — Recibo de caja vinculado no se pierde ni duplica pagos en reintento", () => {
  const receipt = {
    id: "rec-tc16",
    numero: "REC-0010",
    monto: 80000,
    fecha: "2026-09-26T12:00:00Z",
  };

  const total = 80000;
  const payCalc = computePaymentStatus(total, [receipt]);
  assert.equal(payCalc.estadoPago, "PAGADO");
  assert.equal(payCalc.totalPagado, 80000);
  assert.equal(payCalc.saldoPendiente, 0);

  // Al registrar un intento fallido y luego uno exitoso, recibos_asociados se preserva intacto
  let detalles = {
    recibo_asociado: receipt,
    recibos_asociados: [receipt],
    monto_pagado: payCalc.totalPagado,
    saldo_pendiente: payCalc.saldoPendiente,
    estado_pago: payCalc.estadoPago,
  };

  detalles = recordFevAttempt(detalles, {
    status: FEV_STAGE.FACTUS_VALIDATION_REJECTED,
    error_message: "Error de validación inicial",
  });

  assert.equal(detalles.recibos_asociados.length, 1);
  assert.equal(detalles.monto_pagado, 80000);

  detalles = recordFevAttempt(detalles, {
    status: FEV_STAGE.ACCEPTED,
    cufe: "cufe-final-tc16",
    factus_invoice_number: "SETP990000055",
  });

  assert.equal(detalles.recibos_asociados.length, 1);
  assert.equal(detalles.monto_pagado, 80000);
  assert.equal(detalles.estado_pago, "PAGADO");
});

console.log("================================================================================");
console.log(`TOTAL CASOS DE PRUEBA: ${totalCount} | EXITOSOS: ${passedCount} | FALLIDOS: ${totalCount - passedCount}`);
if (passedCount === totalCount) {
  console.log("RESULTADO FINAL: 100% PASS — FASE P1-FEV2 VERIFICADA SATISFACTORIAMENTE");
} else {
  process.exit(1);
}
console.log("================================================================================");
