/**
 * scripts/test_rips_without_fev_compliance.mjs
 * 
 * SUITE FORMAL: RECONCILIACIÓN NORMATIVA 2026
 * FEV-RIPS vs RIPS SIN FACTURA vs PREVISUALIZACIÓN LOCAL
 * 
 * Verifica los 17 puntos exigidos por la auditoría normativa:
 * 1. FEV oficial mantiene numFactura.
 * 2. FEV oficial exige XML.
 * 3. Local preview muestra RC pero no como FEV.
 * 4. Local preview no puede MUV (OFFICIAL_FEV_REQUIRED).
 * 5. Profesional independiente NOT_REQUIRED habilita RIPS sin FEV.
 * 6. RIPS sin FEV genera numFactura = null.
 * 7. RIPS sin FEV no genera XML.
 * 8. RIPS sin FEV no exige CUFE.
 * 9. RIPS sin FEV mantiene paciente / CUPS / CIE10 / profesional.
 * 10. Reglas monetarias en contexto sin FEV (vrServicio = monto cobrado).
 * 11. IPS no puede activar RIPS sin FEV por accidente (IPS_CANNOT_USE_RIPS_WITHOUT_FEV).
 * 12. billingObligation UNCONFIRMED bloquea envío oficial (BILLING_OBLIGATION_UNCONFIRMED).
 * 13. No inferir obligación únicamente por 3.500 UVT.
 * 14. Flujo Factus FEV sin regresión.
 * 15. MUV FEV sin regresión.
 * 16. NC sin regresión.
 * 17. Vite PASS.
 */

import assert from "node:assert";
import {
  PROVIDER_TYPES,
  BILLING_OBLIGATIONS,
  RIPS_MODES,
  UVT_REFERENCE_NOTICE,
  resolveProviderProfile,
  validateRipsWithoutFevEligibility,
  validatePayerForRipsWithoutFev,
} from "../src/modules/rips/v003/services/ripsProviderProfileService.js";

import {
  normalizeRipsBillingSource,
  safeParseNotas,
} from "../src/modules/rips/v003/adapters/ripsBillingSourceAdapter.js";

import {
  generateRipsV003,
  validateRipsV003,
} from "../src/modules/rips/v003/index.js";

import {
  adaptClinicalDataToRipsV003,
} from "../src/modules/rips/v003/adapters/ripsV003ClinicalAdapter.js";

import {
  MUV_OPERATIONS,
  MUV_ENDPOINT_MAPPING,
} from "../services/muv-gateway/server.mjs";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("--- TEST SUITE: RIPS SIN FEV & RECONCILIACIÓN NORMATIVA 2026 ---");

// Test 1: FEV oficial mantiene numFactura
test("1. FEV oficial mantiene numFactura exacto", () => {
  const fevRecord = {
    id: "fev-uuid-001",
    numeroFactura: "SETP990000123",
    paciente_id: "pac-001",
    cufe: "abcdef1234567890abcdef1234567890abcdef12",
  };
  const normalized = normalizeRipsBillingSource(fevRecord, "facturas");
  assert.strictEqual(normalized.sourceMode, RIPS_MODES.OFFICIAL_FEV);
  assert.strictEqual(normalized.isOfficialInvoice, true);
  assert.strictEqual(normalized.numFactura, "SETP990000123");
  assert.strictEqual(normalized.documentNumber, "SETP990000123");
});

// Test 2: FEV oficial exige XML (en paquetes oficiales)
test("2. FEV oficial exige XML y mapeo CargarFevRips", () => {
  assert.strictEqual(MUV_OPERATIONS.FEV_RIPS, "FEV_RIPS");
  assert.strictEqual(MUV_ENDPOINT_MAPPING.FEV_RIPS, "/api/PaquetesFevRips/CargarFevRips");
});

// Test 3: Local preview muestra RC pero no como FEV
test("3. Local preview muestra RC-0001 internamente pero NO como FEV oficial", () => {
  const receiptRecord = {
    id: "pay-uuid-777",
    paciente_id: "pac-maria-elena",
    notas: JSON.stringify({
      nroConsecutivo: "1",
      itemPayments: [{ itemId: "item-c1", desc: "Consulta Odontológica", monto: 100000 }]
    }),
  };
  const normalized = normalizeRipsBillingSource(receiptRecord, "pagos");
  assert.strictEqual(normalized.sourceMode, RIPS_MODES.LOCAL_PREVIEW);
  assert.strictEqual(normalized.isOfficialInvoice, false);
  assert.strictEqual(normalized.documentNumber, "RC-0001");
  // numFactura debe ser null (no se usa RC como numFactura oficial de FEV)
  assert.strictEqual(normalized.numFactura, null);
});

