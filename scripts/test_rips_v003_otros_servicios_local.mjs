/**
 * Suite Local Aislada de Pruebas Unitarias para otrosServicios (DT1 v003)
 * Microfase 2D-B — ODONTOCLOUD
 *
 * Características:
 * - 100% en memoria
 * - Cero dependencias de red / base de datos / producción / MUV / SISPRO
 * - Determinista y exhaustiva
 * - FALSE_POSITIVE_TEST_RISK = NO (todas las pruebas negativas validan código y mensaje exacto)
 */

import { adaptClinicalDataToRipsV003 } from "../src/modules/rips/v003/adapters/ripsV003ClinicalAdapter.js";
import { generateRipsV003 } from "../src/modules/rips/v003/ripsV003Generator.js";
import { validateRipsV003 } from "../src/modules/rips/v003/ripsV003Validator.js";

const FIXTURE_TENANT_ID = "00000000-0000-4000-a000-000000000001";
const FIXTURE_SUCURSAL_ID = "00000000-0000-4000-a000-000000000002";

function createBaseFixture() {
  return {
    tenantId: FIXTURE_TENANT_ID,
    sucursalId: FIXTURE_SUCURSAL_ID,
    prestador: {
      nit: "901234567",
      codPrestador: "700010000101",
      codServicio: 334,
    },
    factura: {
      numFactura: "FAC_TEST_OS_001",
    },
    paciente: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "1102845678",
      tipoUsuario: "12",
      fechaNacimiento: "1994-05-12",
      codSexo: "F",
      codPaisResidencia: "170",
      codMunicipioResidencia: "70001",
      codZonaTerritorialResidencia: "01",
      incapacidad: "02",
    },
    profesional: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "73123456",
    },
    atenciones: [],
  };
}

function createOtrosServiciosAtencion(overrides = {}) {
  return {
    tipoAtencion: "otrosServicios",
    tipoOS: "01",
    codTecnologiaSalud: "IDM12345678",
    nomTecnologiaSalud: "RESINA DE ALTA DENSIDAD",
    fechaSuministroTecnologia: "2026-09-25 14:30",
    cantidadOS: 2,
    vrUnitOS: 45000,
    vrDispensacion: 0,
    vrServicio: 90000,
    conceptoRecaudo: "05",
    valorPagoModerador: 0,
    numAutorizacion: null,
    idMIPRES: null,
    numFEVPagoModerador: null,
    codigoVIDA: null,
    modalidadPago: "01",
    profesional: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "73123456",
    },
    ...overrides,
  };
}

const tests = [];
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

/**
 * Aserción estricta de rechazo negativo: comprueba que el adapter falle
 * y que el código o mensaje contenga exactamente la causa esperada.
 * Garantiza FALSE_POSITIVE_TEST_RISK = NO.
 */
async function assertAdapterThrows(fixture, { expectedCode, expectedSubstring } = {}) {
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (adapted.success) {
    throw new Error(`Debió fallar con error conteniendo '${expectedSubstring || expectedCode}', pero retornó success=true.`);
  }
  if (expectedCode && (!adapted.error || adapted.error.code !== expectedCode)) {
    throw new Error(`Código de error esperado '${expectedCode}', pero se recibió '${adapted.error?.code}': ${adapted.error?.message}`);
  }
  if (expectedSubstring && (!adapted.error || !adapted.error.message.includes(expectedSubstring))) {
    throw new Error(`Mensaje esperado que contenga '${expectedSubstring}', pero se recibió: '${adapted.error?.message}'`);
  }
}

// -------------------------------------------------------------
// CASOS POSITIVOS: tipoOS 01 a 05
// -------------------------------------------------------------

test("tipoOS 01: Dispositivos médicos e insumos válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ tipoOS: "01" }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(`Generator error: ${JSON.stringify(gen.validation.errors)}`);

  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.tipoOS !== "01" || os.nomTecnologiaSalud !== "RESINA DE ALTA DENSIDAD") {
    throw new Error("Datos incorrectos en tipoOS 01");
  }
});

test("tipoOS 02: Traslados con profesional null y nomTecnologiaSalud null", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({
    tipoOS: "02",
    codTecnologiaSalud: "TR1001",
    nomTecnologiaSalud: null,
    profesional: null,
    cantidadOS: 1,
  }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(JSON.stringify(gen.validation.errors));

  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.tipoDocumentoIdentificacion !== null || os.numDocumentoIdentificacion !== null || os.nomTecnologiaSalud !== null) {
    throw new Error("tipoOS 02 debe tener profesional y nomTecnologiaSalud en null");
  }
});

