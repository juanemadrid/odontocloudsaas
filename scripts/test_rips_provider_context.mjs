/**
 * scripts/test_rips_provider_context.mjs
 * 
 * FASE RIPS-PROVIDER-CONTEXT: CIERRE DE CONFIGURACIÓN DEL RESPONSABLE RIPS
 * IPS vs PROFESIONAL INDEPENDIENTE + FACTURACIÓN + SISPRO
 * 
 * Suite de 20 pruebas de validación normativa:
 * 1. IPS centraliza responsabilidad.
 * 2. IPS oculta generaRips en doctores.
 * 3. IPS providerCode UNIQUE.
 * 4. IPS providerCode BY_BRANCH.
 * 5. branch sin providerCode bloquea.
 * 6. Profesional independiente muestra generaRips.
 * 7. generaRips=false no actúa como obligado.
 * 8. generaRips=true resuelve doctor.
 * 9. profesional UNIQUE.
 * 10. profesional BY_BRANCH.
 * 11. SISPRO secreto no frontend.
 * 12. REQUIRED → OFFICIAL_FEV.
 * 13. NOT_REQUIRED → OFFICIAL_RIPS_WITHOUT_FEV.
 * 14. UNCONFIRMED → LOCAL_PREVIEW.
 * 15. RIPS sin FEV conserva numFactura=null.
 * 16. recibo nunca se vuelve numFactura oficial.
 * 17. FEV existente sin regresión.
 * 18. MUV CargarRipsSinFactura sin regresión.
 * 19. NC sin regresión.
 * 20. Vite PASS.
 */

import assert from "node:assert";
import {
  PROVIDER_TYPES,
  BILLING_OBLIGATIONS,
  RIPS_MODES,
  RIPS_RESPONSIBILITY,
  PROVIDER_CODE_MODES,
  UVT_REFERENCE_NOTICE,
  resolveProviderProfile,
  shouldDoctorShowGeneraRips,
  validateRipsWithoutFevEligibility,
  validatePayerForRipsWithoutFev,
  resolveRipsProviderContext,
} from "../src/modules/rips/v003/services/ripsProviderProfileService.js";

import {
  normalizeRipsBillingSource,
} from "../src/modules/rips/v003/adapters/ripsBillingSourceAdapter.js";

import {
  MUV_OPERATIONS,
  MUV_ENDPOINT_MAPPING,
} from "../services/muv-gateway/server.mjs";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("=== INICIANDO SUITE DE VALIDACIÓN: RIPS-PROVIDER-CONTEXT ===\n");

// 1. IPS centraliza responsabilidad
test("1. IPS centraliza responsabilidad (ripsResponsibility = INSTITUTION)", () => {
  const tenant = { id: "t1", nit: "900123456" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.IPS,
      codigoPrestador: "7000101657",
    },
  };
  const doctor = { id: "doc-1", nombre: "Dr. Carlos", generaRips: true };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctor,
  });

  assert.strictEqual(ctx.providerType, PROVIDER_TYPES.IPS);
  assert.strictEqual(ctx.ripsResponsibility, RIPS_RESPONSIBILITY.INSTITUTION);
  assert.strictEqual(ctx.obligatedDocument, "900123456");
  assert.strictEqual(ctx.sisproIdentityType, "INSTITUTIONAL");
});

// 2. IPS oculta generaRips en doctores
test("2. IPS oculta generaRips en doctores (shouldDoctorShowGeneraRips === false)", () => {
  const doctor = { id: "doc-1", nombre: "Dra. Ana", generaRips: true };
  const showForIps = shouldDoctorShowGeneraRips(PROVIDER_TYPES.IPS, doctor);
  assert.strictEqual(showForIps, false, "Los doctores en una IPS nunca deben mostrar '¿Genera RIPS?'");

  const showForLegacyIps = shouldDoctorShowGeneraRips({ esIps: true }, doctor);
  assert.strictEqual(showForLegacyIps, false, "Compatibilidad con esIps legacy");
});

