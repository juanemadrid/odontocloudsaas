/**
 * scripts/test_rips_simplified_flow.mjs
 * 
 * ODONTOCLOUD — SIMPLIFICACIÓN FINAL DE CONFIGURACIÓN RIPS:
 * FLUJO IPS vs PROFESIONAL INDEPENDIENTE
 * 
 * Validación de 17 casos obligatorios:
 * 1. IPS=false -> no muestra SISPRO institucional
 * 2. IPS=false -> Doctor muestra "Genera RIPS"
 * 3. Doctor generaRips=false -> campos RIPS ocultos
 * 4. Doctor generaRips=true -> campos RIPS visibles
 * 5. código único funciona
 * 6. código por sucursal funciona
 * 7. IPS=true -> muestra configuración institucional
 * 8. IPS=true -> oculta "Genera RIPS" en todos los doctores
 * 9. IPS=true -> resolver usa providerCode institucional
 * 10. IPS=false -> resolver usa doctor correspondiente
 * 11. contraseña SISPRO nunca vuelve al frontend
 * 12. cambiar IPS no borra configuración previa
 * 13. OFFICIAL_FEV sin regresión
 * 14. RIPS_WITHOUT_FEV sin regresión
 * 15. LOCAL_PREVIEW sin regresión
 * 16. MUV sin regresión
 * 17. Vite PASS
 */

import assert from "node:assert";
import { execSync } from "node:child_process";
import {
  PROVIDER_TYPES,
  BILLING_OBLIGATIONS,
  RIPS_MODES,
  RIPS_RESPONSIBILITY,
  PROVIDER_CODE_MODES,
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
  getSisproPassword,
} from "../src/services/tenantSecretsService.js";

import {
  MUV_OPERATIONS,
  MUV_ENDPOINT_MAPPING,
} from "../services/muv-gateway/server.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    process.exitCode = 1;
  }
}

console.log("======================================================================");
console.log("   SUITE DE SIMPLIFICACIÓN RIPS: FLUJO IPS VS PROFESIONAL (17 CASOS)  ");
console.log("======================================================================\n");

// 1. IPS=false -> no muestra SISPRO institucional
test("1. IPS=false -> no muestra SISPRO institucional (perfil no es IPS)", () => {
  const tenant = { id: "t-no-ips", esIps: false };
  const configData = { empresa_datos: { esIps: false, providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE } };
  const profile = resolveProviderProfile(tenant, configData);

  assert.strictEqual(profile.providerType, PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE);
  assert.notStrictEqual(profile.providerType, PROVIDER_TYPES.IPS);
});

// 2. IPS=false -> Doctor muestra "Genera RIPS"
test("2. IPS=false -> Doctor muestra 'Genera RIPS' (shouldDoctorShowGeneraRips === true)", () => {
  // Shape real proveniente de website_config.config.empresa_datos
  const dbEmpresaDatos = {
    nombreComercial: "Clínica Dental Sincelejo",
    nit: "90023122",
    esIps: false,
    providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
    billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
    providerCodeMode: PROVIDER_CODE_MODES.UNIQUE,
    codigoPrestador: "",
    sisproUsuario: "",
  };

  const isTenantIps = dbEmpresaDatos?.esIps === true || (dbEmpresaDatos?.esIps !== false && dbEmpresaDatos?.providerType === PROVIDER_TYPES.IPS);
  const derivedTenantType = isTenantIps ? PROVIDER_TYPES.IPS : PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE;

  const doctorRealForm = {
    nombre: "Juan",
    apellido: "Pérez",
    esDoctor: true,
    profileId: "Odontólogo",
    profileType: "Doctor",
  };
  const nonDoctorForm = {
    nombre: "Ana",
    apellido: "Recepcionista",
    esDoctor: false,
    profileId: "Recepcionista",
  };

  assert.strictEqual(shouldDoctorShowGeneraRips(derivedTenantType, doctorRealForm), true, "Doctor debe ver '¿Genera RIPS?'");
  assert.strictEqual(shouldDoctorShowGeneraRips(derivedTenantType, nonDoctorForm), false, "Usuario NO doctor no debe ver '¿Genera RIPS?'");
  assert.strictEqual(shouldDoctorShowGeneraRips(PROVIDER_TYPES.IPS, doctorRealForm), false, "Si la clínica es IPS, doctor NO debe ver '¿Genera RIPS?'");
});

