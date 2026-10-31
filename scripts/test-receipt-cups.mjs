// Facturas generadas desde recibos de caja: cada procedimiento lleva su CUPS del presupuesto;
// los conceptos sin CUPS usan 001, 002… (igual que Facturas de venta). Sin red ni base de datos.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentConcepts, planItemsOf, planItemCode, invoiceLineCode, receiptConceptAmounts } from '../src/services/receiptInvoiceItems.js';

const plan = { id: 'plan-1', detalles: { items: [
  { id: 'a1', desc: 'RESTAURACIÓN BORDE INCISALES O CÚSPIDES', codigo_cups: '232101', amount: 800000, qty: 1 },
  { id: 'a2', desc: 'RESTAURACIÓN SUPERFICIE OCLUSAL', code: '232102', amount: 850000, qty: 1 },
  { id: 'a3', desc: 'CONSULTA DE PRIMERA VEZ', amount: 180000, qty: 1 },
] } };

// 1. Pago desde el paciente: el CUPS sale del procedimiento exacto pagado (por su id).
const concepts = paymentConcepts([
  { itemId: 'a2', desc: 'RESTAURACIÓN SUPERFICIE OCLUSAL', monto: 850000 },
  { itemId: 'a1', desc: 'RESTAURACIÓN BORDE INCISALES O CÚSPIDES', monto: 400000 },
  { itemId: 'a3', desc: 'CONSULTA DE PRIMERA VEZ', monto: 180000 },
], plan);
assert.equal(concepts[0].cups, '232102');
assert.equal(concepts[1].cups, '232101', 'un abono parcial también lleva el CUPS');
assert.equal(concepts[2].cups, undefined, 'si el procedimiento no tiene CUPS no se inventa');
assert.equal(concepts[1].total, 400000);
console.log('PASS: cada procedimiento pagado conserva el CUPS de su presupuesto.');

// 2. Recibos nuevos traen el CUPS guardado: sirve aunque el presupuesto cambie o se borre.
assert.equal(paymentConcepts([{ itemId: 'zz', desc: 'X', monto: 1, codigo_cups: '890304' }], null)[0].cups, '890304');
// Detalles guardados como lista o como texto JSON también se leen.
assert.equal(planItemsOf({ detalles: JSON.stringify(plan.detalles) }).length, 3);
assert.equal(planItemsOf({ detalles: plan.detalles.items }).length, 3);
console.log('PASS: el CUPS queda guardado en el recibo y se lee en cualquier formato del presupuesto.');

// 3. Nunca se toma como CUPS un código interno.
for (const c of ['SERV-0001', 'SERV-0002', '001', 'ITEM-mvuyvywp', '']) assert.equal(planItemCode({ codigo_cups: c }), '', c);
assert.equal(planItemCode({ codigo_cups: ' 890304 ' }), '890304');
console.log('PASS: SERV-0001, 001 o ITEM-… nunca se confunden con un CUPS.');

// 4. Código del renglón: CUPS si hay; si no, 001, 002… según el renglón (no se repite SERV-0001).
let n = 0;
const codes = [{ cups: '232102' }, { concepto: 'Abono a tratamiento' }, { code: 'SERV-0001' }, {}].map((c) => invoiceLineCode(c, ++n));
assert.deepEqual(codes, ['232102', '002', '003', '004']);
console.log('PASS: los conceptos sin CUPS usan 001, 002… como en Facturas de venta.');

// 5. Los importes no cambian.
assert.deepEqual(receiptConceptAmounts(concepts[1], { conceptos: concepts, total: 1430000, consecutivoNumero: 9 }),
  { cantidad: 1, descuento: 0, total: 400000, precioUnitario: 400000 });
console.log('PASS: los valores del recibo pasan a la factura igual que antes.');

// 6. Conexiones en las pantallas.
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const list = await read('src/modules/facturacion/recibo/ReciboCajaList.jsx');
assert.ok(!list.includes('`SERV-${'), 'ya no se arma SERV-000N en recibos');
assert.ok(list.includes('paymentConcepts(metadata.itemPayments, paidPlan)'));
assert.equal((list.match(/invoiceLineCode\(/g) || []).length, 2);
const pago = await read('src/modules/pacientes/components/PagoTab.jsx');
assert.ok(pago.includes('...(item.codigo_cups ? { codigo_cups: item.codigo_cups } : {}),'));
const form = await read('src/modules/facturacion/electronica/FacturaElectronicaForm.jsx');
assert.ok(form.includes('const cups = rawCode || String(idx + 1).padStart(3, "0");'));
assert.ok(!form.includes('isSalud ? "SERV-0001"'));
// Al abrir la factura, el CUPS del recibo llega al formulario como CUPS real.
assert.ok(form.includes('cups: isGeneratedItemCode(it.cups || it.code) ? "" : (it.cups || it.code || ""),'));
assert.ok(form.includes('const rawCode = it.codigo_cups || it.cups ||'));
console.log('PASS: recibos, pago del paciente y factura usan el mismo criterio de códigos.');