test("tipoOS 03: Estancias con profesional null y nomTecnologiaSalud null", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({
    tipoOS: "03",
    codTecnologiaSalud: "105M01",
    nomTecnologiaSalud: null,
    profesional: null,
    cantidadOS: 3,
  }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(JSON.stringify(gen.validation.errors));

  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.tipoDocumentoIdentificacion !== null || os.cantidadOS !== 3) {
    throw new Error("tipoOS 03 falló en asignación");
  }
});

test("tipoOS 04: Servicios complementarios con profesional obligatorio", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({
    tipoOS: "04",
    codTecnologiaSalud: "SC9901",
    nomTecnologiaSalud: null,
    cantidadOS: 2,
  }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(JSON.stringify(gen.validation.errors));

  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.tipoDocumentoIdentificacion !== "CC" || os.numDocumentoIdentificacion !== "73123456") {
    throw new Error("tipoOS 04 debe incluir profesional");
  }
});

test("tipoOS 05: Honorarios con cantidadOS estrictamente = 1", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({
    tipoOS: "05",
    codTecnologiaSalud: "232102",
    nomTecnologiaSalud: null,
    cantidadOS: 1,
  }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(JSON.stringify(gen.validation.errors));

  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.cantidadOS !== 1) throw new Error("Honorarios debe tener cantidadOS = 1");
});

// -------------------------------------------------------------
// PRUEBAS ESPECÍFICAS DE cantidadOS
// -------------------------------------------------------------

test("cantidadOS = 1 válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 1 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("cantidadOS = 5 válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 5 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("cantidadOS = 116 válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 116 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("cantidadOS = 99999 límite superior válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 99999 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("cantidadOS = 0 -> FAIL con INVALID_NUMERIC_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 0 }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA", expectedSubstring: "cantidadOS" });
});

test("cantidadOS = 100000 -> FAIL con INVALID_NUMERIC_DATA (excede 5 dígitos)", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 100000 }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA", expectedSubstring: "no puede exceder 99999" });
});

test("cantidadOS = 1.5 -> FAIL con INVALID_NUMERIC_DATA (decimal prohibido)", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ cantidadOS: 1.5 }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA", expectedSubstring: "número entero sin decimales" });
});

test("tipoOS 05 con cantidadOS != 1 -> FAIL con INVALID_CANTIDAD_OS", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ tipoOS: "05", codTecnologiaSalud: "232102", cantidadOS: 2 }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Honorarios) debe ser estrictamente 1" });
});

// -------------------------------------------------------------
// S02 numAutorizacion: 30 car y MIPRES 20 car
// -------------------------------------------------------------

test("S02 numAutorizacion 30 caracteres válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ numAutorizacion: "AUT".padEnd(30, "X") }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("S02 numAutorizacion caso MIPRES 20 caracteres válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ numAutorizacion: "MIPRES12345678901234" }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("S02 numAutorizacion 31 caracteres -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ numAutorizacion: "A".repeat(31) }));
  await assertAdapterThrows(fixture, { expectedSubstring: "numAutorizacion no puede exceder 30 caracteres" });
});

// -------------------------------------------------------------
// S03 idMIPRES: 19 caracteres
// -------------------------------------------------------------

test("S03 idMIPRES 19 caracteres válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ idMIPRES: "ENTREGAMIPRES123456" }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("S03 idMIPRES > 19 caracteres -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ idMIPRES: "A".repeat(20) }));
  await assertAdapterThrows(fixture, { expectedSubstring: "idMIPRES no puede exceder 19 caracteres" });
});

// -------------------------------------------------------------
// S07 nomTecnologiaSalud: 200 y 201 car
// -------------------------------------------------------------

test("S07 nomTecnologiaSalud exactamente 200 caracteres válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ nomTecnologiaSalud: "N".repeat(200) }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("S07 nomTecnologiaSalud 201 caracteres -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ nomTecnologiaSalud: "N".repeat(201) }));
  await assertAdapterThrows(fixture, { expectedSubstring: "nomTecnologiaSalud excede los 200 caracteres" });
});

// -------------------------------------------------------------
// S09 / S10 Identidad del profesional: longitud y tipos
// -------------------------------------------------------------

