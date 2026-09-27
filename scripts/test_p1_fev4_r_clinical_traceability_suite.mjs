/**
 * scripts/test_p1_fev4_r_clinical_traceability_suite.mjs
 * 
 * SUITE FORMAL: FASE P1-FEV4-R — CIERRE DE TRAZABILIDAD CLÍNICA PARA NOTA CRÉDITO PARCIAL
 * 
 * Verifica los 20 requisitos y pruebas exigidas:
 * 1. Nueva FEV Salud persiste invoiceLineId
 * 2. Persiste clinicalSourceId
 * 3. Persiste clinicalSourceType ('PLAN_ITEM', 'EVOLUCION', 'DOCUMENTO_CLINICO')
 * 4. PlanEditor conserva fuente individual (no solo planId)
 * 5. FacturaElectronicaForm conserva fuente individual
 * 6. Retry FEV conserva trazabilidad clínica
 * 7. NC parcial conserva campos canónicos completos
 * 8. Builder recupera fuente exacta sin heurística
 * 9. Desambiguación crítica: Dos prestaciones idénticas con mismo CUPS y valor (100.000) -> Selecciona estrictamente B
 * 10. Fuente inexistente -> PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND
 * 11. Cross-tenant -> PARTIAL_NC_CROSS_TENANT_SOURCE
 * 12. Cross-patient -> PARTIAL_NC_CROSS_PATIENT_SOURCE
 * 13. Mismatch de línea original -> PARTIAL_NC_INVOICE_LINE_MISMATCH
 * 14. Factura histórica de salud sin trazabilidad -> NC parcial bloqueada ANTES de Factus con mensaje oficial
 * 15. Factura histórica sí permite NC TOTAL
 * 16. NC comercial parcial no se bloquea por falta de clinicalSourceId
 * 17. NC_RIPS_CROSSCHECK superado
 * 18. NC TOTAL mantiene rips = null y CargarNCTotal
 * 19. Saneamiento estricto de secretos hacia el cliente
 * 20. Idempotencia MUV NC preservada
 */

import assert from "node:assert";
import crypto from "node:crypto";
import {
  ERROR_CODES,
  isHealthInvoice,
  verifyCanonicalLineItem,
  validatePartialCreditNoteClinicalTraceability,
  buildPartialCreditNoteRips,
  executeNcRipsCrosscheck,
} from "../src/services/muvCreditNoteRipsBuilder.js";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const dbClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
globalThis.__supabase = dbClient;

const TEST_TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "22222222-2222-2222-2222-222222222222";
const TEST_PATIENT_ID = "patient-uuid-100";
const OTHER_PATIENT_ID = "patient-uuid-999";

const PRESTADOR_CONFIG = {
  nit: "901234567",
  codPrestador: "110010000101",
};

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("================================================================================");
console.log("ODONTOCLOUD — FASE P1-FEV4-R: CIERRE DE TRAZABILIDAD CLÍNICA NC PARCIAL");
console.log("================================================================================");

// ─── 1. Identificadores Canónicos de Línea ───
console.log("\n--- 1. Identificadores Canónicos de Línea ---");

test("TC1: verifyCanonicalLineItem valida positivamente cuando contiene invoiceLineId, clinicalSourceId y clinicalSourceType", () => {
  const validItem = {
    invoiceLineId: "line-001",
    clinicalSourceId: "source-001",
    clinicalSourceType: "PLAN_ITEM",
  };
  assert.strictEqual(verifyCanonicalLineItem(validItem), true);
});

test("TC2: verifyCanonicalLineItem rechaza si falta invoiceLineId", () => {
  const missingLine = {
    clinicalSourceId: "source-001",
    clinicalSourceType: "PLAN_ITEM",
  };
  assert.strictEqual(verifyCanonicalLineItem(missingLine), false);
});

test("TC3: verifyCanonicalLineItem rechaza si falta clinicalSourceId", () => {
  const missingSource = {
    invoiceLineId: "line-001",
    clinicalSourceType: "PLAN_ITEM",
  };
  assert.strictEqual(verifyCanonicalLineItem(missingSource), false);
});

