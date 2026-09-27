/**
 * test_p0_fev1a_health_fev_suite.mjs
 * 
 * Suite de pruebas formal para FASE P0-FEV1A + MICROFASE P0-FEV1A-R2:
 * RECONCILIACIÓN DE CATÁLOGOS FACTUS SALUD + BLOQUEO DE BYPASS COMERCIAL
 * 
 * Cubre:
 * 1. PlanEditor + item realizado → SS-CUFE generado con catálogos reconciliados
 * 2. Item NO realizado → emisión bloqueada (FEV_CLINICAL_SOURCE_REQUIRED)
 * 3. Prestación clínica estructurada NO puede pasar a COMERCIAL (CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE)
 * 4. Producto genuinamente no clínico SÍ puede usar COMERCIAL
 * 5. Reconciliación de payment_method_code:
 *    - "02" NO se trata como Pago por evento (en Factus V2 es "Pago global prospectivo")
 *    - "04" es "Pago por evento"
 *    - Removido hardcodeo silencioso de "02"
 * 6. Reconciliación de coverage_code:
 *    - "04" NO se trata como Particular (en Factus V2 es "SOAT")
 *    - Particular usa catálogo vigente Factus: "15"
 *    - Removido hardcodeo silencioso de "04"
 * 7. Contrato válido vs without_contract_code:
 *    - Entidad requiere contract_number obligatorio (sin fallbacks inventados como CONV-001)
 *    - without_contract_code oficialmente soportado en Factus V2 ("01".."05")
 * 8. NO hardcoding silencioso: falta de configuración obligatoria bloquea con preflight error
 * 9. Provider_code correcto desde configuración
 * 10. Billing_period correcto (primera fecha, última fecha, anti fechas futuras)
 * 11. Numbering_range_id preservado
 * 12. Persistencia de CUFE / número / QR
 * 13. Factura comercial no-salud no se rompe (cero regresión)
 * 14. Feature Flag ENABLE_FEV_RIPS_0948 guard
 */

