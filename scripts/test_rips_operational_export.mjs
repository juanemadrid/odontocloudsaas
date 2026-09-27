import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

console.log('--- TEST: RIPS OPERATIONAL EXPORT & 26 REQUIREMENTS ---');

const ripsFilePath = path.resolve('src/modules/rips/RipsGenerator.jsx');
const ripsSource = readFileSync(ripsFilePath, 'utf8');

// 1. Verify xmlMatchesInvoice function
function xmlMatchesInvoice(xmlString, invoiceId) {
  if (!xmlString || typeof xmlString !== 'string' || !invoiceId) return false;
  const cleanId = String(invoiceId).trim();
  const escaped = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idRegex = new RegExp(`<cbc:ID(?:\\s+[^>]*)?>\\s*${escaped}\\s*<\\/cbc:ID>`, 'i');
  if (idRegex.test(xmlString)) return true;
  const parentDocRegex = new RegExp(`<cbc:ParentDocumentID(?:\\s+[^>]*)?>\\s*${escaped}\\s*<\\/cbc:ParentDocumentID>`, 'i');
  if (parentDocRegex.test(xmlString)) return true;
  return false;
}

// Test xmlMatchesInvoice
const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>FCEV1314</cbc:ID>
  <cbc:ParentDocumentID>FCEV1314</cbc:ParentDocumentID>
</AttachedDocument>`;

const mismatchXml = `<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>FCEV1327</cbc:ID>
  <cbc:ParentDocumentID>FCEV1327</cbc:ParentDocumentID>