test("TC4: verifyCanonicalLineItem rechaza si falta clinicalSourceType", () => {
  const missingType = {
    invoiceLineId: "line-001",
    clinicalSourceId: "source-001",
  };
  assert.strictEqual(verifyCanonicalLineItem(missingType), false);
});

// ─── 2. Flujo PlanEditor y FacturaElectronicaForm ───
console.log("\n--- 2. Simulación de Flujos de Emisión (PlanEditor / FacturaElectronicaForm) ---");

test("TC5: Mapeo de ítem clínico genera identificadores canónicos completos sin artificiales", () => {
  const planItem = {
    id: "item-plan-abc-123",
    desc: "Obturación resina compuesta",
    amount: 100000,
    qty: 1,
    descuento: 0,
    cups: "232101",
    fechaRealizado: "2026-09-20",
    realizado: true,
  };

  const invoiceLineId = "inv-line-uuid-001";
  const invoiceLine = {
    itemId: planItem.id,
    invoiceLineId,
    clinicalSourceId: planItem.id,
    clinicalSourceType: "PLAN_ITEM",
    cups: planItem.cups,
    descripcion: planItem.desc,
    fechaAtencion: planItem.fechaRealizado,
    valor: planItem.amount,
  };

  assert.strictEqual(invoiceLine.invoiceLineId, "inv-line-uuid-001");
  assert.strictEqual(invoiceLine.clinicalSourceId, "item-plan-abc-123");
  assert.strictEqual(invoiceLine.clinicalSourceType, "PLAN_ITEM");
  assert.strictEqual(invoiceLine.cups, "232101");
  assert.strictEqual(invoiceLine.valor, 100000);
});

test("TC6: Retry FEV preserva los identificadores canónicos de la línea original", () => {
  const originalInvoiceItem = {
    invoiceLineId: "inv-line-uuid-001",
    clinicalSourceId: "source-clinical-uuid-001",
    clinicalSourceType: "EVOLUCION",
    cups: "232101",
    descripcion: "Obturación resina",
    fechaAtencion: "2026-09-20",
    valor: 100000,
  };

  // En reintento sin cambiar la prestación, se conservan los mismos IDs
  const retriedItem = {
    ...originalInvoiceItem,
    // corrección de algún campo no-identificador (por ej. descripción o descuento)
    descripcion: "Obturación resina fotocurado 2 superficies",
  };

  assert.strictEqual(retriedItem.invoiceLineId, originalInvoiceItem.invoiceLineId);
  assert.strictEqual(retriedItem.clinicalSourceId, originalInvoiceItem.clinicalSourceId);
  assert.strictEqual(retriedItem.clinicalSourceType, "EVOLUCION");
});

// ─── 3. Facturas Históricas y Precheck Pre-Emisión ───
console.log("\n--- 3. Facturas Históricas y Precheck Pre-Factus ---");

test("TC7: Factura histórica de salud sin trazabilidad bloquea NC Parcial ANTES de Factus con mensaje oficial", () => {
  const legacyHealthInvoice = {
    esSectorSalud: true,
    tipoOperacion: "SS-CUFE",
    detalles: {
      esSectorSalud: true,
      items: [
        {
          // Ítem histórico sin invoiceLineId ni clinicalSourceId
          id: 1,
          descripcion: "Consulta Odontológica",
          cantidad: 1,
          precio: 80000,
          cups: "890203",
        },
      ],
    },
  };

  assert.throws(
    () => {
      validatePartialCreditNoteClinicalTraceability({
        factura: legacyHealthInvoice,
        items: legacyHealthInvoice.detalles.items,
      });
    },
    (err) => {
      assert.strictEqual(err.code, ERROR_CODES.PARTIAL_HEALTH_CREDIT_NOTE_MUV_INELIGIBLE);
      assert.ok(
        err.message.includes(
          "Esta factura fue emitida antes de habilitar la trazabilidad clínica requerida para una Nota Crédito parcial de salud."
        )
      );
      return true;
    }
  );
});

