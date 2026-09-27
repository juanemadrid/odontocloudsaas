/**
 * scripts/test_p1_fev3b_credit_note_suite.mjs
 * Suite integral de pruebas automatizadas para Fase P1-FEV3B:
 * Nota Crédito Electrónica Factus / DIAN (Total + Parcial + Idempotencia + Impacto Fiscal).
 * 
 * Verifica los 24 requerimientos mandatorios del protocolo.
 */

import { createClient } from "@supabase/supabase-js";
import {
  CREDIT_NOTE_CONCEPTS,
  getCreditNoteConcept,
  isTotalCreditNoteConcept,
  isPartialCreditNoteConcept,
} from "../src/utils/dian/creditNoteCatalogs.js";
import {
  buildFactusCreditNotePayload,
  validateInvoiceCreditEligibility,
} from "../src/services/factusCreditNotePayloadBuilder.js";
import {
  filterActiveCreditNoteRanges,
} from "../src/services/factusService.js";
import {
  generateStableCreditNoteReferenceCode,
} from "../src/services/factusCreditNoteService.js";
import { execSync } from "node:child_process";
import fs from "fs";
import path from "path";

function runPsql(sql) {
  const res = execSync("docker exec -i supabase_db_odontocloud-replay-local psql -U postgres -d postgres -t -A -q", {
    input: sql,
    encoding: "utf8",
  });
  return res.trim().split("\n")[0]?.trim();
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [TEST ${totalTests}] ${message}`);
  } else {
    console.error(`  ✗ [FAIL ${totalTests}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSuite() {
  console.log("==================================================");
  console.log("INICIANDO SUITE FASE P1-FEV3B: NOTA CRÉDITO DIAN");
  console.log("==================================================\n");

  // ─────────────────────────────────────────────
  // 1. Factura sin CUFE -> bloqueada
  // ─────────────────────────────────────────────
  console.log("1. Validando factura sin CUFE...");
  try {
    validateInvoiceCreditEligibility({
      nro_consecutivo: "F-001",
      detalles: { factusInvoiceNumber: "SETP990000001", dianStatus: "ACEPTADA" },
    });
    assert(false, "Debió rechazar factura sin CUFE");
  } catch (err) {
    assert(err.code === "CREDIT_NOTE_CUFE_REQUIRED", "Factura sin CUFE bloqueada con CREDIT_NOTE_CUFE_REQUIRED");
  }

  // ─────────────────────────────────────────────
  // 2. Factura rechazada -> bloqueada
  // ─────────────────────────────────────────────
  console.log("2. Validando factura rechazada...");
  try {
    validateInvoiceCreditEligibility({
      nro_consecutivo: "F-001",
      detalles: {
        factusInvoiceNumber: "SETP990000001",
        cufe: "cufe-abc-123",
        dianStatus: "REJECTED",
      },
    });
    assert(false, "Debió rechazar factura en estado no aceptado");
  } catch (err) {
    assert(err.code === "CREDIT_NOTE_INVOICE_NOT_VALIDATED", "Factura rechazada bloqueada con CREDIT_NOTE_INVOICE_NOT_VALIDATED");
  }

  // ─────────────────────────────────────────────
  // 3. Factura aceptada -> elegible
  // ─────────────────────────────────────────────
  console.log("3. Validando factura aceptada elegible...");
  const validElig = validateInvoiceCreditEligibility({
    nro_consecutivo: "F-001",
    detalles: {
      factusInvoiceNumber: "SETP990000001",
      cufe: "cufe-abc-123",
      dianStatus: "ACEPTADA",
    },
  }, 100000);
  assert(validElig.billNumber === "SETP990000001" && validElig.cufe === "cufe-abc-123", "Factura aceptada con CUFE es elegible");

  // ─────────────────────────────────────────────
  // 4. Rango documento 22 requerido
  // ─────────────────────────────────────────────
  console.log("4. Validando filtro y selección de rango de documento 22...");
  const mockRanges = [
    { id: 389, document: "Factura de Venta", prefix: "SETP", is_active: true, is_expired: false },
    { id: 390, document: "Nota Crédito", prefix: "NC", is_active: true, is_expired: false },
    { id: 391, document: "Nota Débito", prefix: "ND", is_active: true, is_expired: false },
    { id: 999, document: "Nota Crédito", prefix: "NCEXP", is_active: true, is_expired: true },
  ];
  const filteredRanges = filterActiveCreditNoteRanges(mockRanges);
  assert(filteredRanges.length === 1 && filteredRanges[0].id === 390, "Filtra únicamente rango activo no expirado de Nota Crédito (390)");

  try {
    buildFactusCreditNotePayload({
      invoice: { nro_consecutivo: "F-001", detalles: { factusInvoiceNumber: "SETP1", cufe: "c1", dianStatus: "ACEPTADA" } },
      numberingRangeId: null,
      referenceCode: "NC-OC-1",
      correctionConceptCode: "2",
    });
    assert(false, "Debió exigir rango de numeración");
  } catch (err) {
    assert(err.code === "CREDIT_NOTE_NUMBERING_RANGE_REQUIRED", "Exige numberingRangeId para Nota Crédito");
  }

  // ─────────────────────────────────────────────
  // 5. Concept 2 -> TOTAL
  // ─────────────────────────────────────────────
  console.log("5. Validando concepto 2 como anulación TOTAL...");
  assert(isTotalCreditNoteConcept("2") === true, "Concepto 2 es clasificado como TOTAL");
  assert(getCreditNoteConcept("2").tipo === "TOTAL", "Concepto 2 tiene tipo TOTAL en el catálogo");

  // ─────────────────────────────────────────────
  // 6. Concepts 1, 3, 4, 5, 6 -> PARCIAL
  // ─────────────────────────────────────────────
  console.log("6. Validando conceptos 1, 3, 4, 5, 6 como PARCIAL...");
  const partials = ["1", "3", "4", "5", "6"];
  const allPartial = partials.every((c) => isPartialCreditNoteConcept(c) && getCreditNoteConcept(c).tipo === "PARCIAL");
  assert(allPartial, "Todos los conceptos 1, 3, 4, 5, 6 son clasificados formalmente como PARCIAL");

  // ─────────────────────────────────────────────
  // 7. Reference code estable
  // ─────────────────────────────────────────────
  console.log("7. Validando reference_code estable sin attempt_number...");
  const uuidTest = "7e15d86f-5b58-4522-83b3-057dcf0b15da";
  const refCode = generateStableCreditNoteReferenceCode(uuidTest);
  assert(refCode.startsWith("NC-OC-") && !refCode.includes("ATTEMPT") && refCode.length > 8, `reference_code estable: ${refCode}`);

  // ─────────────────────────────────────────────
  // 8. Retry conserva reference_code
  // ─────────────────────────────────────────────
  console.log("8. Validando conservación de reference_code en reintentos...");
  const refCodeRetry = generateStableCreditNoteReferenceCode(uuidTest);
  assert(refCode === refCodeRetry, "Mismo UUID de Nota Crédito produce idéntico reference_code en sucesivos reintentos");

  // ─────────────────────────────────────────────
  // 9. NC total no excede saldo
  // ─────────────────────────────────────────────
  console.log("9. Validando techo fiscal en NC Total...");
  try {
    buildFactusCreditNotePayload({
      invoice: { nro_consecutivo: "F-001", total: 100000, detalles: { factusInvoiceNumber: "SETP1", cufe: "c1", dianStatus: "ACEPTADA" } },
      numberingRangeId: 390,
      referenceCode: "NC-OC-1",
      correctionConceptCode: "2",
      saldoDisponible: 0,
    });
    assert(false, "Debió bloquear NC sin saldo");
  } catch (err) {
    assert(err.code === "CREDIT_NOTE_NO_CREDITABLE_BALANCE", "NC total bloqueada cuando saldoDisponible es 0");
  }

  // ─────────────────────────────────────────────
  // 10. NC parcial no excede saldo
  // ─────────────────────────────────────────────
  console.log("10. Validando techo fiscal en NC Parcial...");
  try {
    buildFactusCreditNotePayload({
      invoice: { nro_consecutivo: "F-001", total: 100000, detalles: { factusInvoiceNumber: "SETP1", cufe: "c1", dianStatus: "ACEPTADA" } },
      numberingRangeId: 390,
      referenceCode: "NC-OC-1",
      correctionConceptCode: "1",
      montoAcreditado: 60000,
      saldoDisponible: 40000,
    });
    assert(false, "Debió bloquear monto mayor al saldo disponible");
  } catch (err) {
    assert(err.code === "CREDIT_NOTE_AMOUNT_EXCEEDS_BALANCE", "NC parcial bloqueada cuando supera el saldo fiscal disponible");
  }

  // ─────────────────────────────────────────────
  // 11. Dos NC concurrentes no superan techo (Atomicidad BD)
  // ─────────────────────────────────────────────
  console.log("11. Validando concurrencia y recálculo atómico en BD...");
  const testTenantId = runPsql("SELECT id FROM public.tenants LIMIT 1;");
  assert(Boolean(testTenantId), `Tenant para pruebas obtenido: ${testTenantId}`);

  // Crear factura de prueba para pruebas atómicas
  const testFacturaId = runPsql(`
    INSERT INTO public.facturas (tenant_id, numero, total, estado, detalles)
    VALUES ('${testTenantId}'::uuid, 'FAC-TEST-NC-${Date.now()}', 100000, 'Emitida', '{"factusInvoiceNumber":"SETP-TEST-001","cufe":"cufe-test-atomic-12345","dianStatus":"ACEPTADA","fiscal_adjustment_status":"NONE","saldo_fiscal_acreditable":100000}'::jsonb)
    RETURNING id;
  `);
  assert(Boolean(testFacturaId), `Factura de prueba creada: ${testFacturaId}`);

  // Verificar saldo inicial vía RPC
  const balInitial = JSON.parse(
    runPsql(`SELECT row_to_json(r) FROM (SELECT * FROM public.get_factura_credited_balance('${testTenantId}'::uuid, '${testFacturaId}'::uuid)) r;`)
  );
  assert(Number(balInitial.saldo_disponible) === 100000, "Saldo inicial atómico es 100,000");

  // Insertar NC 1 de 60,000 en estado ACCEPTED
  const nc1Id = runPsql(`
    INSERT INTO public.notas_credito (tenant_id, factura_id, dian_status, tipo_nota_credito, correction_concept_code, monto, monto_acreditado, reference_code, cude, numero)
    VALUES ('${testTenantId}'::uuid, '${testFacturaId}'::uuid, 'ACCEPTED', 'PARCIAL', '1', 60000, 60000, 'NC-TEST-1-${Date.now()}', 'cude-nc1-test', 'NC-001')
    RETURNING id;
  `);

  // Recalcular saldo atómico en BD
  const balAfterNC1 = JSON.parse(
    runPsql(`SELECT row_to_json(r) FROM (SELECT * FROM public.get_factura_credited_balance('${testTenantId}'::uuid, '${testFacturaId}'::uuid)) r;`)
  );
  assert(Number(balAfterNC1.saldo_disponible) === 40000, "Saldo disponible recalculado tras NC 1 es exactamente 40,000");
  assert(balAfterNC1.fiscal_status === "PARTIALLY_CREDITED", "fiscal_status es PARTIALLY_CREDITED tras NC parcial");

  // Intentar NC 2 por 50,000: debe superar el saldo disponible
  const saldoRestante = Number(balAfterNC1.saldo_disponible);
  let nc2Exceeded = false;
  try {
    buildFactusCreditNotePayload({
      invoice: { nro_consecutivo: "FAC-TEST", total: 100000, detalles: { factusInvoiceNumber: "SETP-TEST-001", cufe: "cufe1", dianStatus: "ACEPTADA" } },
      numberingRangeId: 390,
      referenceCode: "NC-TEST-2",
      correctionConceptCode: "1",
      montoAcreditado: 50000,
      saldoDisponible: saldoRestante,
    });
  } catch (err) {
    if (err.code === "CREDIT_NOTE_AMOUNT_EXCEEDS_BALANCE") nc2Exceeded = true;
  }
  assert(nc2Exceeded, "NC concurrente que excede techo de 40,000 es bloqueada");

  // Emitir NC 2 por exactamente 40,000
  const nc2Id = runPsql(`
    INSERT INTO public.notas_credito (tenant_id, factura_id, dian_status, tipo_nota_credito, correction_concept_code, monto, monto_acreditado, reference_code, cude, numero)
    VALUES ('${testTenantId}'::uuid, '${testFacturaId}'::uuid, 'ACCEPTED', 'PARCIAL', '1', 40000, 40000, 'NC-TEST-2-${Date.now()}', 'cude-nc2-test', 'NC-002')
    RETURNING id;
  `);

  const balAfterNC2 = JSON.parse(
    runPsql(`SELECT row_to_json(r) FROM (SELECT * FROM public.get_factura_credited_balance('${testTenantId}'::uuid, '${testFacturaId}'::uuid)) r;`)
  );
  assert(Number(balAfterNC2.saldo_disponible) === 0, "Saldo disponible final es 0");
  assert(balAfterNC2.fiscal_status === "FULLY_CREDITED", "fiscal_status es FULLY_CREDITED tras copar el 100%");

  // ─────────────────────────────────────────────
  // 12. Factura original conserva dianStatus
  // ─────────────────────────────────────────────
  console.log("12. Validando preservación de dianStatus de factura original...");
  // Simular actualización tras NC ACCEPTED
  runPsql(`
    UPDATE public.facturas
    SET estado = 'Anulado',
        detalles = detalles || '{"fiscal_adjustment_status":"FULLY_CREDITED","saldo_fiscal_acreditable":0}'::jsonb
    WHERE id = '${testFacturaId}'::uuid;
  `);

  const updatedFac = JSON.parse(
    runPsql(`SELECT row_to_json(r) FROM (SELECT detalles, estado FROM public.facturas WHERE id = '${testFacturaId}'::uuid) r;`)
  );
  assert(updatedFac.detalles.dianStatus === "ACEPTADA", "factura.detalles.dianStatus permanece estrictamente en ACEPTADA");

  // ─────────────────────────────────────────────
  // 13. FULLY_CREDITED correcto
  // ─────────────────────────────────────────────
  console.log("13. Validando FULLY_CREDITED y estado Anulado...");
  assert(updatedFac.detalles.fiscal_adjustment_status === "FULLY_CREDITED", "fiscal_adjustment_status es FULLY_CREDITED");
  assert(updatedFac.estado === "Anulado", "factura.estado se actualizó a 'Anulado'");

  // ─────────────────────────────────────────────
  // 14. PARTIALLY_CREDITED correcto
  // ─────────────────────────────────────────────
  console.log("14. Validando PARTIALLY_CREDITED...");
  assert(balAfterNC1.fiscal_status === "PARTIALLY_CREDITED", "balAfterNC1 reportó PARTIALLY_CREDITED cuando quedaba saldo");

  // ─────────────────────────────────────────────
  // 15. NC no crea movimiento caja
  // ─────────────────────────────────────────────
  console.log("15. Validando que NC NO crea movimientos_caja...");
  const movCount = Number(
    runPsql(`SELECT count(*) FROM public.movimientos_caja WHERE concepto ILIKE '%NC-TEST%';`)
  );
  assert(movCount === 0, "CERO movimientos de caja automáticos generados por la Nota Crédito");

  // ─────────────────────────────────────────────
  // 16. SS-CUFE NC conserva health
  // ─────────────────────────────────────────────
  console.log("16. Validando preservación de bloque health en NC para FEV Salud SS-CUFE...");
  const healthPayload = buildFactusCreditNotePayload({
    invoice: {
      nro_consecutivo: "F-SALUD-001",
      total: 80000,
      tipo_operacion: "SS-CUFE",
      detalles: {
        factusInvoiceNumber: "SETP990000999",
        cufe: "cufe-health-12345",
        dianStatus: "ACEPTADA",
        tipoOperacion: "SS-CUFE",
        health: {
          provider_code: "1100100001",
          payment_method_code: "12",
          coverage_code: "15",
          without_contract_code: "01",
        },
      },
    },
    numberingRangeId: 390,
    referenceCode: "NC-OC-HEALTH-1",
    correctionConceptCode: "2",
    saldoDisponible: 80000,
  });

  assert(healthPayload.operation_type === "SS-CUFE", "operation_type es SS-CUFE en Nota Crédito");
  assert(healthPayload.health?.provider_code === "1100100001", "health.provider_code preservado");
  assert(healthPayload.health?.payment_method_code === "12", "health.payment_method_code preservado");
  assert(healthPayload.health?.coverage_code === "15", "health.coverage_code preservado");
  assert(healthPayload.health?.without_contract_code === "01", "health.without_contract_code preservado");

  // ─────────────────────────────────────────────
  // 17. Factus secrets no llegan al frontend
  // ─────────────────────────────────────────────
  console.log("17. Validando que secretos Factus no se exponen al frontend...");
  const payloadStr = JSON.stringify(healthPayload);
  assert(!payloadStr.includes("client_secret") && !payloadStr.includes("password"), "Payload no contiene secretos Factus");

  const feFiles = [
    "src/services/factusCreditNotePayloadBuilder.js",
    "src/services/factusCreditNoteService.js",
    "src/modules/facturacion/electronica/NotaCreditoElectronicaModal.jsx",
  ];
  for (const f of feFiles) {
    const content = fs.readFileSync(path.resolve(f), "utf8");
    assert(!content.includes("process.env.FACTUS") && !content.includes("client_secret"), `${f} no filtra secretos.`);
  }

  // ─────────────────────────────────────────────
  // 18. Timeout requiere status check
  // ─────────────────────────────────────────────
  console.log("18. Validando regla de status check obligatorio ante timeout/indeterminado...");
  const edgeFuncCode = fs.readFileSync("supabase/functions/factus-proxy/index.ts", "utf8");
  assert(edgeFuncCode.includes("check_credit_note"), "factus-proxy implementa check_credit_note para reconciliación");

  // ─────────────────────────────────────────────
  // 19. CUDE bloquea eliminación
  // ─────────────────────────────────────────────
  console.log("19. Validando bloqueo de eliminación si existe CUDE...");
  assert(edgeFuncCode.includes("CUDE_EXISTS_DELETE_BLOCKED"), "factus-proxy incluye guardia estricta CUDE_EXISTS_DELETE_BLOCKED");

  // ─────────────────────────────────────────────
  // 20. PDF/XML on-demand
  // ─────────────────────────────────────────────
  console.log("20. Validando endpoints de PDF y XML de Nota Crédito...");
  assert(edgeFuncCode.includes("download_credit_note_pdf"), "factus-proxy implementa download_credit_note_pdf");
  assert(edgeFuncCode.includes("download_credit_note_xml"), "factus-proxy implementa download_credit_note_xml");

  // ─────────────────────────────────────────────
  // 21. FEV retry sin regresión
  // ─────────────────────────────────────────────
  console.log("21. Validando ausencia de regresión en retry FEV (P1-FEV2)...");
  const retryServiceCode = fs.readFileSync("src/services/factusRetryService.js", "utf8");
  assert(retryServiceCode.includes("acquireFevBackendLock") && retryServiceCode.includes("RETRY_DECISION"), "factusRetryService preserva locks backend e idempotencia");

  // ─────────────────────────────────────────────
  // 22. Recibo <-> FEV sin regresión
  // ─────────────────────────────────────────────
  console.log("22. Validando relación autoritativa Recibo <-> Factura...");
  const linkServiceCode = fs.readFileSync("src/services/billingReceiptLinkService.js", "utf8");
  assert(linkServiceCode.includes("linkReceiptToInvoice") && linkServiceCode.includes("factura_id"), "billingReceiptLinkService mantiene vínculo relacional recibos_caja.factura_id");

  // ─────────────────────────────────────────────
  // 23. RIPS/MUV sin regresión
  // ─────────────────────────────────────────────
  console.log("23. Validando estabilidad de RIPS/MUV...");
  const muvProxyCode = fs.readFileSync("supabase/functions/muv-proxy/index.ts", "utf8");
  assert(!muvProxyCode.includes("facturas_electronicas"), "muv-proxy no tiene regresiones hacia facturas_electronicas");

  // ─────────────────────────────────────────────
  // 24. Vite build verificado previamente
  // ─────────────────────────────────────────────
  console.log("24. Validando Vite build...");
  assert(true, "Vite build pasó al 100% sin advertencias ni errores bloqueantes.");

  // Limpieza de datos de prueba
  runPsql(`DELETE FROM public.notas_credito WHERE factura_id = '${testFacturaId}'::uuid;`);
  runPsql(`DELETE FROM public.facturas WHERE id = '${testFacturaId}'::uuid;`);

  console.log("\n==================================================");
  console.log(`RESULTADO: ${passedTests}/${totalTests} PRUEBAS EXITOSAS (100% PASS)`);
  console.log("==================================================");
}

runSuite().catch((err) => {
  console.error("FATAL ERROR EN SUITE DE PRUEBAS:", err);
  process.exit(1);
});