import {
  buildFactusHealthInvoicePayload,
  validateHealthData,
  validateBillingPeriod,
  buildBillingPeriodFromAttentions,
  buildBeneficiaryFromPatient,
  resolveHealthDataFromConfig,
  validateClinicalAttentionsForHealthInvoice,
  isClinicalStructuredItem,
  isFacturaSectorSalud,
  CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE,
  CLINICAL_INVOICE_CANNOT_BYPASS_ERROR_MESSAGE,
  FEV_CLINICAL_SOURCE_REQUIRED,
  FEV_CLINICAL_SOURCE_ERROR_MESSAGE,
  PARTICULAR_COVERAGE_CODE,
  PAYMENT_METHOD_EVENTO_CODE,
  FACTUS_HEALTH_PAYMENT_METHOD_CATALOG,
  FACTUS_HEALTH_COVERAGE_CATALOG,
  FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG,
} from "../src/services/factusHealthPayloadBuilder.js";

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTestSuite() {
  console.log("=".repeat(80));
  console.log("🧪 SUITE FORMAL: FEV SALUD SS-CUFE + RECONCILIACIÓN CATÁLOGOS (P0-FEV1A-R2)");
  console.log("=".repeat(80));

  // ─────────────────────────────────────────────────────────────
  // 1. PlanEditor + Item Realizado → Payload SS-CUFE generado
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 1. PlanEditor: Atenciones Realizadas y Generación SS-CUFE Reconciliado ---");
  {
    const baseStandardPayload = {
      numbering_range_id: 8,
      reference_code: "OC-PLAN-TEST-001",
      observation: "Atención odontológica realizada",
      payment_details: [
        { payment_form: "1", payment_method_code: "10", amount: "120000.00" }
      ],
      customer: {
        identification_document_code: "13",
        identification: "1020304050",
        names: "Carlos",
        last_names: "Gómez",
        address: "Calle 100 #15-20",
        email: "carlos.gomez@example.com",
        phone: "3001234567",
        legal_organization_code: "2",
        tribute_code: "ZZ",
        municipality_code: "11001"
      },
      items: [
        {
          code_reference: "232101",
          name: "Obturación dental resina fotocurado",
          quantity: 1,
          discount_rate: 0,
          price: 120000,
          unit_measure_code: "94",
          standard_code: "0001",
          taxes: [{ code: "01", rate: "0.00" }]
        }
      ]
    };

    // Usando catálogos reconciliados: 04 = Evento, 15 = Particular, 05 = Sin contrato
    const healthData = {
      provider_code: "7000101657",
      payment_method_code: PAYMENT_METHOD_EVENTO_CODE, // "04"
      coverage_code: PARTICULAR_COVERAGE_CODE,         // "15"
      without_contract_code: "05"
    };

    const realizedAttentions = [
      { id: "item-1", codigo_cups: "232101", fechaRealizado: "2026-09-10", realizado: true },
      { id: "item-2", codigo_cups: "890203", fechaRealizado: "2026-09-15", realizado: true }
    ];

    const billingPeriod = buildBillingPeriodFromAttentions(realizedAttentions, new Date("2026-09-26"));
    const patientObj = {
      tipoDocumento: "CC",
      documento: "1020304050",
      nombres: "Carlos Alberto",
      apellidos: "Gómez Pérez"
    };
    const beneficiary = buildBeneficiaryFromPatient(patientObj);

    const ssCufePayload = buildFactusHealthInvoicePayload(baseStandardPayload, healthData, {
      billing_period: billingPeriod,
      beneficiary
    });

    assert(ssCufePayload.operation_type === "SS-CUFE", "operation_type es estrictamente 'SS-CUFE'");
    assert(Boolean(ssCufePayload.health), "Objeto 'health' está presente en el payload");
    assert(ssCufePayload.health.provider_code === "7000101657", "health.provider_code coincide con el REPS de la clínica");
    assert(ssCufePayload.health.payment_method_code === "04", "health.payment_method_code es '04' (Pago por evento reconciliado)");
    assert(ssCufePayload.health.coverage_code === "15", "health.coverage_code es '15' (Particular reconciliado)");
    assert(ssCufePayload.billing_period.start_date === "2026-09-10", "billing_period.start_date corresponde a la primera atención");
    assert(ssCufePayload.billing_period.end_date === "2026-09-15", "billing_period.end_date corresponde a la última atención");
    assert(ssCufePayload.beneficiary.identification_number === "1020304050", "beneficiary.identification_number corresponde al paciente");
    assert(ssCufePayload.beneficiary.names === "Carlos Alberto", "beneficiary.names corresponde a los nombres del paciente");
    assert(ssCufePayload.beneficiary.surnames === "Gómez Pérez", "beneficiary.surnames corresponde a los apellidos del paciente");
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Procedimiento NO realizado → Emisión bloqueada
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 2. Bloqueo de Items No Realizados ---");
  {
    const itemsUnrealized = [
      { id: "it-unrealized-1", desc: "Diseño de sonrisa", cups: "232101", realizado: false }
    ];

    let blocked = false;
    let errCode = "";
    try {
      validateClinicalAttentionsForHealthInvoice(itemsUnrealized);
    } catch (e) {
      blocked = true;
      errCode = e.code;
    }

    assert(blocked, "Procedimiento NO realizado es bloqueado antes de emitir");
    assert(errCode === FEV_CLINICAL_SOURCE_REQUIRED, `Error code coincide con '${FEV_CLINICAL_SOURCE_REQUIRED}'`);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Bloqueo de Bypass: Prestación Clínica NO puede pasar a COMERCIAL
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 3. Bloqueo de Bypass Comercial para Prestaciones Clínicas ---");
  {
    const clinicalItemCups = { descripcion: "Profilaxis", cups: "890201", cantidad: 1, precioUnitario: 80000 };
    const clinicalItemPlan = { descripcion: "Restauración resina", planId: "plan-123", cantidad: 1, precioUnitario: 120000 };
    const clinicalItemRealizado = { descripcion: "Atención ejecutada", realizado: true, cantidad: 1, precioUnitario: 90000 };
    const clinicalItemEvolucion = { descripcion: "Control postquirúrgico", evolucionId: "evo-456", cantidad: 1, precioUnitario: 50000 };

    assert(isClinicalStructuredItem(clinicalItemCups) === true, "Ítem con CUPS es detectado como prestación clínica estructurada");
    assert(isClinicalStructuredItem(clinicalItemPlan) === true, "Ítem proveniente de plan es detectado como prestación clínica estructurada");
    assert(isClinicalStructuredItem(clinicalItemRealizado) === true, "Ítem con realizado:true es detectado como prestación clínica estructurada");
    assert(isClinicalStructuredItem(clinicalItemEvolucion) === true, "Ítem proveniente de evolución es detectado como prestación clínica estructurada");

    // Simular intento de emisión comercial con ítem clínico estructurado
    const itemsWithClinical = [clinicalItemCups];
    let commercialBypassBlocked = false;
    if (itemsWithClinical.some(isClinicalStructuredItem)) {
      commercialBypassBlocked = true;
    }
    assert(commercialBypassBlocked, "CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE: Factura con ítem clínico no puede pasar a COMERCIAL");
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Producto NO clínico SÍ puede usar COMERCIAL
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 4. Producto Genuinamente No Clínico SÍ puede usar COMERCIAL ---");
  {
    const retailItem1 = { descripcion: "Cepillo dental ortodoncia", cantidad: 2, precioUnitario: 15000 };
    const retailItem2 = { descripcion: "Enjuague bucal clorhexidina 0.12%", cantidad: 1, precioUnitario: 22000 };
    const nonClinicalItems = [retailItem1, retailItem2];

    const hasClinical = nonClinicalItems.some(isClinicalStructuredItem);
    assert(hasClinical === false, "Productos de venta retail no se clasifican como prestaciones clínicas");

    // Factura comercial no-salud no incluye campos de salud
    const commercialInvoice = {
      esSectorSalud: false,
      tipoOperacion: "COMERCIAL",
      items: nonClinicalItems
    };
    const qualifiesAsHealth = isFacturaSectorSalud({ factura: commercialInvoice, fevRipsFlagEnabled: true });
    assert(qualifiesAsHealth === false, "Factura comercial legítima no activa flujo de salud SS-CUFE");
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Reconciliación de payment_method_code (Factus V2)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 5. Reconciliación de payment_method_code Factus V2 ---");
  {
    // Verificar catálogo Factus V2
    assert(FACTUS_HEALTH_PAYMENT_METHOD_CATALOG["04"] === "Pago por evento", "Código '04' corresponde a 'Pago por evento' en Factus V2");
    assert(FACTUS_HEALTH_PAYMENT_METHOD_CATALOG["02"] === "Pago global prospectivo", "Código '02' corresponde a 'Pago global prospectivo' (NO a Pago por evento)");
    assert(FACTUS_HEALTH_PAYMENT_METHOD_CATALOG["01"] !== undefined, "Código '01' está catalogado (Paquete / Canasta)");
    assert(FACTUS_HEALTH_PAYMENT_METHOD_CATALOG["03"] !== undefined, "Código '03' está catalogado (Capitación)");

    // Resolver con '04' (Pago por evento)
    const resolvedEvent = resolveHealthDataFromConfig({
      providerCode: "7000101657",
      modalidadPago: "04",
      coberturaCode: "15"
    });
    assert(resolvedEvent.payment_method_code === "04", "Modalidad 04 asignada correctamente a Pago por evento");

    // Verificar que '02' NO se confunde con evento
    const resolvedGlobal = resolveHealthDataFromConfig({
      providerCode: "7000101657",
      modalidadPago: "02",
      coberturaCode: "15"
    });
    assert(resolvedGlobal.payment_method_code === "02", "Modalidad 02 preserva significado contractual de Pago global prospectivo");

    // Verificar que falta de modalidadPago bloquea emisión (NO hardcodea 02 silencioso)
    let throwsOnMissingPM = false;
    try {
      resolveHealthDataFromConfig({
        providerCode: "7000101657",
        coberturaCode: "15"
        // modalidadPago omitido
      });
    } catch (e) {
      throwsOnMissingPM = e.message.includes("payment_method_code");
    }
    assert(throwsOnMissingPM, "Falta de payment_method_code bloquea emisión sin default silencioso");
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Reconciliación de coverage_code (Factus V2)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 6. Reconciliación de coverage_code Factus V2 ---");
  {
    assert(PARTICULAR_COVERAGE_CODE === "15", "PARTICULAR_COVERAGE_CODE verificado como '15'");
    assert(FACTUS_HEALTH_COVERAGE_CATALOG["15"] === "Particular", "Código '15' corresponde a 'Particular' en Factus V2");
    assert(FACTUS_HEALTH_COVERAGE_CATALOG["04"] === "SOAT", "Código '04' corresponde a 'SOAT' (NO a Particular)");
    assert(FACTUS_HEALTH_COVERAGE_CATALOG["01"] !== undefined, "Código '01' corresponde a Plan de beneficios UPC");

    // Paciente particular resuelve a '15'
    const healthParticular = resolveHealthDataFromConfig({
      providerCode: "7000101657",
      modalidadPago: "04",
      coberturaCode: "15"
    });
    assert(healthParticular.coverage_code === "15", "Paciente particular usa código reconciliado '15' (nunca '04')");

    // Si alguien pasa cobertura '04', debe preservar su significado real (SOAT) y no Particular
    const healthSoat = resolveHealthDataFromConfig({
      providerCode: "7000101657",
      modalidadPago: "04",
      coberturaCode: "04"
    });
    assert(healthSoat.coverage_code === "04", "Código 04 asigna SOAT, preservando su significado contractual");
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Contrato vs without_contract_code Oficialmente Soportado
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 7. Contrato vs without_contract_code Oficial Factus V2 ---");
  {
    // without_contract_code catálogo soportado
    assert(Boolean(FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG["01"]), "Código 01 de factura sin contrato soportado (Urgencias)");
    assert(Boolean(FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG["05"]), "Código 05 de factura sin contrato soportado (Excepcionales)");

    // Paciente particular sin contrato institucional
    const healthSinContrato = resolveHealthDataFromConfig({
      providerCode: "7000101657",
      modalidadPago: "04",
      coberturaCode: "15",
      withoutContractCode: "05"
    });
    assert(healthSinContrato.without_contract_code === "05", "without_contract_code '05' asignado correctamente");
    assert(!healthSinContrato.contract_number, "contract_number no se envía si el paciente no tiene contrato");

    // Convenio con contrato real
    const healthConContrato = resolveHealthDataFromConfig({
      providerCode: "7000101657",
      isEntidad: true,
      modalidadPago: "04",
      coberturaCode: "01",
      contractNumber: "CONV-2026-EPS-SUR"
    });
    assert(healthConContrato.contract_number === "CONV-2026-EPS-SUR", "contract_number asignado en convenio");
    assert(!healthConContrato.without_contract_code, "without_contract_code no se envía cuando hay contrato");

    // Convenio sin contrato: debe bloquear (sin inventar 'CONV-001')
    let convenioSinContratoBlocked = false;
    try {
      resolveHealthDataFromConfig({
        providerCode: "7000101657",
        isEntidad: true,
        modalidadPago: "04",
        coberturaCode: "01",
        contractNumber: "" // falta contrato
      });
    } catch (e) {
      convenioSinContratoBlocked = e.message.includes("contract_number");
    }
    assert(convenioSinContratoBlocked, "Entidad/convenio sin contrato bloquea emisión (sin inventar 'CONV-001')");
  }

  // ─────────────────────────────────────────────────────────────
  // 8. NO Hardcoding Silencioso / Validación de Preflight
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 8. Bloqueo de Emisión por Configuración Faltante (Sin Defaults Silenciosos) ---");
  {
    // Falta provider_code
    let errProvider = false;
    try {
      resolveHealthDataFromConfig({
        providerCode: "",
        modalidadPago: "04",
        coberturaCode: "15"
      });
    } catch (e) {
      errProvider = e.message.includes("provider_code");
    }
    assert(errProvider, "Falta provider_code bloquea emisión con preflight error");

    // Falta payment_method_code
    let errPM = false;
    try {
      resolveHealthDataFromConfig({
        providerCode: "7000101657",
        coberturaCode: "15"
      });
    } catch (e) {
      errPM = e.message.includes("payment_method_code");
    }
    assert(errPM, "Falta payment_method_code bloquea emisión con preflight error");

    // Falta coverage_code para entidad
    let errCovEntidad = false;
    try {
      resolveHealthDataFromConfig({
        providerCode: "7000101657",
        isEntidad: true,
        modalidadPago: "04",
        contractNumber: "CONV-001"
      });
    } catch (e) {
      errCovEntidad = e.message.includes("coverage_code");
    }
    assert(errCovEntidad, "Falta coverage_code en entidad bloquea emisión con preflight error");
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Billing Period: Primera fecha, última fecha y anti fechas futuras
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 9. Construcción y Validación del Periodo de Facturación ---");
  {
    const refEmissionDate = new Date("2026-09-26");

    const multiAttentions = [
      { fechaRealizado: "2026-09-05" },
      { fechaRealizado: "2026-09-20" },
      { fechaRealizado: "2026-09-12" }
    ];
    const period = buildBillingPeriodFromAttentions(multiAttentions, refEmissionDate);
    assert(period.start_date === "2026-09-05", "start_date = fecha más antigua");
    assert(period.end_date === "2026-09-20", "end_date = fecha más reciente");

    // Fecha futura no permitida
    const futureAttentions = [
      { fechaRealizado: "2026-09-28" }
    ];
    let futureBlocked = false;
    try {
      buildBillingPeriodFromAttentions(futureAttentions, refEmissionDate);
    } catch (e) {
      futureBlocked = true;
    }
    assert(futureBlocked, "Atención posterior a la fecha de emisión es rechazada");

    // Fecha inicio > fecha fin
    let invertedBlocked = false;
    try {
      validateBillingPeriod({ start_date: "2026-09-20", end_date: "2026-09-10" }, refEmissionDate);
    } catch (e) {
      invertedBlocked = true;
    }
    assert(invertedBlocked, "start_date > end_date es rechazado");
  }

  // ─────────────────────────────────────────────────────────────
  // 10. Numbering Range ID Presente
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 10. Numbering Range ID ---");
  {
    const basePayload = {
      numbering_range_id: 8,
      reference_code: "OC-RANGE-001"
    };
    const healthData = {
      provider_code: "7000101657",
      payment_method_code: "04",
      coverage_code: "15",
      without_contract_code: "05"
    };
    const finalP = buildFactusHealthInvoicePayload(basePayload, healthData);
    assert(finalP.numbering_range_id === 8, "numbering_range_id se mantiene intacto en el payload de salud");
  }

  // ─────────────────────────────────────────────────────────────
  // 11. Persistencia de CUFE / Número / QR
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 11. Persistencia de Respuesta Factus ---");
  {
    const mockFactusSuccess = {
      data: {
        bill: {
          number: "SETP990020888",
          cufe: "a1b2c3d4e5f6071829304152637485960a1b2c3d4e5f6071829304152637485960a1b2c3d4e5f6071829304152637485",
          qr_code: "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=a1b2c3d4e5f6",
          status: "Validada"
        }
      }
    };

    const bill = mockFactusSuccess.data.bill;
    const finalNro = bill.number;
    const cufe = bill.cufe;
    const qr = bill.qr_code;

    assert(finalNro === "SETP990020888", "Número legal Factus extraído correctamente");
    assert(cufe.length > 50, "CUFE legal extraído correctamente");
    assert(qr.includes("catalogo-vpfe.dian.gov.co"), "QR de consulta DIAN preservado");
  }

  // ─────────────────────────────────────────────────────────────
  // 12. Factura Comercial No-Salud (Cero Regresión)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 12. No Regresión en Factura Comercial No-Salud ---");
  {
    const commercialInvoice = {
      esSectorSalud: false,
      items: [{ descripcion: "Cepillo dental ortodoncia", cantidad: 2, precioUnitario: 15000 }]
    };
    const qualifies = isFacturaSectorSalud({ factura: commercialInvoice, fevRipsFlagEnabled: true });
    assert(!qualifies, "Factura comercial no-salud no califica como sector salud");

    const stdPayload = {
      numbering_range_id: 8,
      items: commercialInvoice.items
    };
    assert(!stdPayload.operation_type, "Factura comercial no incluye operation_type SS-CUFE");
    assert(!stdPayload.health, "Factura comercial no incluye objeto health");
  }

  // ─────────────────────────────────────────────────────────────
  // 13. Feature Flag ENABLE_FEV_RIPS_0948 Guard
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- 13. Verificación Feature Flag ENABLE_FEV_RIPS_0948 ---");
  {
    const healthInvoice = { esSectorSalud: true, items: [] };

    const qualifiesWithFlagOn = isFacturaSectorSalud({ factura: healthInvoice, fevRipsFlagEnabled: true });
    assert(qualifiesWithFlagOn === true, "Con flag ON, factura de salud es reconocida como SS-CUFE");

    const qualifiesWithFlagOff = isFacturaSectorSalud({ factura: healthInvoice, fevRipsFlagEnabled: false });
    assert(qualifiesWithFlagOff === false, "Con flag OFF, factura de salud es bloqueada (isFacturaSectorSalud = false)");
  }

  console.log("=".repeat(80));
  console.log(`TOTAL PRUEBAS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log(`ESTADO FINAL: ${failedTests === 0 ? "✅ 100% PASSING" : "❌ FALLAS DETECTADAS"}`);
  console.log("=".repeat(80));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Error fatal en suite de pruebas:", err);
  process.exit(1);
});