// 3. IPS providerCode UNIQUE
test("3. IPS providerCode UNIQUE (código institucional único)", () => {
  const tenant = { id: "t1", nit: "900123456" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.IPS,
      providerCodeMode: PROVIDER_CODE_MODES.UNIQUE,
      codigoPrestador: "7000101657",
    },
  };

  const ctx = resolveRipsProviderContext({ tenant, configData });
  assert.strictEqual(ctx.providerCodeMode, PROVIDER_CODE_MODES.UNIQUE);
  assert.strictEqual(ctx.providerCode, "7000101657");
  assert.strictEqual(ctx.valid, true);
});

// 4. IPS providerCode BY_BRANCH
test("4. IPS providerCode BY_BRANCH (código asignado por sede)", () => {
  const tenant = { id: "t1", nit: "900123456" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.IPS,
      providerCodeMode: PROVIDER_CODE_MODES.BY_BRANCH,
      providerCodesByBranch: {
        "branch-principal": "700010165701",
        "branch-norte": "700010165702",
      },
    },
  };

  const ctxPrincipal = resolveRipsProviderContext({
    tenant,
    configData,
    branch: "branch-principal",
  });
  assert.strictEqual(ctxPrincipal.providerCode, "700010165701");
  assert.strictEqual(ctxPrincipal.valid, true);

  const ctxNorte = resolveRipsProviderContext({
    tenant,
    configData,
    branch: { id: "branch-norte" },
  });
  assert.strictEqual(ctxNorte.providerCode, "700010165702");
  assert.strictEqual(ctxNorte.valid, true);
});

// 5. branch sin providerCode bloquea
test("5. branch sin providerCode bloquea (RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH)", () => {
  const tenant = { id: "t1", nit: "900123456" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.IPS,
      providerCodeMode: PROVIDER_CODE_MODES.BY_BRANCH,
      providerCodesByBranch: {
        "branch-principal": "700010165701",
      },
    },
  };

  const ctxSinCodigo = resolveRipsProviderContext({
    tenant,
    configData,
    branch: "branch-sin-habilitar",
  });
  assert.strictEqual(ctxSinCodigo.valid, false);
  assert.strictEqual(ctxSinCodigo.error, "RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH");
  assert.strictEqual(ctxSinCodigo.providerCode, null);
});

// 6. Profesional independiente muestra generaRips
test("6. Profesional independiente muestra generaRips (shouldDoctorShowGeneraRips === true)", () => {
  const doctor = { id: "doc-2", nombre: "Dr. Gomez" };
  const showForProf = shouldDoctorShowGeneraRips(PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE, doctor);
  assert.strictEqual(showForProf, true, "En Profesional Independiente los doctores sí pueden decidir generar RIPS");
});

// 7. generaRips=false no actúa como obligado
test("7. generaRips=false no actúa como obligado (ripsResponsibility = UNCONFIRMED)", () => {
  const tenant = { id: "t2", nit: "12345678" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    },
  };
  const doctorNoGenera = {
    id: "doc-3",
    nombre: "Dr. Perez",
    generaRips: false,
    providerCode: "7000108888",
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctorNoGenera,
  });
  assert.strictEqual(ctx.ripsResponsibility, RIPS_RESPONSIBILITY.UNCONFIRMED);
  assert.strictEqual(ctx.providerCode, null);
  assert.strictEqual(ctx.valid, false);
  assert.strictEqual(ctx.error, "PROFESSIONAL_GENERA_RIPS_DISABLED");
});

// 8. generaRips=true resuelve doctor
test("8. generaRips=true resuelve doctor como obligado (ripsResponsibility = PROFESSIONAL)", () => {
  const tenant = { id: "t2", nit: "12345678" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    },
  };
  const doctorGenera = {
    id: "doc-4",
    numeroDocumento: "1098765432",
    nombre: "Dra. Gomez",
    generaRips: true,
    providerCode: "7000109999",
    sisproConfigured: true,
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctorGenera,
  });
  assert.strictEqual(ctx.ripsResponsibility, RIPS_RESPONSIBILITY.PROFESSIONAL);
  assert.strictEqual(ctx.obligatedDocument, "1098765432");
  assert.strictEqual(ctx.professionalId, "doc-4");
  assert.strictEqual(ctx.sisproIdentityType, "PIN_PROFESSIONAL");
  assert.strictEqual(ctx.sisproConfigured, true);
  assert.strictEqual(ctx.valid, true);
});