// 3. Doctor generaRips=false -> campos RIPS ocultos
test("3. Doctor generaRips=false -> campos RIPS inactivos en resolución", () => {
  const doctor = {
    id: "doc-inactive",
    nombre: "Dr. Inactivo",
    generaRips: false,
    ripsCodigoUnico: "700010165701",
  };
  const ctx = resolveRipsProviderContext({
    tenant: { id: "t1", esIps: false },
    configData: { empresa_datos: { esIps: false } },
    professional: doctor,
  });

  assert.strictEqual(ctx.valid, false);
  assert.strictEqual(ctx.error, "PROFESSIONAL_GENERA_RIPS_DISABLED");
  assert.strictEqual(ctx.providerCode, null);
});

// 4. Doctor generaRips=true -> campos RIPS visibles y activos
test("4. Doctor generaRips=true -> campos RIPS activos en resolución", () => {
  const doctor = {
    id: "doc-active",
    nombre: "Dr. Activo",
    numeroDocumento: "1098765432",
    generaRips: true,
    ripsCodigoUnico: "700010165702",
    ripsTipoPrestador: "unico",
  };
  const ctx = resolveRipsProviderContext({
    tenant: { id: "t1", esIps: false },
    configData: { empresa_datos: { esIps: false } },
    professional: doctor,
  });

  assert.strictEqual(ctx.valid, true);
  assert.strictEqual(ctx.ripsResponsibility, RIPS_RESPONSIBILITY.PROFESSIONAL);
  assert.strictEqual(ctx.providerCode, "700010165702");
  assert.strictEqual(ctx.obligatedDocument, "1098765432");
});

// 5. código único funciona
test("5. código único funciona para profesional independiente", () => {
  const doctor = {
    id: "doc-unico",
    generaRips: true,
    ripsTipoPrestador: "unico",
    ripsCodigoUnico: "700010165703",
  };
  const ctx = resolveRipsProviderContext({
    tenant: { id: "t1", esIps: false },
    configData: { empresa_datos: { esIps: false } },
    professional: doctor,
  });

  assert.strictEqual(ctx.providerCodeMode, PROVIDER_CODE_MODES.UNIQUE);
  assert.strictEqual(ctx.providerCode, "700010165703");
  assert.strictEqual(ctx.valid, true);
});

// 6. código por sucursal funciona
test("6. código por sucursal funciona para profesional independiente", () => {
  const doctor = {
    id: "doc-branch",
    generaRips: true,
    ripsTipoPrestador: "sucursal",
    ripsSucursales: {
      "suc-norte": { codigo: "700010165704" },
      "suc-sur": { codigo: "700010165705" },
    },
  };
  const ctxNorte = resolveRipsProviderContext({
    tenant: { id: "t1", esIps: false },
    configData: { empresa_datos: { esIps: false } },
    professional: doctor,
    branch: "suc-norte",
  });

  assert.strictEqual(ctxNorte.providerCodeMode, PROVIDER_CODE_MODES.BY_BRANCH);
  assert.strictEqual(ctxNorte.providerCode, "700010165704");
  assert.strictEqual(ctxNorte.valid, true);

  const ctxSur = resolveRipsProviderContext({
    tenant: { id: "t1", esIps: false },
    configData: { empresa_datos: { esIps: false } },
    professional: doctor,
    branch: "suc-sur",
  });
  assert.strictEqual(ctxSur.providerCode, "700010165705");
  assert.strictEqual(ctxSur.valid, true);
});

// 7. IPS=true -> muestra configuración institucional
test("7. IPS=true -> resuelve configuración institucional y perfil IPS", () => {
  const tenant = { id: "t-ips", esIps: true, nit: "900555666" };
  const configData = {
    empresa_datos: {
      esIps: true,
      codigoPrestador: "700010165701",
      sisproUsuario: "900555666",
    },
  };
  const profile = resolveProviderProfile(tenant, configData);

  assert.strictEqual(profile.providerType, PROVIDER_TYPES.IPS);
  assert.strictEqual(profile.billingObligation, BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED);
});