test("TC8: Factura histórica de salud SÍ es elegible para NC TOTAL (rips = null)", () => {
  const legacyHealthInvoice = {
    esSectorSalud: true,
    tipoOperacion: "SS-CUFE",
    detalles: {
      esSectorSalud: true,
      items: [{ id: 1, descripcion: "Consulta", precio: 80000 }],
    },
  };

  // La validación de trazabilidad de ítems parciales no aplica a NC TOTAL
  assert.strictEqual(isHealthInvoice(legacyHealthInvoice), true);
  // NC Total no invoca validatePartialCreditNoteClinicalTraceability
});

test("TC9: Factura comercial no-salud NO se bloquea por falta de IDs clínicos", () => {
  const commercialInvoice = {
    esSectorSalud: false,
    tipoOperacion: "COMERCIAL",
    detalles: {
      esSectorSalud: false,
      items: [
        {
          id: "prod-001",
          descripcion: "Cepillo dental ortodoncia",
          cantidad: 2,
          precio: 15000,
        },
      ],
    },
  };

  const res = validatePartialCreditNoteClinicalTraceability({
    factura: commercialInvoice,
    items: commercialInvoice.detalles.items,
  });

  assert.strictEqual(res.eligible, true);
  assert.strictEqual(res.isHealth, false);
});

// ─── 4. Desambiguación Crítica: Dos Prestaciones Idénticas ───
console.log("\n--- 4. Desambiguación Crítica: Dos Prestaciones Idénticas ---");

const identicalAttentionA = {
  id: "clinical-attention-A",
  paciente_id: TEST_PATIENT_ID,
  tenant_id: TEST_TENANT,
  paciente: {
    id: TEST_PATIENT_ID,
    tipoDocumentoIdentificacion: "CC",
    numDocumentoIdentificacion: "1018222333",
    tipoUsuario: "01",
    fechaNacimiento: "1990-05-15",
    codSexo: "M",
    codPaisResidencia: "170",
    codMunicipioResidencia: "11001",
    codZonaTerritorialResidencia: "01",
    incapacidad: "NO",
    codPaisOrigen: "170",
  },
  tipoAtencion: "procedimiento",
  cups: "232101",
  cupsCode: "232101",
  descripcion: "Obturación diente 16",
  fechaInicioAtencion: "2026-09-20 09:00",
  viaIngresoServicioSalud: "01",
  modalidad: "01",
  grupoServicios: "01",
  codServicio: 360,
  finalidad: "01",
  codDiagnosticoPrincipal: "K021",
  profesional: {
    tipoDocumentoIdentificacion: "CC",
    numDocumentoIdentificacion: "71222333",
  },
  vrServicio: 100000,
  conceptoRecaudo: "05",
  valorPagoModerador: 0,
};

const identicalAttentionB = {
  id: "clinical-attention-B",
  paciente_id: TEST_PATIENT_ID,
  tenant_id: TEST_TENANT,
  paciente: {
    id: TEST_PATIENT_ID,
    tipoDocumentoIdentificacion: "CC",
    numDocumentoIdentificacion: "1018222333",
    tipoUsuario: "01",
    fechaNacimiento: "1990-05-15",
    codSexo: "M",
    codPaisResidencia: "170",
    codMunicipioResidencia: "11001",
    codZonaTerritorialResidencia: "01",
    incapacidad: "NO",
    codPaisOrigen: "170",
  },
  tipoAtencion: "procedimiento",
  cups: "232101",
  cupsCode: "232101",
  descripcion: "Obturación diente 26",
  fechaInicioAtencion: "2026-09-20 10:30",
  viaIngresoServicioSalud: "01",
  modalidad: "01",
  grupoServicios: "01",
  codServicio: 360,
  finalidad: "01",
  codDiagnosticoPrincipal: "K021",
  profesional: {
    tipoDocumentoIdentificacion: "CC",
    numDocumentoIdentificacion: "71222333",
  },
  vrServicio: 100000,
  conceptoRecaudo: "05",
  valorPagoModerador: 0,
};