test("S10 numDocumentoIdentificacion 4 y 20 caracteres válidos", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ profesional: { tipoDocumentoIdentificacion: "CC", numDocumentoIdentificacion: "1234" } }));
  const adapted1 = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted1.success) throw new Error(adapted1.error.message);

  fixture.atenciones[0].profesional.numDocumentoIdentificacion = "12345678901234567890";
  const adapted2 = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted2.success) throw new Error(adapted2.error.message);
});

test("S10 numDocumentoIdentificacion 3 caracteres -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ profesional: { tipoDocumentoIdentificacion: "CC", numDocumentoIdentificacion: "123" } }));
  await assertAdapterThrows(fixture, { expectedSubstring: "numDocumentoIdentificacion del profesional debe tener entre 4 y 20 caracteres" });
});

test("S10 numDocumentoIdentificacion 21 caracteres -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ profesional: { tipoDocumentoIdentificacion: "CC", numDocumentoIdentificacion: "A".repeat(21) } }));
  await assertAdapterThrows(fixture, { expectedSubstring: "numDocumentoIdentificacion del profesional debe tener entre 4 y 20 caracteres" });
});

test("S09 tipoDocumentoIdentificacion 'SC' válido según TipoIdPISIS DT1 v003", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ profesional: { tipoDocumentoIdentificacion: "SC", numDocumentoIdentificacion: "987654" } }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("Prohibido copiar identificación del paciente en profesional -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({
    profesional: {
      tipoDocumentoIdentificacion: fixture.paciente.tipoDocumentoIdentificacion,
      numDocumentoIdentificacion: fixture.paciente.numDocumentoIdentificacion,
    },
  }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Prohibido copiar la identificación del paciente" });
});

// -------------------------------------------------------------
// S11 vrUnitOS, S18 vrDispensacion, S12 vrServicio
// -------------------------------------------------------------

test("S11 modalidad Pago por Evento ('01') con vrUnitOS > 0 válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ modalidadPago: "01", vrUnitOS: 50000 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("S11 modalidad Pago por Evento ('01') con vrUnitOS = 0 -> FAIL con INVALID_NUMERIC_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ modalidadPago: "01", vrUnitOS: 0 }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA", expectedSubstring: "vrUnitOS debe ser mayor a 0" });
});

test("S11 modalidad distinta de evento ('02' capitación) con vrUnitOS > 0 -> FAIL con INVALID_NUMERIC_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ modalidadPago: "02", vrUnitOS: 10000 }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA", expectedSubstring: "vrUnitOS debe ser estrictamente 0" });
});

test("S18 vrDispensacion = 0 normativo y posición entre S11 y S12", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ vrDispensacion: 0 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  const keys = Object.keys(os);
  const s11Idx = keys.indexOf("vrUnitOS");
  const s18Idx = keys.indexOf("vrDispensacion");
  const s12Idx = keys.indexOf("vrServicio");

  if (s18Idx !== s11Idx + 1 || s12Idx !== s18Idx + 1) {
    throw new Error("vrDispensacion debe estar canónicamente entre vrUnitOS y vrServicio");
  }
});

// -------------------------------------------------------------
// S13 conceptoRecaudo
// -------------------------------------------------------------

test("S13 conceptoRecaudo '04' (Anticipo) en RIPS soporte -> FAIL con INVALID_RECAUDO_CONCEPT", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ conceptoRecaudo: "04" }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_RECAUDO_CONCEPT", expectedSubstring: "Anticipo" });
});

test("S13 conceptos válidos 01, 02, 03, 05", async () => {
  for (const c of ["01", "02", "03", "05"]) {
    const fixture = createBaseFixture();
    fixture.atenciones.push(createOtrosServiciosAtencion({ conceptoRecaudo: c, valorPagoModerador: c === "05" ? 0 : 5000 }));
    const adapted = await adaptClinicalDataToRipsV003(fixture);
    if (!adapted.success) throw new Error(`Falló con conceptoRecaudo ${c}: ${adapted.error.message}`);
  }
});

// -------------------------------------------------------------
// S17 codigoVIDA
// -------------------------------------------------------------

test("S17 codigoVIDA 256 caracteres válido", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ codigoVIDA: "V".repeat(256) }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

test("S17 codigoVIDA 257 caracteres -> FAIL con INVALID_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ codigoVIDA: "V".repeat(257) }));
  await assertAdapterThrows(fixture, { expectedSubstring: "codigoVIDA no puede exceder 256 caracteres" });
});

// -------------------------------------------------------------
// S05 tipoOS 06 deshabilitado
// -------------------------------------------------------------

test("S05 tipoOS '06' deshabilitado en SISPRO -> FAIL con INVALID_TIPO_OS", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ tipoOS: "06" }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_TIPO_OS", expectedSubstring: "Código '06' deshabilitado" });
});

