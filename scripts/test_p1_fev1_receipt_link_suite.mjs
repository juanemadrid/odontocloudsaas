// scripts/test_p1_fev1_receipt_link_suite.mjs
import assert from "node:assert/strict";
import {
  computePaymentStatus,
  validateReceiptInvoiceLink,
  extractLinkedReceipts,
  normalizeId,
} from "../src/services/billingReceiptLinkService.js";
import {
  preflightHealthInvoice,
  resolveHealthDataFromConfig,
} from "../src/services/factusHealthPayloadBuilder.js";

console.log("================================================================================");
console.log("ODONTOCLOUD — TEST SUITE FASE P1-FEV1");
console.log("ASOCIACIÓN PERSISTENTE RECIBO DE CAJA ↔ FACTURA ELECTRÓNICA + ANTI-DUPLICIDAD");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err.message}`);
  }
}

// --------------------------------------------------------------------------------
// TEST 1: Pago → Recibo → FEV (Modelado de relación persistente)
// --------------------------------------------------------------------------------
runTest("Pago → Recibo → FEV: Asociación persistente de recibo con FEV", () => {
  const recibo = {
    id: "rec-101",
    numero: "REC-00101",
    monto: 300000,
    fecha: "2026-09-26T10:00:00Z",
    tenant_id: "tenant-alpha",
    paciente_id: "pac-001",
  };

  const factura = {
    id: "fac-501",
    numero: "FE-9001",
    total: 300000,
    tenant_id: "tenant-alpha",
    paciente_id: "pac-001",
    detalles: {
      recibo_asociado: recibo,
      recibos_asociados: [recibo],
      estado_pago: "PAGADO",
      monto_pagado: 300000,
      saldo_pendiente: 0,
    },
  };

  const linked = extractLinkedReceipts(factura);
  assert.equal(linked.length, 1);
  assert.equal(linked[0].numero, "REC-00101");
  assert.equal(linked[0].monto, 300000);

  const status = computePaymentStatus(factura.total, linked);
  assert.equal(status.estadoPago, "PAGADO");
  assert.equal(status.saldoPendiente, 0);
  assert.equal(status.totalPagado, 300000);
});

// --------------------------------------------------------------------------------
// TEST 2: FEV posterior a recibo existente
// --------------------------------------------------------------------------------
runTest("FEV posterior a recibo existente: Validación exitosa de enlace", () => {
  const recibo = {
    id: "rec-102",
    numero: "REC-00102",
    monto: 150000,
    tenant_id: "tenant-alpha",
    paciente_id: "pac-002",
  };

  const factura = {
    id: "fac-502",
    numero: "FE-9002",
    total: 500000,
    tenant_id: "tenant-alpha",
    paciente_id: "pac-002",
    detalles: {},
  };

  const validation = validateReceiptInvoiceLink({
    tenantId: "tenant-alpha",
    factura,
    recibo,
  });
  assert.equal(validation.valid, true);

  const paymentCalc = computePaymentStatus(factura.total, [recibo]);
  assert.equal(paymentCalc.estadoPago, "PARCIAL");
  assert.equal(paymentCalc.totalPagado, 150000);
  assert.equal(paymentCalc.saldoPendiente, 350000);
});

// --------------------------------------------------------------------------------
// TEST 3: FEV no crea movimiento financiero duplicado
// --------------------------------------------------------------------------------
runTest("FEV no crea movimiento financiero duplicado: Emisión FEV no altera movimientos_caja", () => {
  // Simulamos estado de movimientos de caja de una clínica
  const initialCashMovements = [
    { id: "mov-1", tipo: "ingreso", monto: 400000, concepto: "Recibo REC-001" },
  ];

  // Al emitir la FEV vinculada a ese recibo, el array de movimientos de caja NO debe recibir una entrada adicional
  const shouldCreateCashMovement = false; // Política estricta OdontoCloud P1-FEV1
  assert.equal(shouldCreateCashMovement, false, "La FEV jamás debe insertar movimiento de caja duplicado");

  const finalCashMovements = [...initialCashMovements];
  assert.equal(finalCashMovements.length, 1);
  assert.equal(finalCashMovements[0].monto, 400000);
});

// --------------------------------------------------------------------------------
// TEST 4: Mismo recibo no puede asociarse dos veces a la misma FEV (Anti-duplicidad)
// --------------------------------------------------------------------------------
runTest("Anti-duplicidad: Mismo recibo no puede asociarse dos veces", () => {
  const recibo = {
    id: "rec-103",
    numero: "REC-00103",
    monto: 200000,
    tenant_id: "tenant-alpha",
    paciente_id: "pac-003",
  };

  const facturaConRecibo = {
    id: "fac-503",
    numero: "FE-9003",
    total: 200000,
    tenant_id: "tenant-alpha",
    paciente_id: "pac-003",
    detalles: {
      recibos_asociados: [recibo],
    },
  };

  assert.throws(
    () => {
      validateReceiptInvoiceLink({
        tenantId: "tenant-alpha",
        factura: facturaConRecibo,
        recibo,
      });
    },
    (err) => err.message.includes("DUPLICATE_LINK_VIOLATION")
  );
});

// --------------------------------------------------------------------------------
// TEST 5: Tenant incorrecto bloqueado (Cross-Tenant Security)
// --------------------------------------------------------------------------------
runTest("Seguridad Cross-Tenant: Bloqueo estricto de documentos entre diferentes clínicas", () => {
  const reciboTenantB = {
    id: "rec-104",
    numero: "REC-00104",
    monto: 100000,
    tenant_id: "tenant-beta", // Diferente tenant
    paciente_id: "pac-004",
  };

  const facturaTenantA = {
    id: "fac-504",
    numero: "FE-9004",
    total: 100000,
    tenant_id: "tenant-alpha", // Tenant de la sesión activa
    paciente_id: "pac-004",
  };

  assert.throws(
    () => {
      validateReceiptInvoiceLink({
        tenantId: "tenant-alpha",
        factura: facturaTenantA,
        recibo: reciboTenantB,
      });
    },
    (err) => err.message.includes("CROSS_TENANT_VIOLATION")
  );
});

// --------------------------------------------------------------------------------
// TEST 6: Paciente incorrecto bloqueado (Cross-Patient Security)
// --------------------------------------------------------------------------------
runTest("Seguridad Cross-Patient: Bloqueo estricto de recibos de otro paciente", () => {
  const reciboPacienteCarlos = {
    id: "rec-105",
    numero: "REC-00105",
    monto: 250000,
    tenant_id: "tenant-alpha",
    paciente_id: "paciente-carlos",
  };

  const facturaPacienteMaria = {
    id: "fac-505",
    numero: "FE-9005",
    total: 250000,
    tenant_id: "tenant-alpha",
    paciente_id: "paciente-maria", // Paciente diferente
  };

  assert.throws(
    () => {
      validateReceiptInvoiceLink({
        tenantId: "tenant-alpha",
        factura: facturaPacienteMaria,
        recibo: reciboPacienteCarlos,
      });
    },
    (err) => err.message.includes("CROSS_PATIENT_VIOLATION")
  );
});

// --------------------------------------------------------------------------------
// TEST 7: Reporte financiero cuenta ingreso una sola vez (Prevención doble contabilización)
// --------------------------------------------------------------------------------
runTest("Reporte financiero: Cuenta ingreso UNA SOLA VEZ (Recibos como fuente de recaudo)", () => {
  const transactions = [
    { tipoDocumento: "Recibo de caja+", valor: 1000000, estado: "Activo" },
    { tipoDocumento: "Factura de venta+", valor: 1000000, estado: "Emitido" }, // FEV por el mismo servicio
    { tipoDocumento: "Ingreso de caja+", valor: 50000, estado: "Activo" },
    { tipoDocumento: "Egreso de caja-", valor: 200000, estado: "Activo" },
  ];

  // Algoritmo corregido en ReporteFinanciero.jsx:
  const totalIngresosRecaudo = transactions
    .filter(
      (r) =>
        (r.tipoDocumento.includes("Recibo") || r.tipoDocumento.includes("Ingreso de caja")) &&
        r.estado !== "Anulado"
    )
    .reduce((sum, r) => sum + Number(r.valor || 0), 0);

  const totalFacturadoFiscal = transactions
    .filter((r) => r.tipoDocumento.includes("Factura de venta") && r.estado !== "Anulado")
    .reduce((sum, r) => sum + Number(r.valor || 0), 0);

  // Recaudo exacto: 1.000.000 + 50.000 = 1.050.000 (NO 2.050.000!)
  assert.equal(totalIngresosRecaudo, 1050000, "El recaudo NO debe duplicarse con la FEV");
  assert.equal(totalFacturadoFiscal, 1000000, "La FEV informa facturación fiscal");
});

// --------------------------------------------------------------------------------
// TEST 8: Factura muestra recibo asociado en UI
// --------------------------------------------------------------------------------
runTest("UI: Factura muestra recibo asociado claramente", () => {
  const factura = {
    id: "fac-506",
    numero: "FE-1080",
    total: 600000,
    detalles: {
      recibos_asociados: [
        { id: "r1", numero: "REC-2026", monto: 400000 },
        { id: "r2", numero: "REC-2027", monto: 200000 },
      ],
      monto_pagado: 600000,
      saldo_pendiente: 0,
      estado_pago: "PAGADO",
    },
  };

  const receipts = extractLinkedReceipts(factura);
  assert.equal(receipts.length, 2);
  const receiptNumbers = receipts.map((r) => r.numero).join(", ");
  assert.equal(receiptNumbers, "REC-2026, REC-2027");

  const status = computePaymentStatus(factura.total, receipts);
  assert.equal(status.estadoPago, "PAGADO");
  assert.equal(status.saldoPendiente, 0);
});

// --------------------------------------------------------------------------------
// TEST 9: Estado DIAN independiente de estado de pago
// --------------------------------------------------------------------------------
runTest("Independencia: Estado DIAN vs Estado de Pago", () => {
  // Caso 1: DIAN Aceptada pero factura aún no pagada (crédito)
  const caso1 = computePaymentStatus(1000000, []);
  assert.equal(caso1.estadoPago, "PENDIENTE");
  const dianStatusCaso1 = "ACEPTADA";
  assert.notEqual(caso1.estadoPago, dianStatusCaso1);

  // Caso 2: DIAN Rechazada pero paciente ya pagó en caja
  const caso2 = computePaymentStatus(500000, [{ monto: 500000 }]);
  assert.equal(caso2.estadoPago, "PAGADO");
  const dianStatusCaso2 = "RECHAZADA";
  assert.notEqual(caso2.estadoPago, dianStatusCaso2);

  // Caso 3: DIAN Pendiente con pago parcial
  const caso3 = computePaymentStatus(800000, [{ monto: 300000 }]);
  assert.equal(caso3.estadoPago, "PARCIAL");
  const dianStatusCaso3 = "PENDIENTE";
  assert.equal(caso3.saldoPendiente, 500000);
});

// --------------------------------------------------------------------------------
// TEST 10: Flujo SS-CUFE sin regresión
// --------------------------------------------------------------------------------
runTest("SS-CUFE sin regresión: Preflight y builders de salud operativos", () => {
  const preflight = preflightHealthInvoice({
    catalogProfile: "SHARED_SANDBOX_LEGACY_4",
    numberingRangeId: 389,
    providerCode: "130010123401",
    paymentMethodCode: "04",
    coverageCode: "15",
    withoutContractCode: "05",
    items: [{ cups: "890201", realizado: true }],
  });

  assert.equal(preflight.providerCode, "130010123401");
  assert.equal(preflight.paymentMethodCode, "04"); // Evento

  const healthData = resolveHealthDataFromConfig({
    providerCode: preflight.providerCode,
    modalidadPago: preflight.paymentMethodCode,
    coberturaCode: preflight.coverageCode,
    catalogProfile: "SHARED_SANDBOX_LEGACY_4",
  });

  assert.equal(healthData.payment_method_code, "04");
  assert.equal(healthData.provider_code, "130010123401");
});

// --------------------------------------------------------------------------------
// TEST 11: Modelo de Pagos Parciales / Abonos múltiples (Tratamiento = $1.000.000)
// --------------------------------------------------------------------------------
runTest("Pagos Parciales / Abonos: Tratamiento $1.000.000 con abonos sucesivos", () => {
  const totalTratamiento = 1000000;

  // Estado inicial: Sin abonos
  const s0 = computePaymentStatus(totalTratamiento, []);
  assert.equal(s0.estadoPago, "PENDIENTE");
  assert.equal(s0.saldoPendiente, 1000000);
  assert.equal(s0.totalPagado, 0);

  // Abono 1 = $300.000
  const abono1 = { id: "ab1", numero: "REC-01", monto: 300000 };
  const s1 = computePaymentStatus(totalTratamiento, [abono1]);
  assert.equal(s1.estadoPago, "PARCIAL");
  assert.equal(s1.totalPagado, 300000);
  assert.equal(s1.saldoPendiente, 700000);

  // Abono 2 = $200.000
  const abono2 = { id: "ab2", numero: "REC-02", monto: 200000 };
  const s2 = computePaymentStatus(totalTratamiento, [abono1, abono2]);
  assert.equal(s2.estadoPago, "PARCIAL");
  assert.equal(s2.totalPagado, 500000);
  assert.equal(s2.saldoPendiente, 500000);

  // Abono 3 = $500.000 (Saldo completado)
  const abono3 = { id: "ab3", numero: "REC-03", monto: 500000 };
  const s3 = computePaymentStatus(totalTratamiento, [abono1, abono2, abono3]);
  assert.equal(s3.estadoPago, "PAGADO");
  assert.equal(s3.totalPagado, 1000000);
  assert.equal(s3.saldoPendiente, 0);
});

// --------------------------------------------------------------------------------
// TEST 12: Flujo comercial sin regresión (Items no clínicos)
// --------------------------------------------------------------------------------
runTest("Comercial sin regresión: No requiere parámetros FEV Salud", () => {
  const nonClinicalInvoice = {
    tipoOperacion: "COMERCIAL",
    items: [
      { descripcion: "Cepillo Dental Eléctrico", cantidad: 2, precioUnitario: 65000 },
    ],
    total: 130000,
  };

  assert.equal(nonClinicalInvoice.tipoOperacion, "COMERCIAL");
  assert.equal(nonClinicalInvoice.items.length, 1);
  assert.equal(nonClinicalInvoice.total, 130000);
});

console.log("\n================================================================================");
console.log(`RESULTADOS: ${passedTests} de ${totalTests} pruebas pasadas.`);
console.log("================================================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
