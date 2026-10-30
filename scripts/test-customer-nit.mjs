// NIT con dígito de verificación y códigos de ítem. Sin red ni base de datos.
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) {
      return { url: 'data:text/javascript,export default {};export const supabase={};', shortCircuit: true };
    }
    return next(specifier, context);
  }`));
const { splitIdentificationForDian } = await import('../src/utils/dian/dianHelpers.js');
const { buildFactusCreditNotePayload, readBilledCustomerId } = await import('../src/services/factusCreditNotePayloadBuilder.js');

// 1. Separación número / DV.
assert.deepEqual(splitIdentificationForDian('900371476-8', '31'), { identification: '900371476', dv: '8' });
assert.deepEqual(splitIdentificationForDian('900.371.476 - 8', '31'), { identification: '900371476', dv: '8' });
assert.deepEqual(splitIdentificationForDian('900371476', '31'), { identification: '900371476', dv: '8' });
assert.deepEqual(splitIdentificationForDian('900371476', '31', 8), { identification: '900371476', dv: '8' });
assert.throws(() => splitIdentificationForDian('900371476-3', '31'), { code: 'INVALID_NIT_DV' });
assert.deepEqual(splitIdentificationForDian('1.102.345.678', '13'), { identification: '1102345678', dv: null });
console.log('PASS: el NIT se separa de su DV y un DV inválido se rechaza antes de facturar.');

// 2. Nota crédito: usa el adquiriente exacto de la factura validada (aunque la ficha diga otra cosa).
const fcev1347 = {
  id: 'inv', numero: 'FCEV1347', total: 1200000,
  items: [{ concepto: 'ARRIENDO BODEGA', precioUnitario: 1200000, cantidad: 1, total: 1200000, code_reference: 'ITEM-mvuyvywp' }],
  detalles: {
    dianStatus: 'ACEPTADA', factusInvoiceNumber: 'FCEV1347', cufe: 'e00d23c6',
    factusResponse: { data: { bill: { cufe: 'e00d23c6', customer: {
      identification: '9003714768', dv: '1', identification_document: { code: '31', name: 'NIT' },
      company: 'INSTITUCION EDUCATIVA BOSQUES DE LEON S.A.S' } } } },
  },
};
assert.deepEqual(readBilledCustomerId(fcev1347), { identification: '9003714768', dv: '1', docCode: '31' });
const patient = { nombre: 'INSTITUCION EDUCATIVA BOSQUES DE LEON S.A.S', documento: '900371476-8', tipoDocumento: 'NIT', direccion: 'CR 23 No 18 57', ciudad: 'Sincelejo' };
const nc = buildFactusCreditNotePayload({ invoice: fcev1347, patient, numberingRangeId: 9, referenceCode: 'NC-OC-1', correctionConceptCode: '2' });
assert.equal(nc.customer.identification, '9003714768');
assert.equal(nc.customer.dv, '1');
assert.equal(nc.customer.identification_document_code, '31');

// Sin respuesta de Factus guardada: se toma de la ficha, ya separado.
const legacy = structuredClone(fcev1347);
delete legacy.detalles.factusResponse;
const nc2 = buildFactusCreditNotePayload({ invoice: legacy, patient, numberingRangeId: 9, referenceCode: 'NC-OC-2', correctionConceptCode: '2' });
assert.equal(nc2.customer.identification, '900371476');
assert.equal(nc2.customer.dv, '8');
console.log('PASS: la nota crédito usa el mismo adquiriente que quedó en la factura validada.');

// 3. Conceptos escritos a mano: código ordenado por línea (001, 002…), no uno armado con la hora.
const { readFile } = await import('node:fs/promises');
const form = await readFile(new URL('../src/modules/facturacion/electronica/FacturaElectronicaForm.jsx', import.meta.url), 'utf8');
assert.ok(!form.includes('ITEM-${Date.now()'), 'ya no se generan códigos ITEM-<hora>');
assert.ok(form.includes('String(idx + 1).padStart(3, "0")'));
console.log('PASS: los conceptos sin código reciben 001, 002… en lugar de ITEM-<hora>.');

// 4. Un DV inválido se clasifica como error de datos previo (no "en duda"): se corrige y se reintenta.
const { normalizeFactusError } = await import('../src/services/factusRetryService.js');
let nitError; try { splitIdentificationForDian('900371476-3', '31'); } catch (e) { nitError = e; }
const normalized = normalizeFactusError(nitError);
assert.equal(normalized.category, 'PRE_VALIDATION_ERROR');
assert.match(normalized.friendlyMessage, /debería ser 8/);
assert.ok(form.includes('splitIdentificationForDian(pacienteData.documento, "31")'), 'el formulario valida antes de enviar');
console.log('PASS: un NIT con DV inválido se detiene antes de enviar y no deja la factura "en duda".');

// 5. Nota crédito de una factura de salud (SS-CUFE): toma los datos de salud guardados en la factura.
const { readBilledHealth } = await import('../src/services/factusCreditNotePayloadBuilder.js');
const healthInvoice = structuredClone(fcev1347);
healthInvoice.detalles.tipoOperacion = 'SS-CUFE';
healthInvoice.detalles.esSectorSalud = true;
healthInvoice.detalles.healthData = { coverage_code: '15', provider_code: '7000101658', payment_method_code: '04', without_contract_code: '05' };
const ncHealth = buildFactusCreditNotePayload({ invoice: healthInvoice, patient, numberingRangeId: 9, referenceCode: 'NC-OC-3', correctionConceptCode: '2' });
assert.equal(ncHealth.operation_type, 'SS-CUFE');
assert.deepEqual(ncHealth.health, { provider_code: '7000101658', payment_method_code: '04', coverage_code: '15', without_contract_code: '05' });
// Sin healthData guardado: se usa lo que devolvió Factus al validar.
const onlyResponse = structuredClone(healthInvoice);
delete onlyResponse.detalles.healthData;
onlyResponse.detalles.factusResponse.data.health = { coverage: { code: '15', name: 'Particular' }, policy_number: null,
  provider_code: '7000101658', payment_method: { code: '04', name: 'Pago por evento' }, contract_number: null, without_contract: { code: '05' } };
assert.equal(readBilledHealth(onlyResponse).payment_method_code, '04');
const ncHealth2 = buildFactusCreditNotePayload({ invoice: onlyResponse, patient, numberingRangeId: 9, referenceCode: 'NC-OC-4', correctionConceptCode: '2' });
assert.equal(ncHealth2.health.provider_code, '7000101658');
assert.equal(ncHealth2.health.without_contract_code, '05');
// Factura comercial: sigue sin bloque de salud.
assert.equal(nc.operation_type, undefined);
assert.equal(nc.health, undefined);
console.log('PASS: la nota crédito de una factura de salud reutiliza sus datos de salud (REPS, modalidad, cobertura).');

// 6. Un código interno no convierte la factura en "de salud" al corregirla (caso FCEV1347).
const { isGeneratedItemCode } = await import('../src/utils/invoiceNumbering.js');
const { isClinicalStructuredItem } = await import('../src/services/factusHealthPayloadBuilder.js');
for (const c of ['ITEM-mvuyvywp', '001', '012']) assert.ok(isGeneratedItemCode(c), c);
for (const c of ['890304', 'SERV-0001', '', '9902']) assert.ok(!isGeneratedItemCode(c), c);
const form2 = await readFile(new URL('../src/modules/facturacion/electronica/FacturaElectronicaForm.jsx', import.meta.url), 'utf8');
assert.ok(form2.includes('cups: isGeneratedItemCode(it.cups || it.code) ? "" : (it.cups || it.code || "")'));
assert.ok(form2.includes('cups: (rawCode || isSalud) ? cups : null,'));
// Un ítem recargado con código interno ya no es clínico; uno con CUPS real sí.
assert.equal(isClinicalStructuredItem({ concepto: 'ARRIENDO', cups: '' }), false);
assert.equal(isClinicalStructuredItem({ concepto: 'CONTROL', cups: '890304' }), true);
console.log('PASS: los códigos internos (ITEM-…, 001) no vuelven "de salud" una factura comercial al corregirla.');