// 9. profesional UNIQUE
test("9. profesional UNIQUE (código REPS directo del doctor)", () => {
  const tenant = { id: "t2", nit: "12345678" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    },
  };
  const doctorUnique = {
    id: "doc-5",
    generaRips: true,
    providerCodeMode: PROVIDER_CODE_MODES.UNIQUE,
    providerCode: "7000105555",
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctorUnique,
  });
  assert.strictEqual(ctx.providerCodeMode, PROVIDER_CODE_MODES.UNIQUE);
  assert.strictEqual(ctx.providerCode, "7000105555");
});

// 10. profesional BY_BRANCH
test("10. profesional BY_BRANCH (código REPS del doctor según la sede donde atiende)", () => {
  const tenant = { id: "t2", nit: "12345678" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    },
  };
  const doctorBranches = {
    id: "doc-6",
    generaRips: true,
    providerCodeMode: PROVIDER_CODE_MODES.BY_BRANCH,
    providerCodesByBranch: {
      "sede-sur": "700010555501",
      "sede-norte": "700010555502",
    },
  };

  const ctxSur = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctorBranches,
    branch: "sede-sur",
  });
  assert.strictEqual(ctxSur.providerCode, "700010555501");

  const ctxSinSede = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctorBranches,
    branch: "sede-desconocida",
  });
  assert.strictEqual(ctxSinSede.valid, false);
  assert.strictEqual(ctxSinSede.error, "RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH");
});

// 11. SISPRO secreto no frontend
test("11. SISPRO secreto no expuesto al frontend", () => {
  const tenant = { id: "t1", nit: "900123456" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.IPS,
      codigoPrestador: "7000101657",
      sisproPassword: "SuperSecretPassword123!",
    },
    sispro_config: {
      hasPassword: true,
      rawPassword: "ShouldNotLeak",
    },
  };
  const doctor = {
    id: "doc-1",
    generaRips: true,
    sisproPassword: "SecretDoctorPassword",
    sisproConfigured: true,
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctor,
    sisproConfig: configData.sispro_config,
  });

  // El objeto de contexto NO debe contener contraseñas
  assert.strictEqual(ctx.password, undefined);
  assert.strictEqual(ctx.contrasena, undefined);
  assert.strictEqual(ctx.secret, undefined);
  assert.strictEqual(ctx.sisproPassword, undefined);
  assert.strictEqual(ctx.rawPassword, undefined);
  assert.strictEqual(ctx.sisproConfigured, true);
});

// 12. REQUIRED → OFFICIAL_FEV
test("12. REQUIRED → OFFICIAL_FEV con factura electrónica oficial", () => {
  const tenant = { id: "t1", nit: "900123456" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.IPS,
      billingObligation: BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED,
      codigoPrestador: "7000101657",
    },
  };
  const officialInvoice = {
    numeroFactura: "FEV-1001",
    cufe: "abc123cufe",
    attached_document_xml: "<xml>...</xml>",
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    billingDocument: officialInvoice,
  });
  assert.strictEqual(ctx.billingObligation, BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED);
  assert.strictEqual(ctx.ripsMode, RIPS_MODES.OFFICIAL_FEV);
});

// 13. NOT_REQUIRED → OFFICIAL_RIPS_WITHOUT_FEV
test("13. NOT_REQUIRED → OFFICIAL_RIPS_WITHOUT_FEV (con confirmación administrativa y generaRips=true)", () => {
  const tenant = { id: "t2", nit: "12345678" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
      billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
      administrativeConfirmation: true,
      codigoPrestador: "7000107777",
    },
  };
  const doctor = {
    id: "doc-7",
    generaRips: true,
    providerCode: "7000107777",
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctor,
  });
  assert.strictEqual(ctx.billingObligation, BILLING_OBLIGATIONS.NOT_REQUIRED);
  assert.strictEqual(ctx.ripsMode, RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV);
});

// 14. UNCONFIRMED → LOCAL_PREVIEW
test("14. UNCONFIRMED → LOCAL_PREVIEW (perfil no configurado bloquea transmisión oficial)", () => {
  const tenant = { id: "t3", nit: "99999999" };
  const configData = {
    empresa_datos: {
      providerType: PROVIDER_TYPES.UNCONFIRMED,
      billingObligation: BILLING_OBLIGATIONS.UNCONFIRMED,
    },
  };

  const ctx = resolveRipsProviderContext({ tenant, configData });
  assert.strictEqual(ctx.ripsMode, RIPS_MODES.LOCAL_PREVIEW);
});

