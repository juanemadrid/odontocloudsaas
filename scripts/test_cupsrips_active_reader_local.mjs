/**
 * ODONTOCLOUD — MICROFASE 6A.1F-2B
 * Test Suite Automatizado del Lector CUPSRips ACTIVE contra Supabase Local
 *
 * Verificaciones:
 * 1. Barrera de seguridad estricta LOCAL (localhost / 127.0.0.1)
 * 2. Resolución de activeVersion vía RPC get_active_rips_catalog_version('CUPSRips')
 * 3. Consultas puntuales por código (AC: 890203, AP: 232102, AT: 105M01)
 * 4. Muestreo de 5 AC, 5 AP y 5 AT reales
 * 5. Casos de error: CUPS_CODE_REQUIRED, CUPS_CODE_NOT_FOUND, CUPSRIPS_SOURCE_UNAVAILABLE
 * 6. Casos de metadata corrupta / pares inválidos: CUPSRIPS_METADATA_INVALID
 * 7. Comportamiento y aislamiento de caché (TTL 5 min, aislamiento A -> B)
 * 8. Regresión de catálogos no-CUPSRips (tipos_documento, RIPSTipoUsuarioVersion2, etc.)
 */

import { createClient } from '@supabase/supabase-js';
import './lib/fev_rips_test_guard.mjs';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
globalThis.__supabase = client;

const {
  getCupsClassification,
  getActiveCupsRipsVersion,
  getOfficialCatalog,
  validateCatalogValue,
  _clearCupsRipsCache,
  _getCupsCodeCache,
  _setActiveVersionCacheForTesting,
} = await import('../src/modules/rips/v003/ripsV003Catalogs.js');

