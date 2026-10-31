// Servicio REPS (codServicio) por profesional: antes siempre 334. Ahora cada atención lleva el servicio
// del profesional que atendió (por defecto 334) y se avisa si la consulta CUPS no cuadra con el servicio.
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

const { resolveCodServicio, alertaConsultaServicio, SERVICIOS_REPS_ODONTOLOGIA } = await import('../src/modules/rips/v003/ripsServicioReps.js');
const { generateRipsV003 } = await import('../src/modules/rips/v003/ripsV003Generator.js');
const { adaptClinicalDataToRipsV003 } = await import('../src/modules/rips/v003/adapters/ripsV003ClinicalAdapter.js');

// 1. Servicio del profesional; sin configurar o inválido → 334 (lo de siempre).
assert.equal(resolveCodServicio(null), 334);
assert.equal(resolveCodServicio({}), 334);
assert.equal(resolveCodServicio({ ripsCodServicio: '338' }), 338);
assert.equal(resolveCodServicio({ ripsCodServicio: 411 }), 411);
assert.equal(resolveCodServicio({ ripsCodServicio: '999' }), 334, 'código que no es de odontología → 334');
assert.deepEqual(SERVICIOS_REPS_ODONTOLOGIA.map(s => s.codigo), ['334', '311', '313', '338', '343', '347', '396', '410', '411']);
console.log('PASS: servicio REPS del profesional (por defecto 334).');

// 2. La consulta CUPS debe cuadrar con el servicio.
assert.equal(alertaConsultaServicio('890203', 334), null);
assert.equal(alertaConsultaServicio('890303', 334), null);
assert.equal(alertaConsultaServicio('890204', 411), null);
assert.equal(alertaConsultaServicio('890304', 338), null);
assert.match(alertaConsultaServicio('890204', 334), /especialista/);
assert.match(alertaConsultaServicio('890203', 338), /odontología general/);
assert.equal(alertaConsultaServicio('890703', 338), null, 'urgencias no se cruza');
console.log('PASS: alerta cuando la consulta de especialista va con servicio general o al revés.');

// 3. El RIPS final lleva el servicio de cada atención; si no viene, el del prestador (334).
const base = {
  tenantId: 't1', sucursalId: 's1',
  prestador: { nit: '92529195', codPrestador: '700010165801', codServicio: 334 },
  factura: { numFactura: null, isWithoutFev: true },
  paciente: { tipoDocumentoIdentificacion: 'CC', numDocumentoIdentificacion: '1102854301', tipoUsuario: '12', fechaNacimiento: '1993-06-19',
    codSexo: 'F', codPaisResidencia: '170', codMunicipioResidencia: '70001', codZonaTerritorialResidencia: '02', incapacidad: 'No', codPaisOrigen: '170' },
  profesional: { tipoDocumentoIdentificacion: 'CC', numDocumentoIdentificacion: '92529195' },
  skipCupsCheck: true,
};
const cons = { tipoAtencion: 'consulta', cupsCode: '890204', codDiagnosticoPrincipal: 'K076', fechaInicioAtencion: '2026-10-16 18:24',
  finalidad: '15', modalidad: '01', grupoServicios: '01', causaMotivoAtencion: '38', tipoDiagnosticoPrincipal: '01',
  vrServicio: 180000, conceptoRecaudo: '05', valorPagoModerador: 0, profesional: base.profesional, codServicio: 411 };
const proc = { tipoAtencion: 'procedimiento', cupsCode: '232102', codDiagnosticoPrincipal: 'K021', viaIngresoServicioSalud: '01',
  fechaInicioAtencion: '2026-10-17 10:00', modalidad: '01', grupoServicios: '01', finalidad: '16', vrServicio: 150000,
  conceptoRecaudo: '05', valorPagoModerador: 0, profesional: base.profesional };
const adapted = await adaptClinicalDataToRipsV003({ ...base, atenciones: [cons, proc] });
assert.ok(adapted.success, adapted.error?.message);
const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true, skipCupsCheck: true, billingMode: 'OFFICIAL_RIPS_WITHOUT_FEV' } });
assert.deepEqual(gen.validation.errors, []);
const s = gen.ripsJson.usuarios[0].servicios;
assert.equal(s.consultas[0].codServicio, 411, 'consulta del especialista con su servicio');
assert.equal(s.procedimientos[0].codServicio, 334, 'sin servicio propio → 334 del prestador');
console.log('PASS: el RIPS lleva el servicio de cada atención (411 especialista, 334 por defecto).');