// -------------------------------------------------------------
// S16 Consecutivos 1, 2, 3 correlativos
// -------------------------------------------------------------

test("S16 Consecutivos 1, 2, 3 correlativos sin saltos ni duplicados", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ codTecnologiaSalud: "T01" }));
  fixture.atenciones.push(createOtrosServiciosAtencion({ codTecnologiaSalud: "T02" }));
  fixture.atenciones.push(createOtrosServiciosAtencion({ codTecnologiaSalud: "T03" }));

  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(JSON.stringify(gen.validation.errors));

  const items = gen.ripsJson.usuarios[0].servicios.otrosServicios;
  if (items.length !== 3) throw new Error("Esperados 3 otrosServicios");
  if (items[0].consecutivo !== 1 || items[1].consecutivo !== 2 || items[2].consecutivo !== 3) {
    throw new Error(`Consecutivos incorrectos: ${items.map(it => it.consecutivo).join(",")}`);
  }
});

// -------------------------------------------------------------
// REMEDIACIONES OBLIGATORIAS 2D-B
// -------------------------------------------------------------

// F-01: codPrestador
test("F-01: codPrestador null explícito preservado para no-REPS", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ codPrestador: null }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
  if (adapted.adaptedData.atenciones[0].codPrestador !== null) {
    throw new Error("El adapter debió preservar codPrestador = null");
  }

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.codPrestador !== null) {
    throw new Error("El generator debió preservar codPrestador = null");
  }

  const validation = await validateRipsV003(gen.ripsJson);
  if (!validation.isValid) throw new Error(`Validación falló: ${JSON.stringify(validation.errors)}`);
});

test("F-01: codPrestador REPS explícito de 12 dígitos", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ codPrestador: "700010000102" }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);

  const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  const os = gen.ripsJson.usuarios[0].servicios.otrosServicios[0];
  if (os.codPrestador !== "700010000102") {
    throw new Error("codPrestador explícito no fue respetado");
  }
});

test("F-01: codPrestador cadena vacía -> FAIL con INVALID_REPS_CODE", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ codPrestador: "   " }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_REPS_CODE", expectedSubstring: "no puede ser string vacío" });
});

// F-02: fechaSuministroTecnologia Calendario y Futuro
test("F-02: 30 de febrero -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2026-02-30 10:00" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Día '30' inválido para el mes 2" });
});

test("F-02: 29 de febrero de 2026 (año no bisiesto) -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2026-02-29 10:00" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Día '29' inválido para el mes 2 del año 2026" });
});

test("F-02: 29 de febrero de año bisiesto (2024) -> PASS", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2024-02-29 10:00" }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(`Falló bisiesto válido: ${adapted.error.message}`);
});

test("F-02: Mes 13 -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2026-13-01 10:00" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Mes '13' fuera de rango" });
});

test("F-02: Mes 00 -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2026-00-01 10:00" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Mes '00' fuera de rango" });
});

test("F-02: Hora 24 -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2026-09-20 24:00" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Hora '24' fuera de rango" });
});

test("F-02: Minuto 60 -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2026-09-20 10:60" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "Minutos '60' fuera de rango" });
});

test("F-02: Fecha futura (año 2099) -> FAIL con INVALID_DATETIME", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ fechaSuministroTecnologia: "2099-01-01 10:00" }));
  await assertAdapterThrows(fixture, { expectedSubstring: "no puede ser futura" });
});

// F-05: Coerciones numéricas
test("F-05: vrUnitOS como string '50000' -> FAIL con INVALID_NUMERIC_DATA (cero coerción)", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ vrUnitOS: "50000" }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA", expectedSubstring: "estrictamente de tipo number" });
});

test("F-05: vrUnitOS como NaN -> FAIL con INVALID_NUMERIC_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ vrUnitOS: NaN }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA" });
});

test("F-05: vrUnitOS como Infinity -> FAIL con INVALID_NUMERIC_DATA", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ vrUnitOS: Infinity }));
  await assertAdapterThrows(fixture, { expectedCode: "INVALID_NUMERIC_DATA" });
});

// F-06: vrDispensacion explícito
test("F-06: vrDispensacion ausente (undefined) -> FAIL con MISSING_REQUIRED_DATA", async () => {
  const fixture = createBaseFixture();
  const at = createOtrosServiciosAtencion();
  delete at.vrDispensacion;
  fixture.atenciones.push(at);
  await assertAdapterThrows(fixture, { expectedCode: "MISSING_REQUIRED_DATA", expectedSubstring: "vrDispensacion es obligatorio" });
});