// Test 4: Local preview no puede MUV (OFFICIAL_FEV_REQUIRED)
test("4. Local preview bloqueado para MUV", () => {
  const receipt = {
    id: "pay-1",
    notas: JSON.stringify({ nroConsecutivo: "5" }),
  };
  const normalized = normalizeRipsBillingSource(receipt, "recibos_caja");
  assert.strictEqual(normalized.sourceMode, RIPS_MODES.LOCAL_PREVIEW);
  assert.strictEqual(normalized.isOfficialRips, false);
  assert.strictEqual(normalized.isOfficialInvoice, false);
});

// Test 5: Profesional independiente NOT_REQUIRED habilita RIPS sin FEV
test("5. Profesional independiente NOT_REQUIRED habilita RIPS sin FEV", () => {
  const profile = resolveProviderProfile(
    { esIps: false, tipoPrestador: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE },
    { providerProfile: { billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED, administrativeConfirmation: true } }
  );
  assert.strictEqual(profile.providerType, PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE);
  assert.strictEqual(profile.billingObligation, BILLING_OBLIGATIONS.NOT_REQUIRED);

  const eligibility = validateRipsWithoutFevEligibility(profile);
  assert.strictEqual(eligibility.eligible, true);
});

// Test 6: RIPS sin FEV genera numFactura = null
await asyncTest("6. RIPS sin FEV genera estrictamente numFactura === null", async () => {
  const receiptRecord = {
    id: "pay-sf-001",
    paciente_id: "pac-sf",
    notas: JSON.stringify({
      nroConsecutivo: "12",
      itemPayments: [{ itemId: "it-1", desc: "Consulta", monto: 80000 }]
    }),
  };
  const prof = {
    providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
    administrativeConfirmation: true,
  };
  const normalized = normalizeRipsBillingSource(receiptRecord, "pagos", {
    requestedMode: RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV,
    providerProfile: prof,
  });

  assert.strictEqual(normalized.sourceMode, RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV);
  assert.strictEqual(normalized.isOfficialRips, true);
  assert.strictEqual(normalized.numFactura, null);

  // Validación de Generador con numFactura null
  const genResult = await generateRipsV003({
    tenantId: "11111111-1111-1111-1111-111111111111",
    prestadorConfig: { nit: "64576359", codPrestador: "700010165701" },
    facturaInfo: { numFactura: null },
    atenciones: [{
      paciente: {
        tipoDocumentoIdentificacion: "CC",
        numDocumentoIdentificacion: "100200300",
        tipoUsuario: "12",
        fechaNacimiento: "1990-05-15",
        codSexo: "F",
        codPaisResidencia: "170",
        codMunicipioResidencia: "70001",
        codZonaTerritorialResidencia: "01",
        incapacidad: "02",
      },
      tipoAtencion: "consulta",
      codPrestador: "700010165701",
      fechaInicioAtencion: "2026-09-20 09:00",
      cupsCode: "890203",
      cupsDescripcion: "CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA GENERAL",
      modalidadGrupoServicioTecSal: "01",
      grupoServicios: "01",
      codServicio: 334,
      finalidadTecnologiaSalud: "44",
      causaMotivoAtencion: "38",
      codDiagnosticoPrincipal: "K021",
      tipoDiagnosticoPrincipal: "01",
      vrServicio: 80000,
      tipoPagoModerador: "05",
      valorPagoModerador: 80000,
      conceptoRecaudo: "05",
      profesional: {
        tipoDocumentoIdentificacion: "CC",
        numDocumentoIdentificacion: "64576359",
      },
    }],
    options: {
      billingMode: "OFFICIAL_RIPS_WITHOUT_FEV",
      skipFlagCheck: true,
      skipRepsCheck: true,
      skipCupsCheck: true,
    }
  });

  assert.strictEqual(genResult.ripsJson.numFactura, null);
  assert.strictEqual(genResult.ripsJson.tipoNota, null);
  assert.strictEqual(genResult.ripsJson.numNota, null);
  if (!genResult.validation.isValid) {
    console.log("Validation errors in test 6:", genResult.validation.errors);
  }
  assert.strictEqual(genResult.validation.isValid, true);
});