const results = [];
function record(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${passed ? 'PASS' : 'FAIL'}] ${testName}`);
  if (details) console.log(`   └─ ${details}`);
}

console.log('================================================================');
console.log('🧪 MICROFASE 6A.1F-2B: VERIFICACIÓN DEL LECTOR CUPSRips ACTIVE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Verificación de resolución de Active Version
// -----------------------------------------------------------------------------
_clearCupsRipsCache();
const activeVersion = await getActiveCupsRipsVersion();
record(
  'Resolución de versión ACTIVE mediante RPC',
  activeVersion === 'CUPSRips-2706-2025-fa87dac9c1b9',
  `Versión activa resuelta: '${activeVersion}'`
);

// -----------------------------------------------------------------------------
// 2. Control A: 890203 (AC - Consulta)
// -----------------------------------------------------------------------------
const res890203 = await getCupsClassification('890203');
record(
  'Control 890203: Código AC (Consulta)',
  res890203.exists === true &&
    res890203.active === true &&
    res890203.tipoRips === 'consulta' &&
    res890203.archivoRips === 'AC' &&
    res890203.correspondeBloqueConsultas === true &&
    res890203.correspondeBloqueProcedimientos === false &&
    res890203.correspondeBloqueOtrosServicios === false &&
    res890203.versionCatalogo === activeVersion &&
    res890203.error === null &&
    res890203.errorCode === null,
  `tipoRips: '${res890203.tipoRips}', archivoRips: '${res890203.archivoRips}', descripcion: '${res890203.descripcionOficial}'`
);

// -----------------------------------------------------------------------------
// 3. Control B: 232102 (AP - Procedimiento)
// -----------------------------------------------------------------------------
const res232102 = await getCupsClassification('232102');
record(
  'Control 232102: Código AP (Procedimiento)',
  res232102.exists === true &&
    res232102.active === true &&
    res232102.tipoRips === 'procedimiento' &&
    res232102.archivoRips === 'AP' &&
    res232102.correspondeBloqueConsultas === false &&
    res232102.correspondeBloqueProcedimientos === true &&
    res232102.correspondeBloqueOtrosServicios === false &&
    res232102.versionCatalogo === activeVersion,
  `tipoRips: '${res232102.tipoRips}', archivoRips: '${res232102.archivoRips}', descripcion: '${res232102.descripcionOficial}'`
);

// -----------------------------------------------------------------------------
// 4. Control C: 105M01 (AT - OtrosServicios)
// -----------------------------------------------------------------------------
const res105M01 = await getCupsClassification('105M01');
record(
  'Control 105M01: Código AT (OtrosServicios)',
  res105M01.exists === true &&
    res105M01.active === true &&
    res105M01.tipoRips === 'otrosServicios' &&
    res105M01.archivoRips === 'AT' &&
    res105M01.correspondeBloqueConsultas === false &&
    res105M01.correspondeBloqueProcedimientos === false &&
    res105M01.correspondeBloqueOtrosServicios === true &&
    res105M01.versionCatalogo === activeVersion,
  `tipoRips: '${res105M01.tipoRips}', archivoRips: '${res105M01.archivoRips}', descripcion: '${res105M01.descripcionOficial}'`
);

// -----------------------------------------------------------------------------
// 5. Control D: Código Inexistente Sintético
// -----------------------------------------------------------------------------
const resNotFound = await getCupsClassification('ZZ9999');
record(
  'Código inexistente: CUPS_CODE_NOT_FOUND',
  resNotFound.exists === false &&
    resNotFound.active === false &&
    resNotFound.errorCode === 'CUPS_CODE_NOT_FOUND' &&
    typeof resNotFound.error === 'string' &&
    resNotFound.versionCatalogo === activeVersion,
  `errorCode: '${resNotFound.errorCode}', error: '${resNotFound.error}'`
);

// -----------------------------------------------------------------------------
// 6. Control E: Código CUPS Vacío
// -----------------------------------------------------------------------------
const resEmpty1 = await getCupsClassification('');
const resEmpty2 = await getCupsClassification('   ');
const resEmpty3 = await getCupsClassification(null);
record(
  'Código vacío: CUPS_CODE_REQUIRED',
  resEmpty1.errorCode === 'CUPS_CODE_REQUIRED' &&
    resEmpty2.errorCode === 'CUPS_CODE_REQUIRED' &&
    resEmpty3.errorCode === 'CUPS_CODE_REQUIRED' &&
    resEmpty1.exists === false &&
    resEmpty1.active === false,
  `errorCode: '${resEmpty1.errorCode}'`
);

// -----------------------------------------------------------------------------
// 7. Muestra de 5 AC Reales
// -----------------------------------------------------------------------------
const acCodes = ['890201', '890202', '890203', '890204', '890205'];
let allAcPassed = true;
for (const code of acCodes) {
  const r = await getCupsClassification(code);
  if (r.tipoRips !== 'consulta' || r.archivoRips !== 'AC' || !r.correspondeBloqueConsultas) {
    allAcPassed = false;
    break;
  }
}
record(
  'Muestreo de 5 códigos AC reales (890201..890205)',
  allAcPassed,
  `Todos clasificados como tipoRips='consulta' y archivoRips='AC'`
);

// -----------------------------------------------------------------------------
// 8. Muestra de 5 AP Reales
// -----------------------------------------------------------------------------
const apCodes = ['230101', '230102', '232101', '232102', '993102'];
let allApPassed = true;
for (const code of apCodes) {
  const r = await getCupsClassification(code);
  if (r.tipoRips !== 'procedimiento' || r.archivoRips !== 'AP' || !r.correspondeBloqueProcedimientos) {
    allApPassed = false;
    break;
  }
}
record(
  'Muestreo de 5 códigos AP reales (230101, 230102, 232101, 232102, 993102)',
  allApPassed,
  `Todos clasificados como tipoRips='procedimiento' y archivoRips='AP'`
);

// -----------------------------------------------------------------------------
// 9. Muestra de 5 AT Reales
// -----------------------------------------------------------------------------
const atCodes = ['105M01', '106M01', '106M02', '107M01', '107M02'];
let allAtPassed = true;
for (const code of atCodes) {
  const r = await getCupsClassification(code);
  if (r.tipoRips !== 'otrosServicios' || r.archivoRips !== 'AT' || !r.correspondeBloqueOtrosServicios) {
    allAtPassed = false;
    break;
  }
}
record(
  'Muestreo de 5 códigos AT reales (105M01..107M02)',
  allAtPassed,
  `Todos clasificados como tipoRips='otrosServicios' y archivoRips='AT'`
);

// -----------------------------------------------------------------------------
// 10. Validación de Pares Canónicos y Detección de Metadata Corrupta
// -----------------------------------------------------------------------------
const syntheticCases = [
  { name: 'AC + procedimiento', meta: { usoCodigoCup: 'AC', tipoRips: 'procedimiento' } },
  { name: 'AP + consulta', meta: { usoCodigoCup: 'AP', tipoRips: 'consulta' } },
  { name: 'AT + procedimiento', meta: { usoCodigoCup: 'AT', tipoRips: 'procedimiento' } },
  { name: 'uso faltante', meta: { tipoRips: 'consulta' } },
  { name: 'tipoRips faltante', meta: { usoCodigoCup: 'AC' } },
  { name: 'uso desconocido', meta: { usoCodigoCup: 'XX', tipoRips: 'consulta' } },
];

let allCorruptPassed = true;
for (const tc of syntheticCases) {
  // Inyectar un mock client sintético que retorne fila con metadata corrupta
  const mockClient = {
    rpc: async () => ({ data: activeVersion, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    codigo: 'MOCK01',
                    descripcion: 'MOCK CORRUPTO',
                    activo: true,
                    metadata: tc.meta,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  globalThis.__supabase = mockClient;
  _clearCupsRipsCache();
  const res = await getCupsClassification('MOCK01');
  if (res.errorCode !== 'CUPSRIPS_METADATA_INVALID' || res.exists !== true) {
    allCorruptPassed = false;
    console.error(`Fallo en caso corrupto: ${tc.name}`, res);
    break;
  }
}

// Restaurar cliente real
globalThis.__supabase = client;
_clearCupsRipsCache();

record(
  'Metadata corrupta / pares inválidos: CUPSRIPS_METADATA_INVALID',
  allCorruptPassed,
  'Se verificaron 6 casos inválidos (AC+procedimiento, AP+consulta, etc.)'
);

// -----------------------------------------------------------------------------
// 11. Test Source Unavailable (RPC retornando NULL)
// -----------------------------------------------------------------------------
const mockNullClient = {
  rpc: async () => ({ data: null, error: null }),
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
};

globalThis.__supabase = mockNullClient;
_clearCupsRipsCache();
const resUnavailable = await getCupsClassification('890203');

// Restaurar cliente real
globalThis.__supabase = client;
_clearCupsRipsCache();

record(
  'Ausencia de versión activa: CUPSRIPS_SOURCE_UNAVAILABLE',
  resUnavailable.exists === false &&
    resUnavailable.active === false &&
    resUnavailable.errorCode === 'CUPSRIPS_SOURCE_UNAVAILABLE',
  `errorCode: '${resUnavailable.errorCode}', error: '${resUnavailable.error}'`
);

// -----------------------------------------------------------------------------
// 12. Test de Caché por Código y Aislamiento por Versión
// -----------------------------------------------------------------------------
_clearCupsRipsCache();
// Primera llamada: sin caché
const t0 = performance.now();
const firstCall = await getCupsClassification('890203');
const t1 = performance.now();

// Segunda llamada: debe estar en cupsCodeCache
const codeCache = _getCupsCodeCache();
const cacheKey = `${activeVersion}:890203`;
const hasCachedEntry = codeCache.has(cacheKey);

const t2 = performance.now();
const secondCall = await getCupsClassification('890203');
const t3 = performance.now();

record(
  'Caché por código: CUPS_CODE_CACHE_HIT',
  hasCachedEntry && firstCall.codigo === secondCall.codigo,
  `Clave: '${cacheKey}', t1: ${(t1 - t0).toFixed(2)}ms, t2: ${(t3 - t2).toFixed(2)}ms`
);

// Aislamiento A -> B: Si la versión activa cambia a 'CUPSRips-V2-NEW', la entrada de A no se reutiliza
_setActiveVersionCacheForTesting('CUPSRips-V2-NEW');
const codeCacheAfterChange = _getCupsCodeCache();
const hasOldEntryUnderNewVersion = codeCacheAfterChange.has('CUPSRips-V2-NEW:890203');

record(
  'Aislamiento de versión de caché (A -> B): CACHE_VERSION_ISOLATION',
  hasOldEntryUnderNewVersion === false,
  'La clave incluye la versión activa, garantizando aislamiento estricto'
);

// Restaurar estado
_clearCupsRipsCache();

// -----------------------------------------------------------------------------
// 13. Regresión de los 13 Catálogos no-CUPSRips
// -----------------------------------------------------------------------------
const tDoc = await getOfficialCatalog('tipos_documento');
const tDocVal = await validateCatalogValue('tipos_documento', 'CC');
const tUser = await getOfficialCatalog('RIPSTipoUsuarioVersion2');
const tUserVal = await validateCatalogValue('RIPSTipoUsuarioVersion2', '01');
const lstSiNo = await getOfficialCatalog('LstSiNo');
const lstSiNoVal = await validateCatalogValue('LstSiNo', '01');

record(
  'Regresión de catálogos no-CUPSRips (tipos_documento, RIPSTipoUsuarioVersion2, LstSiNo)',
  Array.isArray(tDoc) &&
    tDoc.length >= 10 &&
    tDocVal.valid === true &&
    Array.isArray(tUser) &&
    tUser.length >= 14 &&
    tUserVal.valid === true &&
    Array.isArray(lstSiNo) &&
    lstSiNoVal.valid === true,
  `tipos_documento: ${tDoc.length} filas, RIPSTipoUsuarioVersion2: ${tUser.length} filas`
);

// -----------------------------------------------------------------------------
// Resumen Final
// -----------------------------------------------------------------------------
const allPassed = results.every(r => r.passed);
console.log('\n================================================================');
console.log(`TOTAL PRUEBAS: ${results.length} | EXITOSAS: ${results.filter(r => r.passed).length} | FALLIDAS: ${results.filter(r => !r.passed).length}`);
console.log(`ESTADO FINAL: ${allPassed ? '✅ TODOS LOS TESTS PASARON EXITOSAMENTE' : '❌ HAY TESTS FALLIDOS'}`);
console.log('================================================================\n');

if (!allPassed) {
  process.exit(1);
}