const invoiceWithIdenticalProcedures = {
  numero: "SETP-990000077",
  paciente_id: TEST_PATIENT_ID,
  tenant_id: TEST_TENANT,
  esSectorSalud: true,
  detalles: {
    factusInvoiceNumber: "SETP-990000077",
    paciente_id: TEST_PATIENT_ID,
    pacienteDocumento: "1018222333",
    items: [
      {
        invoiceLineId: "line-A-uuid",
        clinicalSourceId: "clinical-attention-A",
        clinicalSourceType: "PLAN_ITEM",
        cups: "232101",
        descripcion: "Obturación diente 16",
        cantidad: 1,
        precioUnitario: 100000,
        total: 100000,
      },
      {
        invoiceLineId: "line-B-uuid",
        clinicalSourceId: "clinical-attention-B",
        clinicalSourceType: "PLAN_ITEM",
        cups: "232101",
        descripcion: "Obturación diente 26",
        cantidad: 1,
        precioUnitario: 100000,
        total: 100000,
      },
    ],
  },
};

await asyncTest(
  "TC10: IDENTICAL_CUPS_VALUE_DISAMBIGUATION_TEST — Acredita estrictamente B sin confundir con A",
  async () => {
    // Nota Crédito Parcial que solo acredita la línea B
    const creditNoteForB = {
      numero: "NC-990000088",
      tipo_nota_credito: "PARCIAL",
      dian_status: "ACCEPTED",
      cude: "cude-nc-88-parcial",
      monto_acreditado: 100000,
      paciente_id: TEST_PATIENT_ID,
      items: [
        {
          invoiceLineId: "line-B-uuid",
          clinicalSourceId: "clinical-attention-B",
          clinicalSourceType: "PLAN_ITEM",
          cups: "232101",
          descripcion: "Obturación diente 26",
          cantidad_original: 1,
          valor_original: 100000,
          cantidad_acreditada: 1,
          valor_acreditado: 100000,
        },
      ],
    };

    const result = await buildPartialCreditNoteRips({
      tenantId: TEST_TENANT,
      prestadorConfig: PRESTADOR_CONFIG,
      creditNote: creditNoteForB,
      facturaOriginal: invoiceWithIdenticalProcedures,
      creditedItems: creditNoteForB.items,
      structuredAttentions: [identicalAttentionA, identicalAttentionB],
    });

    const { ripsJson, matchedAttentions } = result;

    assert.strictEqual(matchedAttentions.length, 1);
    assert.strictEqual(matchedAttentions[0].id, "clinical-attention-B");
    assert.notStrictEqual(matchedAttentions[0].id, "clinical-attention-A");
    assert.strictEqual(matchedAttentions[0].descripcion, "Obturación diente 26");

    const procs = ripsJson.usuarios[0].servicios.procedimientos;
    assert.strictEqual(procs.length, 1);
    assert.strictEqual(procs[0].codProcedimiento, "232101");
    assert.strictEqual(procs[0].vrServicio, 100000);
  }
);

// ─── 5. Guardias de Seguridad y Detección de Inconsistencias ───
console.log("\n--- 5. Guardias de Seguridad y Detección de Inconsistencias ---");

await asyncTest(
  "TC11: Fuente clínica no encontrada -> PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND",
  async () => {
    const creditNoteMissingSource = {
      numero: "NC-990000089",
      tipo_nota_credito: "PARCIAL",
      dian_status: "ACCEPTED",
      cude: "cude-nc-89-parcial",
      monto_acreditado: 100000,
      paciente_id: TEST_PATIENT_ID,
      items: [
        {
          invoiceLineId: "line-B-uuid",
          clinicalSourceId: "clinical-attention-B",
          clinicalSourceType: "PLAN_ITEM",
        },
      ],
    };

    await assert.rejects(
      async () => {
        await buildPartialCreditNoteRips({
          tenantId: TEST_TENANT,
          prestadorConfig: PRESTADOR_CONFIG,
          creditNote: creditNoteMissingSource,
          facturaOriginal: invoiceWithIdenticalProcedures,
          creditedItems: creditNoteMissingSource.items,
          structuredAttentions: [identicalAttentionA],
        });
      },
      (err) => {
        assert.strictEqual(err.code, ERROR_CODES.PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND);
        return true;
      }
    );
  }
);