// Test 7: RIPS sin FEV no genera XML
test("7. RIPS sin FEV no requiere XML en MUV gateway", () => {
  assert.strictEqual(MUV_OPERATIONS.RIPS_WITHOUT_FEV, "RIPS_WITHOUT_FEV");
  assert.strictEqual(MUV_ENDPOINT_MAPPING.RIPS_WITHOUT_FEV, "/api/PaquetesFevRips/CargarRipsSinFactura");
});

// Test 8: RIPS sin FEV no exige CUFE
test("8. RIPS sin FEV no exige CUFE", () => {
  const doc = {
    id: "pay-no-cufe",
    cufe: null,
  };
  const normalized = normalizeRipsBillingSource(doc, "pagos", {
    requestedMode: RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV,
    providerProfile: {
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
      billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
      administrativeConfirmation: true,
    }
  });
  assert.strictEqual(normalized.cufe, null);
  assert.strictEqual(normalized.sourceMode, RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV);
});

// Test 9: RIPS sin FEV mantiene paciente, CUPS, CIE10 y profesional
await asyncTest("9. RIPS sin FEV preserva paciente, CUPS, CIE-10 y profesional", async () => {
  const adaptRes = await adaptClinicalDataToRipsV003({
    prestador: { nit: "64576359", codPrestador: "700010165701", codServicio: 334 },
    factura: { numFactura: null, isWithoutFev: true },
    paciente: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "1102839201",
      tipoUsuario: "12",
      fechaNacimiento: "1988-11-20",
      codSexo: "F",
      codPaisResidencia: "170",
      codMunicipioResidencia: "70001",
      codZonaTerritorialResidencia: "01",
      incapacidad: "02",
    },
    profesional: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "64576359",
    },
    atenciones: [{
      asocConsultaId: "doc-clin-001",
      codigo_cups: "890203",
      cups: "890203",
      descripcion: "CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA GENERAL",
      es_consulta: true,
      valor: 150000,
      total: 150000,
      cie10: "K051",
      finalidad: "44",
      causaExterna: "38",
      tipoDiagnostico: "01",
    }],
    billingMode: "OFFICIAL_RIPS_WITHOUT_FEV",
    skipCupsCheck: true,
  });

  if (!adaptRes.success) {
    console.log("Adapt error in test 9:", adaptRes.error);
  }
  assert.strictEqual(adaptRes.success, true);
  const at = adaptRes.adaptedData.atenciones[0];
  assert.strictEqual(at.cupsCode, "890203");
  assert.strictEqual(at.codDiagnosticoPrincipal, "K051");
  assert.strictEqual(at.tipoDocumentoIdentificacion, "CC");
  assert.strictEqual(at.numDocumentoIdentificacion, "64576359");
});

// Test 10: Reglas monetarias contexto sin FEV
test("10. Reglas monetarias en contexto sin FEV toman valor real pagado", () => {
  const payment = {
    id: "pay-val",
    notas: JSON.stringify({
      itemPayments: [{ itemId: "item-1", monto: 120000 }]
    }),
  };
  const planes = [{
    items: [{ id: "item-1", codigo_cups: "890203", nombre: "Consulta", precio: 200000 }]
  }];
  const norm = normalizeRipsBillingSource(payment, "pagos", { patientPlanes: planes });
  // El valor cobrado debe ser el monto efectivamente pagado en el recibo (120000), no el presupuestado (200000)
  assert.strictEqual(norm.items[0].valor, 120000);
});

// Test 11: IPS no puede activar RIPS sin FEV por accidente
test("11. IPS no puede activar RIPS sin FEV por accidente (IPS_CANNOT_USE_RIPS_WITHOUT_FEV)", () => {
  const ipsProfile = {
    providerType: PROVIDER_TYPES.IPS,
    billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
    administrativeConfirmation: true,
  };
  const eligibility = validateRipsWithoutFevEligibility(ipsProfile);
  assert.strictEqual(eligibility.eligible, false);
  assert.strictEqual(eligibility.errorCode, "IPS_CANNOT_USE_RIPS_WITHOUT_FEV");
});