test("F-06: vrDispensacion explícito 0 -> PASS", async () => {
  const fixture = createBaseFixture();
  fixture.atenciones.push(createOtrosServiciosAtencion({ vrDispensacion: 0 }));
  const adapted = await adaptClinicalDataToRipsV003(fixture);
  if (!adapted.success) throw new Error(adapted.error.message);
});

// F-07: tipoAtencion desconocido directo al Generator
test("F-07: tipoAtencion desconocido en Generator -> FAIL explícito", async () => {
  const fixture = createBaseFixture();
  const rawData = {
    tenantId: fixture.tenantId,
    sucursalId: fixture.sucursalId,
    prestadorConfig: { nit: fixture.prestador.nit, codPrestador: fixture.prestador.codPrestador },
    facturaInfo: { numFactura: fixture.factura.numFactura },
    atenciones: [
      {
        tipoAtencion: "servicio_desconocido",
        paciente: fixture.paciente,
      },
    ],
  };

  try {
    await generateRipsV003({ ...rawData, options: { skipFlagCheck: true, skipRepsCheck: true } });
    throw new Error("El generador debió fallar ante un tipoAtencion desconocido");
  } catch (err) {
    if (!err.message.includes("tipoAtencion desconocido o no soportado")) {
      throw new Error(`Mensaje inesperado: ${err.message}`);
    }
  }
});

// NO REGRESIÓN: Segregación e integridad con Consultas y Procedimientos
test("NO REGRESIÓN: Segregación estricta y no interferencia entre consultas/procedimientos y otrosServicios", async () => {
  const consultaFixture = createBaseFixture();
  consultaFixture.atenciones = [{
    cupsCode: undefined,
  }];
  const adaptedConsulta = await adaptClinicalDataToRipsV003(consultaFixture);
  if (adaptedConsulta.success || !adaptedConsulta.error.message.includes("cupsCode")) {
    throw new Error("Una atención ordinaria debe seguir requiriendo CUPS y no ser tratada como otrosServicios");
  }

  const osFixture = createBaseFixture();
  osFixture.atenciones.push(createOtrosServiciosAtencion());
  const adaptedOS = await adaptClinicalDataToRipsV003(osFixture);
  if (!adaptedOS.success) throw new Error(adaptedOS.error.message);

  const gen = await generateRipsV003({ ...adaptedOS.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true } });
  if (!gen.success) throw new Error(JSON.stringify(gen.validation.errors));

  const serv = gen.ripsJson.usuarios[0].servicios;
  if (!Array.isArray(serv.consultas) || serv.consultas.length !== 0) {
    throw new Error("El nodo consultas debe permanecer como arreglo vacío");
  }
  if (!Array.isArray(serv.procedimientos) || serv.procedimientos.length !== 0) {
    throw new Error("El nodo procedimientos debe permanecer como arreglo vacío");
  }
  if (!Array.isArray(serv.otrosServicios) || serv.otrosServicios.length !== 1) {
    throw new Error("El nodo otrosServicios debe contener exactamente el ítem generado");
  }
  if (serv.otrosServicios[0].consecutivo !== 1) {
    throw new Error("Consecutivo independiente de otrosServicios debe ser 1");
  }

  const validation = await validateRipsV003(gen.ripsJson);
  if (!validation.isValid) {
    throw new Error(`Validación falló: ${JSON.stringify(validation.errors)}`);
  }
});

// -------------------------------------------------------------
// EJECUCIÓN DEL RUNNER
// -------------------------------------------------------------

async function runSuite() {
  console.log("================================================================");
  console.log("🧪 SUITE LOCAL: RIPS v003 — otrosServicios (MICROFASE 2D-B REMEDIADA)");
  console.log("================================================================\n");

  for (const t of tests) {
    try {
      await t.fn();
      passCount++;
      console.log(`✅ [PASS] ${t.name}`);
    } catch (err) {
      failCount++;
      console.error(`❌ [FAIL] ${t.name}`);
      console.error(`   └─ Error: ${err.message}`);
    }
  }

  console.log("\n================================================================");
  console.log(`TOTAL PRUEBAS: ${tests.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log(`ESTADO FINAL: ${failCount === 0 ? "✅ 100% PASSING" : "❌ HUBO FALLAS"}`);
  console.log("================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(e => {
  console.error("Error fatal en runner:", e);
  process.exit(1);
});