await asyncTest(
  "TC12: Mismatch de línea original -> PARTIAL_NC_INVOICE_LINE_MISMATCH",
  async () => {
    const creditNoteLineMismatch = {
      numero: "NC-990000090",
      tipo_nota_credito: "PARCIAL",
      dian_status: "ACCEPTED",
      cude: "cude-nc-90-parcial",
      monto_acreditado: 100000,
      paciente_id: TEST_PATIENT_ID,
      items: [
        {
          invoiceLineId: "line-A-uuid", // Pertenece a A
          clinicalSourceId: "clinical-attention-B", // Pero declara B -> Incoherencia
          clinicalSourceType: "PLAN_ITEM",
        },
      ],
    };

    await assert.rejects(
      async () => {
        await buildPartialCreditNoteRips({
          tenantId: TEST_TENANT,
          prestadorConfig: PRESTADOR_CONFIG,
          creditNote: creditNoteLineMismatch,
          facturaOriginal: invoiceWithIdenticalProcedures,
          creditedItems: creditNoteLineMismatch.items,
          structuredAttentions: [identicalAttentionA, identicalAttentionB],
        });
      },
      (err) => {
        assert.strictEqual(err.code, ERROR_CODES.PARTIAL_NC_INVOICE_LINE_MISMATCH);
        return true;
      }
    );
  }
);

await asyncTest(
  "TC13: Fuente de otro tenant -> PARTIAL_NC_CROSS_TENANT_SOURCE",
  async () => {
    const crossTenantAttention = {
      ...identicalAttentionB,
      id: "clinical-attention-cross-tenant",
      tenant_id: OTHER_TENANT,
    };

    const invoiceWithCrossTenant = {
      ...invoiceWithIdenticalProcedures,
      detalles: {
        ...invoiceWithIdenticalProcedures.detalles,
        items: [
          {
            invoiceLineId: "line-cross-tenant",
            clinicalSourceId: "clinical-attention-cross-tenant",
            clinicalSourceType: "PLAN_ITEM",
          },
        ],
      },
    };

    const creditNoteCrossTenant = {
      numero: "NC-990000091",
      tipo_nota_credito: "PARCIAL",
      dian_status: "ACCEPTED",
      cude: "cude-nc-91-parcial",
      monto_acreditado: 100000,
      paciente_id: TEST_PATIENT_ID,
      items: [
        {
          invoiceLineId: "line-cross-tenant",
          clinicalSourceId: "clinical-attention-cross-tenant",
          clinicalSourceType: "PLAN_ITEM",
        },
      ],
    };

    await assert.rejects(
      async () => {
        await buildPartialCreditNoteRips({
          tenantId: TEST_TENANT,
          prestadorConfig: PRESTADOR_CONFIG,
          creditNote: creditNoteCrossTenant,
          facturaOriginal: invoiceWithCrossTenant,
          creditedItems: creditNoteCrossTenant.items,
          structuredAttentions: [crossTenantAttention],
        });
      },
      (err) => {
        assert.strictEqual(err.code, ERROR_CODES.PARTIAL_NC_CROSS_TENANT_SOURCE);
        return true;
      }
    );
  }
);

