// Controles de seguimiento (8903xx) del presupuesto se reportan como consulta usando la evolución, y los
// procedimientos diagnósticos 893xxx (estudio de oclusión, modelos) van en procedimientos, no en consultas.
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) return { url: 'data:text/javascript,export default {};', shortCircuit: true };
    return next(specifier, context);
  }`));
const empty = { data: [], error: null };
const chain = new Proxy({}, { get: (t, k) => (k === 'then' ? (r) => r(empty) : k === 'maybeSingle' ? async () => ({ data: null, error: null }) : () => chain) });
globalThis.__supabase = { from: () => chain, rpc: async () => ({ data: null, error: null }) };

const cat = await import('../src/modules/rips/v003/ripsV003Catalogs.js');
const { generateRipsV003 } = await import('../src/modules/rips/v003/ripsV003Generator.js');
const { adaptClinicalDataToRipsV003 } = await import('../src/modules/rips/v003/adapters/ripsV003ClinicalAdapter.js');

// 1. Qué es consulta y qué es control.
for (const c of ['890203', '890303', '890304', '890703', '890204']) assert.equal(cat.esCodigoConsulta(c), true, c);
for (const c of ['893104', '893101', '893110', '232102', '248201', '89', '8903031']) assert.equal(cat.esCodigoConsulta(c), false, c);
for (const c of ['890303', '890304']) assert.equal(cat.esCodigoControl(c), true, c);
for (const c of ['890203', '890703', '893104']) assert.equal(cat.esCodigoControl(c), false, c);
console.log('PASS: 890xxx son consultas, 8903xx son controles, 893xxx son procedimientos diagnósticos.');

// 2. RIPS: control 890303 como consulta (registro = evolución) + estudio 893104 como procedimiento.
const base = {
  tenantId: 't1', sucursalId: 's1',
  prestador: { nit: '92529195', codPrestador: '700010165801', codServicio: 334 },
  factura: { numFactura: null, isWithoutFev: true },
  paciente: { tipoDocumentoIdentificacion: 'CC', numDocumentoIdentificacion: '1102854301', tipoUsuario: '12', fechaNacimiento: '1993-06-19',
    codSexo: 'F', codPaisResidencia: '170', codMunicipioResidencia: '70001', codZonaTerritorialResidencia: '02', incapacidad: 'No', codPaisOrigen: '170' },
  profesional: { tipoDocumentoIdentificacion: 'CC', numDocumentoIdentificacion: '92529195' },
};
const control = { tipoAtencion: 'consulta', cupsCode: '890303', codServicio: 334, codDiagnosticoPrincipal: 'K076', fechaInicioAtencion: '2026-10-20 09:00',
  finalidad: cat.mapFinalidadOficial(undefined, { isConsulta: true }), modalidad: cat.mapModalidadOficial(undefined), grupoServicios: '01',
  causaMotivoAtencion: cat.mapCausaOficial(undefined, cat.mapFinalidadOficial(undefined, { isConsulta: true })), tipoDiagnosticoPrincipal: '01',
  vrServicio: 120000, conceptoRecaudo: '05', valorPagoModerador: 0, profesional: base.profesional };
const estudio = { tipoAtencion: 'procedimiento', cupsCode: '893104', codDiagnosticoPrincipal: 'K076', viaIngresoServicioSalud: '01',
  fechaInicioAtencion: '2026-10-21 10:00', modalidad: '01', grupoServicios: '01', finalidad: '15', vrServicio: 870000,
  conceptoRecaudo: '05', valorPagoModerador: 0, profesional: base.profesional };
const adapted = await adaptClinicalDataToRipsV003({ ...base, atenciones: [control, estudio] });
assert.ok(adapted.success, adapted.error?.message);
const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true, billingMode: 'OFFICIAL_RIPS_WITHOUT_FEV' } });
assert.deepEqual(gen.validation.errors, [], JSON.stringify(gen.validation.errors));
const s = gen.ripsJson.usuarios[0].servicios;
assert.equal(s.consultas.length, 1);
assert.equal(s.consultas[0].codConsulta, '890303');
assert.equal(s.consultas[0].causaMotivoAtencion, '38');
assert.equal(s.procedimientos.length, 1);
assert.equal(s.procedimientos[0].codProcedimiento, '893104', 'estudio de oclusión en procedimientos');
console.log('PASS: control 890303 sale en consultas y el estudio 893104 en procedimientos, sin errores.');
