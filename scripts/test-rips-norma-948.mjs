// RIPS según Resolución 948 de 2026 / Documento Técnico 1: tablas oficiales SISPRO, datos del paciente
// tomados de su ficha y JSON final que acepta el validador del Ministerio (MUV). Sin red ni base de datos.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) return { url: 'data:text/javascript,export default {};', shortCircuit: true };
    return next(specifier, context);
  }`));
// Base de datos simulada: sin catálogos en BD (usa las tablas oficiales del código) y sin versión CUPS activa.
const empty = { data: [], error: null };
const chain = new Proxy({}, { get: (t, k) => (k === 'then' ? (r) => r(empty) : k === 'maybeSingle' ? async () => ({ data: null, error: null }) : () => chain) });
globalThis.__supabase = { from: () => chain, rpc: async () => ({ data: null, error: null }) };

const cat = await import('../src/modules/rips/v003/ripsV003Catalogs.js');
const { validateRipsV003 } = await import('../src/modules/rips/v003/ripsV003Validator.js');
const { generateRipsV003 } = await import('../src/modules/rips/v003/ripsV003Generator.js');
const { adaptClinicalDataToRipsV003 } = await import('../src/modules/rips/v003/adapters/ripsV003ClinicalAdapter.js');
const { resolveResidence, resolveCountry } = await import('../src/modules/rips/v003/ripsResidence.js');

// 1. Tablas oficiales SISPRO.
const codes = (n) => cat.OFFICIAL_SEED_CATALOGS[n].map((x) => x.codigo);
assert.deepEqual(codes('finalidad_consulta'), Array.from({ length: 34 }, (_, i) => String(11 + i)), 'finalidad 11..44 (RIPSFinalidadConsultaVersion2)');
assert.deepEqual(codes('finalidad_procedimiento'), codes('finalidad_consulta'), 'procedimientos usan la misma tabla');
assert.deepEqual(codes('causa_externa'), Array.from({ length: 29 }, (_, i) => String(21 + i)), 'causa externa 21..49');
assert.deepEqual(codes('modalidad_atencion'), ['01', '02', '03', '04', '05', '06', '07', '08', '09']);
assert.equal(codes('via_ingreso').length, 14);
assert.deepEqual(cat.OFFICIAL_SEED_CATALOGS.zonas_territoriales.map((z) => `${z.codigo}=${z.descripcion}`), ['01=Rural', '02=Urbano']);
console.log('PASS: tablas oficiales (finalidad 11-44, causa 21-49, modalidad 01-09, vía 01-14, zona 01 Rural / 02 Urbano).');

// 2. Traducción de lo que guarda la historia clínica.
assert.equal(cat.mapFinalidadOficial('Diagnóstico'), '15');
assert.equal(cat.mapFinalidadOficial('Terapéutico'), '16');
assert.equal(cat.mapFinalidadOficial('Preventivo'), '14');
assert.equal(cat.mapFinalidadOficial('Rehabilitación'), '17');
assert.equal(cat.mapFinalidadOficial('10', { isConsulta: true }), '15', 'código viejo de consulta');
assert.equal(cat.mapFinalidadOficial('02'), '16', 'código viejo de procedimiento (Res. 3374)');
assert.equal(cat.mapFinalidadOficial('16'), '16', 'código oficial se respeta');
assert.equal(cat.mapFinalidadOficial('16', { isConsulta: true }), '16', 'traducir dos veces no cambia el código');
for (const code of cat.FINALIDAD_CODES) for (const isConsulta of [true, false]) assert.equal(cat.mapFinalidadOficial(code, { isConsulta }), code, `oficial ${code} intacto`);
assert.equal(cat.mapFinalidadOficial(''), '15');
assert.equal(cat.mapCausaOficial('', '16'), '38', 'odontología: enfermedad general');
assert.equal(cat.mapCausaOficial('', '14'), '40', 'prevención: promoción y mantenimiento');
assert.equal(cat.mapCausaOficial('01'), '21', 'código viejo 01 (accidente de trabajo) → 21 oficial');
assert.equal(cat.mapCausaOficial('99'), '38', 'código inexistente no pasa');
assert.equal(cat.mapZonaOficial('Urbana'), '02');
assert.equal(cat.mapZonaOficial('Urbano'), '02');
assert.equal(cat.mapZonaOficial('Rural'), '01');
assert.equal(cat.mapTipoDocumentoOficial('Cédula de ciudadanía'), 'CC');
assert.equal(cat.mapTipoDocumentoOficial('Tarjeta de identidad'), 'TI');
assert.equal(cat.mapTipoDocumentoOficial('Cédula de extranjería'), 'CE');
assert.equal(cat.mapTipoDocumentoOficial('Pasaporte'), 'PA');
assert.equal(cat.mapModalidadOficial('Intramural'), '01');
const ref = new Date('2026-10-31T12:00:00');
assert.equal(cat.documentoAcordeEdad('CC', '2021-05-01', ref).ok, false, 'niño de 5 años con CC');
assert.equal(cat.documentoAcordeEdad('CC', '2012-05-01', ref).ok, false, 'adolescente con CC');
assert.equal(cat.documentoAcordeEdad('TI', '2012-05-01', ref).ok, true);
assert.equal(cat.documentoAcordeEdad('CC', '1990-05-01', ref).ok, true);
console.log('PASS: la ficha del paciente y la evolución se traducen a los códigos oficiales; documento vs. edad.');

// 3. Residencia: DANE y país.
assert.equal(resolveResidence({ ciudad: 'Montería', pais: 'Colombia' }).codMunicipioResidencia, '23001');
assert.equal(resolveResidence({ ciudad: 'tolú viejo' }).codMunicipioResidencia, '70823');
assert.equal(resolveResidence({ ciudad: 'Miami' }).codPaisResidencia, '840');
assert.equal(resolveResidence({ ciudad: 'Miami' }).codMunicipioResidencia, null);
assert.ok(resolveResidence({ ciudad: '' }).error, 'sin ciudad: se avisa, no se inventa');
assert.ok(resolveResidence({ ciudad: 'Ciudad Inventada' }).error);
assert.equal(resolveCountry('Colombia'), '170');
console.log('PASS: municipio DANE y país desde la ficha (ya no 70001 para todos).');

// 4. RIPS completo de una clínica odontológica (procedimiento + consulta) → JSON que acepta el MUV.
const base = {
  tenantId: 't1', sucursalId: 's1',
  prestador: { nit: '900231227', codPrestador: '700010165701', codServicio: 334 },
  factura: { numFactura: 'FE1024', isWithoutFev: false },
  paciente: { tipoDocumentoIdentificacion: 'CC', numDocumentoIdentificacion: '1012345678', tipoUsuario: '12', fechaNacimiento: '1990-04-12',
    codSexo: 'F', codPaisResidencia: '170', codMunicipioResidencia: '70001', codZonaTerritorialResidencia: '02', incapacidad: 'No', codPaisOrigen: '170' },
  profesional: { tipoDocumentoIdentificacion: 'CC', numDocumentoIdentificacion: '64576359' },
  skipCupsCheck: true,
};
const proc = { tipoAtencion: 'procedimiento', cupsCode: '232102', codDiagnosticoPrincipal: 'K021', viaIngresoServicioSalud: '01',
  fechaInicioAtencion: '2026-10-10 10:00', modalidad: cat.mapModalidadOficial('Intramural'), grupoServicios: '01',
  finalidad: cat.mapFinalidadOficial('Terapéutico'), vrServicio: 150000, conceptoRecaudo: '05', valorPagoModerador: 0,
  profesional: base.profesional };
const cons = { tipoAtencion: 'consulta', cupsCode: '890203', codDiagnosticoPrincipal: 'K021', fechaInicioAtencion: '2026-10-02 09:00',
  finalidad: cat.mapFinalidadOficial('', { isConsulta: true }), modalidad: '01', grupoServicios: '01', causaMotivoAtencion: cat.mapCausaOficial('', '15'),
  tipoDiagnosticoPrincipal: '01', vrServicio: 80000, conceptoRecaudo: '05', valorPagoModerador: 0, profesional: base.profesional };
const cons2 = { ...cons, fechaInicioAtencion: '2026-10-03 09:00', finalidad: cat.mapFinalidadOficial('Terapéutico', { isConsulta: true }) };
const adapted = await adaptClinicalDataToRipsV003({ ...base, atenciones: [proc, cons, cons2] });
assert.ok(adapted.success, adapted.error?.message);
const gen = await generateRipsV003({ ...adapted.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true, skipCupsCheck: true } });
assert.deepEqual(gen.validation.errors, []);
const j = gen.ripsJson;
const u = j.usuarios[0];
assert.equal(j.numDocumentoIdObligado, '900231227');
assert.equal(j.numFactura, 'FE1024');
assert.deepEqual([u.tipoDocumentoIdentificacion, u.tipoUsuario, u.codSexo, u.codZonaTerritorialResidencia, u.incapacidad, u.codPaisOrigen, u.consecutivo],
  ['CC', '12', 'F', '02', '02', '170', 1]);
const p = u.servicios.procedimientos[0];
assert.deepEqual([p.codPrestador, p.codProcedimiento, p.viaIngresoServicioSalud, p.modalidadGrupoServicioTecSal, p.grupoServicios, p.codServicio, p.finalidadTecnologiaSalud, p.idMIPRES, p.consecutivo],
  ['700010165701', '232102', '01', '01', '01', 334, '16', null, 1]);
const c = u.servicios.consultas[0];
assert.deepEqual([c.codConsulta, c.finalidadTecnologiaSalud, c.causaMotivoAtencion, c.conceptoRecaudo, c.valorPagoModerador], ['890203', '15', '38', '05', 0]);
assert.equal(u.servicios.consultas[1].finalidadTecnologiaSalud, '16', 'consulta de tratamiento sigue en 16 (no se traduce dos veces)');
assert.ok(!('causaMotivoAtencion' in p), 'procedimientos no llevan causa');
console.log('PASS: RIPS odontológico completo (consulta + procedimiento) con códigos oficiales y sin errores.');

// 5. Lo que el MUV rechaza ahora también lo rechaza OdontoCloud antes de enviar.
const bad = JSON.parse(JSON.stringify(j));
bad.usuarios[0].servicios.procedimientos[0].finalidadTecnologiaSalud = '02';
bad.usuarios[0].servicios.consultas[0].finalidadTecnologiaSalud = '10';
bad.usuarios[0].servicios.consultas[0].causaMotivoAtencion = '01';
bad.usuarios[0].servicios.consultas[0].codPrestador = '7000101657';
bad.usuarios[0].codPaisOrigen = null;
const v = await validateRipsV003(bad, { skipCupsCheck: true });
const txt = v.errors.join(' | ');
assert.ok(/Procedimiento \[1\]: finalidadTecnologiaSalud '02'/.test(txt), 'finalidad vieja de procedimiento');
assert.ok(/Consulta \[1\]: finalidadTecnologiaSalud '10'/.test(txt), 'finalidad inventada de consulta');
assert.ok(/causaMotivoAtencion '01'/.test(txt));
assert.ok(/12 dígitos/.test(txt), 'código REPS de 10 dígitos');
assert.ok(/codPaisOrigen es obligatorio/.test(txt));
console.log('PASS: finalidades viejas, causa inválida, REPS de 10 dígitos y país de origen vacío se detectan antes de enviar.');

// 6. Paciente que vive en el exterior: municipio null; sin fecha de atención: error (no se inventa).
const ext = await adaptClinicalDataToRipsV003({ ...base, paciente: { ...base.paciente, codPaisResidencia: '840', codMunicipioResidencia: null }, atenciones: [proc] });
assert.ok(ext.success, ext.error?.message);
const genExt = await generateRipsV003({ ...ext.adaptedData, options: { skipFlagCheck: true, skipRepsCheck: true, skipCupsCheck: true } });
assert.equal(genExt.ripsJson.usuarios[0].codMunicipioResidencia, null);
assert.deepEqual(genExt.validation.errors, []);
const noDate = await adaptClinicalDataToRipsV003({ ...base, atenciones: [{ ...proc, fechaInicioAtencion: undefined }] });
assert.equal(noDate.success, false, 'sin fecha no se inventa 2026-09-20');
console.log('PASS: residencia en el exterior sin municipio; atención sin fecha no se inventa.');

// 7. Pantalla de RIPS: usa la ficha real del paciente y las tablas oficiales.
const ui = (await readFile(new URL('../src/modules/rips/RipsGenerator.jsx', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
assert.ok(!ui.includes('"70001").trim()'), 'ya no 70001 para todos');
assert.ok(ui.includes('mapTipoDocumentoOficial(pacienteData?.tipoDoc || pacienteData?.tipoDocumento || pacienteData?.tipo_documento'));
assert.ok(ui.includes('mapZonaOficial(pacienteData?.zona_residencial'));
assert.ok(ui.includes('codPaisOrigen: usuarioWithValidation.codPaisOrigen,'), 'el país de origen llega al RIPS');
assert.ok(!ui.includes('docMeta.finalidad || "10"') && !ui.includes('grupoServicios: "02"'));
assert.ok(ui.includes('professionalIdError(profObj, tenantConfig)'), 'no se usa el NIT de la clínica como documento del profesional');
assert.ok(ui.includes("timeZone: 'America/Bogota'"), 'horas en hora de Colombia');
console.log('PASS: la pantalla de RIPS toma documento, zona, municipio y país reales del paciente y la hora de Colombia.');