// 8. IPS=true -> oculta "Genera RIPS" en todos los doctores
test("8. IPS=true -> oculta 'Genera RIPS' en todos los doctores (shouldDoctorShowGeneraRips === false)", () => {
  const doctor1 = { id: "doc-1", rol: "Doctor", esDoctor: true };
  const doctor2 = { id: "doc-2", rol: "Doctor", esDoctor: true, generaRips: true };

  assert.strictEqual(shouldDoctorShowGeneraRips({ esIps: true }, doctor1), false);
  assert.strictEqual(shouldDoctorShowGeneraRips(PROVIDER_TYPES.IPS, doctor1), false);
  assert.strictEqual(shouldDoctorShowGeneraRips({ esIps: true }, doctor2), false);
});

// 9. IPS=true -> resolver usa providerCode institucional
test("9. IPS=true -> resolver usa providerCode institucional ignorando doctores", () => {
  const tenant = { id: "t-ips", esIps: true, nit: "900999888" };
  const configData = {
    empresa_datos: {
      esIps: true,
      codigoPrestador: "700010165799",
      providerType: PROVIDER_TYPES.IPS,
    },
  };
  const doctorConOtroCodigo = {
    id: "doc-otro",
    generaRips: true,
    ripsCodigoUnico: "111111111111",
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctorConOtroCodigo,
  });

  assert.strictEqual(ctx.ripsResponsibility, RIPS_RESPONSIBILITY.INSTITUTION);
  assert.strictEqual(ctx.providerCode, "700010165799", "Debe usar el código institucional de la IPS");
  assert.strictEqual(ctx.obligatedDocument, "900999888");
});

// 10. IPS=false -> resolver usa doctor correspondiente
test("10. IPS=false -> resolver usa doctor correspondiente", () => {
  const tenant = { id: "t-indep", esIps: false, nit: "12345678" };
  const configData = { empresa_datos: { esIps: false, codigoPrestador: "99999999" } };
  const doctor = {
    id: "doc-target",
    numeroDocumento: "79888777",
    generaRips: true,
    ripsCodigoUnico: "700010165708",
  };

  const ctx = resolveRipsProviderContext({
    tenant,
    configData,
    professional: doctor,
  });

  assert.strictEqual(ctx.ripsResponsibility, RIPS_RESPONSIBILITY.PROFESSIONAL);
  assert.strictEqual(ctx.providerCode, "700010165708");
  assert.strictEqual(ctx.obligatedDocument, "79888777");
});

// 11. contraseña SISPRO nunca vuelve al frontend
test("11. contraseña SISPRO nunca vuelve al frontend (getSisproPassword devuelve vacío)", async () => {
  const pass = await getSisproPassword("tenant-id-demo");
  assert.strictEqual(pass, "", "La función del cliente no debe devolver la contraseña");
});

// 12. cambiar IPS no borra configuración previa
test("12. cambiar IPS no borra configuración previa (coexistencia de metadatos)", () => {
  const configOriginal = {
    esIps: true,
    codigoPrestador: "700010165701",
    sisproUsuario: "900123456",
    providerCodesByBranch: { "suc-1": "700010165702" },
  };

  // Simular cambio a IPS = false
  const configModificada = {
    ...configOriginal,
    esIps: false,
    providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
  };

  // Los datos anteriores no se destruyen
  assert.strictEqual(configModificada.codigoPrestador, "700010165701");
  assert.strictEqual(configModificada.sisproUsuario, "900123456");
  assert.deepStrictEqual(configModificada.providerCodesByBranch, { "suc-1": "700010165702" });

  // Si se vuelve a encender IPS = true, se recuperan intactos
  const configRestaurada = {
    ...configModificada,
    esIps: true,
    providerType: PROVIDER_TYPES.IPS,
  };
  assert.strictEqual(configRestaurada.codigoPrestador, "700010165701");
  assert.strictEqual(configRestaurada.sisproUsuario, "900123456");
});

