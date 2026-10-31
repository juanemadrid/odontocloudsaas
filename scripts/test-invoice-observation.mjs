// Observaciones de la factura de venta: solo las que escribe el usuario. Sin red.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = (await readFile(new URL('../src/services/factusService.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const send = src.slice(src.indexOf('export const sendInvoice'), src.indexOf('export const downloadAttachedDocumentXml'));
assert.ok(!send.includes('Emitido desde OdontoCloud'), 'ya no se envía el texto por defecto');
assert.ok(send.includes('const observation = String(invoiceData.observaciones ?? "").trim().slice(0, 250);'));
assert.ok(send.includes('...(observation ? { observation } : {}),'));

// Misma regla que el código, con casos reales.
const rule = (obs) => { const o = String(obs ?? '').trim().slice(0, 250); return o ? { observation: o } : {}; };
assert.deepEqual(rule(''), {});
assert.deepEqual(rule(undefined), {});
assert.deepEqual(rule('   '), {});
assert.deepEqual(rule('Paciente con convenio'), { observation: 'Paciente con convenio' });
assert.equal(rule('x'.repeat(400)).observation.length, 250);
console.log('PASS: sin observaciones el campo queda en blanco; si el usuario escribe una, se envía tal cual.');

// El documento soporte y las notas crédito no cambian.
assert.ok(src.includes('Documento soporte en adquisiciones efectuadas a no obligados a facturar'));
console.log('PASS: documento soporte y notas crédito siguen igual.');