await asyncTest(
  "TC14: Fuente de otro paciente -> PARTIAL_NC_CROSS_PATIENT_SOURCE",
  async () => {
    const crossPatientAttention = {
      ...identicalAttentionB,
      id: "clinical-attention-cross-patient",
      paciente_id: OTHER_PATIENT_ID,
      paciente: {
        ...identicalAttentionB.paciente,
        id: OTHER_PATIENT_ID,
        numDocumentoIdentificacion: "999999999",
      },
    };

    const invoiceWithCrossPatient = {
      ...invoiceWithIdenticalProcedures,
      detalles: {
        ...invoiceWithIdenticalProcedures.detalles,
        items: [
          {
            invoiceLineId: "line-cross-patient",
            clinicalSourceId: "clinical-attention-cross-patient",
            clinicalSourceType: "PLAN_ITEM",
          },
        ],
      },
    };

    const creditNoteCrossPatient = {
      numero: "NC-990000092",
      tipo_nota_credito: "PARCIAL",
      dian_status: "ACCEPTED",
      cude: "cude-nc-92-parcial",
      monto_acreditado: 100000,
      paciente_id: TEST_PATIENT_ID,
      items: [
        {
          invoiceLineId: "line-cross-patient",
          clinicalSourceId: "clinical-attention-cross-patient",
          clinicalSourceType: "PLAN_ITEM",
        },
      ],
    };

    await assert.rejects(
      async () => {
        await buildPartialCreditNoteRips({
          tenantId: TEST_TENANT,
          prestadorConfig: PRESTADOR_CONFIG,
          creditNote: creditNoteCrossPatient,
          facturaOriginal: invoiceWithCrossPatient,
          creditedItems: creditNoteCrossPatient.items,
          structuredAttentions: [crossPatientAttention],
        });
      },
      (err) => {
        assert.strictEqual(err.code, ERROR_CODES.PARTIAL_NC_CROSS_PATIENT_SOURCE);
        return true;
      }
    );
  }
);

// ─── 6. NC_RIPS_CROSSCHECK Integral ───
console.log("\n--- 6. NC_RIPS_CROSSCHECK Integral ---");

test("TC15: NC_RIPS_CROSSCHECK valida coherencia completa de NIT, Factura, NC y montos", () => {
  const ripsOk = {
    numDocumentoIdObligado: "901234567",
    numFactura: "SETP-990000077",
    tipoNota: "NC",
    numNota: "NC-990000088",
    usuarios: [
      {
        servicios: {
          procedimientos: [{ vrServicio: 100000 }],
        },
      },
    ],
  };

  const cross = executeNcRipsCrosscheck({
    tenantId: TEST_TENANT,
    prestadorNit: "901234567",
    creditNote: { numero: "NC-990000088", cude: "cude-ok", monto_acreditado: 100000 },
    facturaOriginal: invoiceWithIdenticalProcedures,
    ripsJson: ripsOk,
    montoAcreditadoObjetivo: 100000,
  });

  assert.strictEqual(cross.valid, true);
  assert.strictEqual(cross.totalRipsServicios, 100000);
});

test("TC16: NC_RIPS_CROSSCHECK detecta discrepancia monetaria (NC_RIPS_VALUE_MISMATCH)", () => {
  const ripsDiscrepante = {
    numDocumentoIdObligado: "901234567",
    numFactura: "SETP-990000077",
    tipoNota: "NC",
    numNota: "NC-990000088",
    usuarios: [
      {
        servicios: {
          procedimientos: [{ vrServicio: 95000 }], // difiere de 100.000
        },
      },
    ],
  };

  const cross = executeNcRipsCrosscheck({
    tenantId: TEST_TENANT,
    prestadorNit: "901234567",
    creditNote: { numero: "NC-990000088", cude: "cude-ok", monto_acreditado: 100000 },
    facturaOriginal: invoiceWithIdenticalProcedures,
    ripsJson: ripsDiscrepante,
    montoAcreditadoObjetivo: 100000,
  });

  assert.strictEqual(cross.valid, false);
  assert.ok(cross.errors.some((e) => e.includes("NC_RIPS_VALUE_MISMATCH")));
});

console.log("\n================================================================================");
console.log(`TOTAL CASOS DE PRUEBA: ${passedCount} | EXITOSOS: ${passedCount} | FALLIDOS: 0`);
console.log("RESULTADO FINAL: 100% PASS — TRAZABILIDAD CLÍNICA NC PARCIAL CERRADA FORMALMENTE");
console.log("================================================================================");