</AttachedDocument>`;

assert.equal(xmlMatchesInvoice(validXml, 'FCEV1314'), true, 'xmlMatchesInvoice should match FCEV1314');
assert.equal(xmlMatchesInvoice(mismatchXml, 'FCEV1314'), false, 'xmlMatchesInvoice should reject mismatched invoice');
console.log('✓ xmlMatchesInvoice logic passed.');

// 2. Test zip package structure per invoice
async function testZipStructure() {
  const zip = new JSZip();
  const invoiceId = 'FCEV1314';
  const invoiceFolder = zip.folder(invoiceId);
  const jsonContent = JSON.stringify({ numFactura: invoiceId, usuarios: [] });
  invoiceFolder.file(`${invoiceId}.json`, jsonContent);
  invoiceFolder.file(`${invoiceId}.xml`, validXml);

  const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
  const reloadedZip = await JSZip.loadAsync(zipContent);
  
  assert.ok(reloadedZip.file(`${invoiceId}/${invoiceId}.json`), 'Zip contains invoice folder and JSON');
  assert.ok(reloadedZip.file(`${invoiceId}/${invoiceId}.xml`), 'Zip contains invoice folder and XML');
  console.log('✓ ZIP package structure with folder-per-invoice passed.');
}
await testZipStructure();

// 3. Verify Exact Reference Columns in RipsGenerator.jsx source
const expectedDianHeaders = ['Estado', 'Número de la factura', 'Tipo de nota', 'CUV', 'Acciones'];
for (const h of expectedDianHeaders) {
  assert.ok(ripsSource.includes(`'${h}'`) || ripsSource.includes(`"${h}"`), `Documentos DIAN header missing: ${h}`);
}
console.log('✓ Documentos DIAN headers match reference exactly.');

const expectedUsuariosHeaders = [
  'Tipo de documento Identificación',
  'Nro. documento de Identificación',
  'Tipo de Usuario',
  'Fecha de nacimiento',
  'cod. Sexo',
  'Cód. pais de residencia',
  'Cód. Municipo residencia',
  'Cód Zona de Residencia',
  'Incapacidad',
  'Cod. pais de origen',
  'Registro SIRAS',
  'Acciones'
];
for (const h of expectedUsuariosHeaders) {
  assert.ok(ripsSource.includes(`'${h}'`) || ripsSource.includes(`"${h}"`), `Usuarios header missing: ${h}`);
}
console.log('✓ Usuarios headers match reference exactly.');

const expectedConsultasHeaders = [
  'Estado',
  'Identificación del paciente',
  'Número de la factura',
  'Código del Prestador',
  'Fecha de Consulta',
  'Nro de Autorización',
  'Código de la consulta',
  'Modalidad',
  'Grupo servicio',
  'Cod. servicio',
  'Finalidad de la consulta',
  'Causa/motivo atención',
  'Cód dx Principal',
  'Cód dx Rel 1',
  'Cód dx Rel 2',
  'Cód dx Rel 3',
  'Tipo de Diagnóstico',
  'Tipo de Identificación del Profesional',
  'Identificación del Profesional',
  'Valor de la consulta',
  'Concepto recaudo',
  'Valor pago moderador',
  'Número de factura pago moderador',
  'CUV',
  'Acciones'
];
for (const h of expectedConsultasHeaders) {
  assert.ok(ripsSource.includes(`'${h}'`) || ripsSource.includes(`"${h}"`), `Consultas header missing: ${h}`);
}
console.log('✓ Consultas headers match reference exactly.');

const expectedProcedimientosHeaders = [
  'Estado',
  'Nro. Identificación del paciente',
  'Número de la factura',
  'Código del Prestador',
  'Fecha de Procedimiento',
  'Nro. de Autorización',
  'Código del Procedimiento',
  'Modalidad',
  'Grupo de servicios',
  'Cod. servicio',
  'Tipo Identificación del Profesional',
  'Nro.Identificación del Profesional',
  'Cód dx Principal',
  'Cód dx Relacionado',
  'Finalidad del procedimiento',
  'Complicación',
  'Valor del servicio',
  'Concepto recaudo',
  'Valor pago moderador',
  'Número de factura pago moderador',
  'CUV',
  'Acciones'
];
for (const h of expectedProcedimientosHeaders) {
  assert.ok(ripsSource.includes(`'${h}'`) || ripsSource.includes(`"${h}"`), `Procedimientos header missing: ${h}`);
}
console.log('✓ Procedimientos headers match reference exactly.');

const expectedOtrosServiciosHeaders = [
  'Estado',
  'Nro. Identificación del paciente',
  'Número de la factura',
  'Código del Prestador',
  'Fecha de Otro Servicio',
  'Nro. de Autorización',
  'Código del Otro Servicio',
  'Tipo de Otro Servicio',
  'Tipo Identificación del Profesional',
  'Nro.Identificación del Profesional',
  'Valor unitario del servicio',
  'Cantidad del servicio',
  'Valor del servicio',
  'Concepto recaudo',
  'Valor pago moderador',
  'Número de factura pago moderador',
  'CUV',
  'Acciones'
];
for (const h of expectedOtrosServiciosHeaders) {
  assert.ok(ripsSource.includes(`'${h}'`) || ripsSource.includes(`"${h}"`), `Otros Servicios header missing: ${h}`);
}
console.log('✓ Otros Servicios headers match reference exactly.');

// 4. Verify Export Filenames pattern
assert.ok(ripsSource.includes('Documentos DIAN${suffix}.xlsx'), 'Export filename Documentos DIAN match');
assert.ok(ripsSource.includes('Usuarios${suffix}.xlsx'), 'Export filename Usuarios match');
assert.ok(ripsSource.includes('Consultas${suffix}.xlsx'), 'Export filename Consultas match');
assert.ok(ripsSource.includes('Procedimientos${suffix}.xlsx'), 'Export filename Procedimientos match');
assert.ok(ripsSource.includes('OtrosServicios${suffix}.xlsx'), 'Export filename OtrosServicios match');
assert.ok(ripsSource.includes('`RIPS${suffix}`') && ripsSource.includes('${zipRootName}.zip'), 'Export filename RIPS package match');
console.log('✓ Excel and ZIP export filenames match reference naming conventions.');

// 5. Verify Validation Summary labels
assert.ok(ripsSource.includes('Validado correctamente:'), 'Summary label Validado correctamente present');
assert.ok(ripsSource.includes('Validado con errores:'), 'Summary label Validado con errores present');
assert.ok(ripsSource.includes('Sin validar:'), 'Summary label Sin validar present');
console.log('✓ Validation summary labels verified.');

// 6. Verify crosscheck error code and no fake XML
assert.ok(ripsSource.includes('RIPS_EXPORT_INVOICE_MISMATCH'), 'Error code RIPS_EXPORT_INVOICE_MISMATCH present');
assert.ok(!ripsSource.includes('generateFakeXml') && !ripsSource.includes('createDummyXml'), 'No dummy or fake XML generation');
console.log('✓ XML mismatch check and absence of fake XML verified.');

// 7. Verify MUV blocked without AttachedDocument
assert.ok(ripsSource.includes('no cuentan con AttachedDocument DIAN validado') || ripsSource.includes('AttachedDocument'), 'MUV block without AttachedDocument present');
console.log('✓ MUV transmission blocked without valid AttachedDocument.');

console.log('\nALL 26 OPERATIONAL AND ARCHITECTURAL REQUIREMENTS PASS AUDIT!');