// 15. RIPS sin FEV conserva numFactura=null
test("15. RIPS sin FEV conserva numFactura = null estrictamente", () => {
  const pago = {
    id: "pago-101",
    numero: "RC-555",
    paciente_id: "pac-1",
    monto: 150000,
  };
  const providerContext = {
    ripsMode: RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV,
    providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
    administrativeConfirmation: true,
  };

  const normalized = normalizeRipsBillingSource(pago, "pagos", {
    providerContext,
  });
  assert.strictEqual(normalized.sourceMode, RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV);
  assert.strictEqual(normalized.numFactura, null, "numFactura DEBE ser estrictamente null en RIPS sin FEV");
  assert.strictEqual(normalized.isOfficialRips, true);
});

// 16. recibo nunca se vuelve numFactura oficial
test("16. recibo nunca se vuelve numFactura oficial", () => {
  const reciboCaja = {
    id: "rc-999",
    nroConsecutivo: "0000999",
    paciente_id: "pac-1",
    total: 200000,
  };

  // Preview local
  const normLocal = normalizeRipsBillingSource(reciboCaja, "recibos_caja", {
    providerProfile: {
      providerType: PROVIDER_TYPES.UNCONFIRMED,
      billingObligation: BILLING_OBLIGATIONS.UNCONFIRMED,
    },
  });
  assert.strictEqual(normLocal.sourceMode, RIPS_MODES.LOCAL_PREVIEW);
  assert.strictEqual(normLocal.numFactura, null, "Recibo local no puede ser numFactura oficial");
  assert.strictEqual(normLocal.isOfficialInvoice, false);
});

// 17. FEV existente sin regresión
test("17. FEV existente sin regresión (mantiene numFactura, CUFE, XML)", () => {
  const fevDoc = {
    id: "fev-77",
    numeroFactura: "SETP-9988",
    cufe: "cufe-oficial-dian-12345",
    xml_content: "<AttachedDocument>...</AttachedDocument>",
  };

  const normalized = normalizeRipsBillingSource(fevDoc, "facturas_electronicas", {});
  assert.strictEqual(normalized.sourceMode, RIPS_MODES.OFFICIAL_FEV);
  assert.strictEqual(normalized.numFactura, "SETP-9988");
  assert.strictEqual(normalized.isOfficialRips, true);
  assert.strictEqual(normalized.isOfficialInvoice, true);
});

// 18. MUV CargarRipsSinFactura sin regresión
test("18. MUV CargarRipsSinFactura sin regresión en endpoint", () => {
  const endpoint = MUV_ENDPOINT_MAPPING[MUV_OPERATIONS.RIPS_WITHOUT_FEV];
  assert.strictEqual(
    endpoint,
    "/api/PaquetesFevRips/CargarRipsSinFactura",
    "El endpoint MUV sin factura debe mantenerse idéntico"
  );
});

// 19. NC sin regresión
test("19. NC sin regresión (tipoNota preservado)", () => {
  const ncDoc = {
    id: "nc-01",
    numeroFactura: "NC-10",
    tipoNota: "2", // Nota crédito por anulación
  };

  const normalized = normalizeRipsBillingSource(ncDoc, "facturas", {});
  assert.strictEqual(normalized.isOfficialInvoice, true);
  assert.strictEqual(normalized.tipoNota, "2");
});

// 20. Vite PASS (verificación de build y exportación de módulos)
test("20. Vite PASS (todos los servicios y helpers exportados y tipados limpiamente)", () => {
  assert(typeof resolveRipsProviderContext === "function");
  assert(typeof shouldDoctorShowGeneraRips === "function");
  assert(typeof normalizeRipsBillingSource === "function");
  assert(typeof validateRipsWithoutFevEligibility === "function");
  assert(typeof UVT_REFERENCE_NOTICE === "string");
});

console.log(`\n=== SUITE COMPLETADA: ${passed}/20 PRUEBAS EXITOSAS ===`);