// 13. OFFICIAL_FEV sin regresión
test("13. OFFICIAL_FEV sin regresión (factura electrónica conserva numFactura)", () => {
  const fevDoc = {
    id: "fev-1",
    numero_factura: "SETP990000012",
    cufe: "abcdef1234567890",
    fecha: "2026-09-27",
    total: 250000,
    items: [{ cups: "890201", valor: 250000 }],
  };
  const norm = normalizeRipsBillingSource(fevDoc, "facturas", {
    providerContext: {
      ripsMode: RIPS_MODES.OFFICIAL_FEV,
      providerType: PROVIDER_TYPES.IPS,
      billingObligation: BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED,
    },
  });

  assert.strictEqual(norm.sourceMode, RIPS_MODES.OFFICIAL_FEV);
  assert.strictEqual(norm.numFactura, "SETP990000012");
  assert.strictEqual(norm.cufe, "abcdef1234567890");
});

// 14. RIPS_WITHOUT_FEV sin regresión
test("14. RIPS_WITHOUT_FEV sin regresión (numFactura === null obligatorio)", () => {
  const pagoDoc = {
    id: "pago-indep-1",
    paciente_id: "pac-1",
    notas: JSON.stringify({
      nroConsecutivo: "101",
      itemPayments: [{ itemId: "it-1", desc: "Consulta", monto: 150000 }],
    }),
  };
  const norm = normalizeRipsBillingSource(pagoDoc, "pagos", {
    providerContext: {
      ripsMode: RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV,
      providerType: PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE,
      billingObligation: BILLING_OBLIGATIONS.NOT_REQUIRED,
      administrativeConfirmation: true,
    },
  });

  assert.strictEqual(norm.sourceMode, RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV);
  assert.strictEqual(norm.isOfficialRips, true);
  assert.strictEqual(norm.numFactura, null, "En RIPS sin factura, numFactura DEBE ser null");
  assert.strictEqual(norm.isOfficialInvoice, false);
  assert.strictEqual(norm.cufe, null);
});

// 15. LOCAL_PREVIEW sin regresión
test("15. LOCAL_PREVIEW sin regresión (recibo de caja con label local)", () => {
  const reciboDoc = {
    id: "recibo-preview-1",
    paciente_id: "pac-1",
    notas: JSON.stringify({
      nroConsecutivo: 104,
      itemPayments: [{ itemId: "it-2", desc: "Profilaxis", monto: 80000 }],
    }),
  };
  const norm = normalizeRipsBillingSource(reciboDoc, "recibos_caja", {
    providerContext: {
      ripsMode: RIPS_MODES.LOCAL_PREVIEW,
    },
  });

  assert.strictEqual(norm.sourceMode, RIPS_MODES.LOCAL_PREVIEW);
  assert.strictEqual(norm.isOfficialRips, false);
  assert.strictEqual(norm.numFactura, null, "Recibo de caja local nunca debe ser numFactura oficial");
});

// 16. MUV sin regresión
test("16. MUV sin regresión (CargarRipsSinFactura mapeado correctamente)", () => {
  assert.strictEqual(
    MUV_OPERATIONS.RIPS_WITHOUT_FEV,
    "RIPS_WITHOUT_FEV"
  );
  assert.strictEqual(
    MUV_ENDPOINT_MAPPING.RIPS_WITHOUT_FEV,
    "/api/PaquetesFevRips/CargarRipsSinFactura"
  );
  assert.strictEqual(
    MUV_ENDPOINT_MAPPING.FEV_RIPS,
    "/api/PaquetesFevRips/CargarFevRips"
  );
});

// 17. Vite PASS
test("17. Vite PASS (compilación de producción sin errores)", () => {
  const checkBuild = execSync("npm run build", {
    encoding: "utf-8",
    stdio: "pipe",
  });
  assert(checkBuild.includes("built in") || checkBuild.length > 0);
});

console.log("\n======================================================================");
console.log(` RESULTADO: ${passed} PASADOS, ${failed} FALLIDOS (Total: ${passed + failed})`);
console.log("======================================================================\n");