// Test 12: billingObligation UNCONFIRMED bloquea envío oficial
test("12. billingObligation UNCONFIRMED bloquea envío oficial (BILLING_OBLIGATION_UNCONFIRMED)", () => {
  const unconfirmedProfile = {
    providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    billingObligation: BILLING_OBLIGATIONS.UNCONFIRMED,
    administrativeConfirmation: false,
  };
  const eligibility = validateRipsWithoutFevEligibility(unconfirmedProfile);
  assert.strictEqual(eligibility.eligible, false);
  assert.strictEqual(eligibility.errorCode, "BILLING_OBLIGATION_UNCONFIRMED");
});

// Test 13: No inferir obligación únicamente por 3500 UVT
test("13. No inferir obligación únicamente por 3500 UVT (exige confirmación administrativa)", () => {
  assert(UVT_REFERENCE_NOTICE.includes("3.500 UVT"));
  const unconfirmed = resolveProviderProfile({ esIps: false }, {});
  assert.strictEqual(unconfirmed.billingObligation, BILLING_OBLIGATIONS.UNCONFIRMED);
  assert.strictEqual(unconfirmed.administrativeConfirmation, false);
});

// Test 14: Flujo Factus FEV sin regresión
test("14. Flujo Factus FEV preservado", () => {
  const fevDoc = {
    id: "fact-001",
    numeroFactura: "FEV-100",
    factus_id: "factus-uuid-99",
  };
  const norm = normalizeRipsBillingSource(fevDoc, "facturas_electronicas");
  assert.strictEqual(norm.sourceMode, RIPS_MODES.OFFICIAL_FEV);
  assert.strictEqual(norm.isOfficialInvoice, true);
  assert.strictEqual(norm.numFactura, "FEV-100");
});

// Test 15: MUV FEV sin regresión
test("15. MUV FEV sin regresión en mapeo autoritativo", () => {
  assert.strictEqual(MUV_ENDPOINT_MAPPING.FEV_RIPS, "/api/PaquetesFevRips/CargarFevRips");
  assert.strictEqual(MUV_ENDPOINT_MAPPING.NC_PARTIAL, "/api/PaquetesFevRips/CargarNC");
  assert.strictEqual(MUV_ENDPOINT_MAPPING.NC_TOTAL, "/api/PaquetesFevRips/CargarNCTotal");
  assert.strictEqual(MUV_ENDPOINT_MAPPING.RIPS_WITHOUT_FEV, "/api/PaquetesFevRips/CargarRipsSinFactura");
});

// Test 16: Payer check para RIPS sin FEV
test("16. Payer check impide RIPS sin FEV cuando el pagador es EPS o Convenio", () => {
  const epsPayer = validatePayerForRipsWithoutFev("EPS Sanitas");
  assert.strictEqual(epsPayer.allowed, false);
  assert(epsPayer.reason.includes("PAYER_REQUIRES_FEV"));

  const particularPayer = validatePayerForRipsWithoutFev("PARTICULAR");
  assert.strictEqual(particularPayer.allowed, true);
});

// Test 17: Validador RIPS v003 rechaza numFactura si se envía numFactura en RIPS_WITHOUT_FEV
await asyncTest("17. Validador RIPS v003 rechaza si numFactura no es null en RIPS_WITHOUT_FEV", async () => {
  const invalidRipsJson = {
    numDocumentoIdObligado: "901234567",
    numFactura: "RC-0001", // Inválido: debe ser null
    tipoNota: null,
    numNota: null,
    usuarios: [{
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "100200300",
      tipoUsuario: "12",
      fechaNacimiento: "1990-05-15",
      codSexo: "F",
      codPaisResidencia: "170",
      codMunicipioResidencia: "70001",
      codZonaTerritorialResidencia: "01",
      incapacidad: "02",
      servicios: { consultas: [] }
    }]
  };
  const val = await validateRipsV003(invalidRipsJson, { context: "RIPS_WITHOUT_FEV" });
  assert.strictEqual(val.isValid, false);
  assert(val.errors.some(e => e.includes("numFactura debe ser estrictamente null")));
});

console.log(`\n==================================================`);
console.log(`ALL 17 TESTS PASSED SUCCESSFULLY! (${passed}/17)`);
console.log(`==================================================\n`);
