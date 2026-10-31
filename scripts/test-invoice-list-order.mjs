// Lista de facturas de venta: orden por consecutivo (también anuladas), 10 por página y
// "+ Asociar" sin el texto "No hay recibo de caja asociado". Sin red.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sortInvoicesByConsecutive, paginate } from '../src/utils/invoiceNumbering.js';

const inv = (numero, created, extra = {}) => ({ id: numero, numero, createdAt: created, detalles: { factusInvoiceNumber: numero.startsWith('FCEV') ? numero : undefined, ...extra } });
// El orden en que llegaban (como en la pantalla): las anuladas y algunas otras quedaban fuera de lugar.
const list = [
  inv('FCEV1357', '2026-10-30T20:49'), inv('FCEV1350', '2026-10-28'), inv('FCEV1348', '2026-10-27'),
  inv('FCEV1347', '2026-10-27', { fiscal_adjustment_status: 'FULLY_CREDITED' }), inv('FCEV1345', '2026-10-25', { fiscal_adjustment_status: 'FULLY_CREDITED' }),
  inv('FCEV1344', '2026-10-25'), inv('FCEV1349', '2026-10-20'), inv('FCEV1346', '2026-10-19'), inv('FCEV1343', '2026-10-17'),
  inv('SIN-DIAN-ABC', '2026-10-29'),
];
const order = sortInvoicesByConsecutive(list).map((f) => f.numero);
assert.deepEqual(order, ['SIN-DIAN-ABC', 'FCEV1357', 'FCEV1350', 'FCEV1349', 'FCEV1348', 'FCEV1347', 'FCEV1346', 'FCEV1345', 'FCEV1344', 'FCEV1343']);
assert.equal(list[0].numero, 'FCEV1357', 'no modifica la lista original');
console.log('PASS: las facturas siguen el consecutivo, también las anuladas; los intentos sin número DIAN van arriba.');

const many = Array.from({ length: 23 }, (_, i) => i + 1);
assert.deepEqual(paginate(many, 1).rows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(paginate(many, 3), { rows: [21, 22, 23], page: 3, pages: 3, total: 23, from: 21, to: 23 });
assert.equal(paginate(many, 9).page, 3, 'una página que ya no existe muestra la última');
assert.deepEqual(paginate([], 1), { rows: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
console.log('PASS: se muestran 10 facturas por página.');

const src = (await readFile(new URL('../src/modules/facturacion/electronica/FacturaElectronicaModule.jsx', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
assert.ok(src.includes('return sortInvoicesByConsecutive(facturas).filter((f) => {'));
assert.ok(src.includes('{pageData.rows.map((f) => {'));
assert.ok(src.includes('Página {pageData.page} de {pageData.pages}'));
const cell = src.slice(src.indexOf('title="Ver detalle del recibo asociado"'), src.indexOf('+ Asociar'));
assert.ok(!cell.includes('No hay recibo de caja asociado'), 'en la lista solo queda el botón');
console.log('PASS: en la lista solo queda "+ Asociar" (sin el texto largo).');
