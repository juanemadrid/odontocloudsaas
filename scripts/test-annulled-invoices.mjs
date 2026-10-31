// Facturas anuladas con nota crédito: se ven anuladas, no se cobran y no admiten otra nota ni recibos.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { creditAdjustment } = await import('../src/utils/invoiceNumbering.js');

const fcev1347 = { numero: 'FCEV1347', estado: 'Anulado', detalles: { fiscal_adjustment_status: 'FULLY_CREDITED', notasCredito: [{ numero: 'NC2' }] } };
assert.deepEqual(creditAdjustment(fcev1347), { annulled: true, partial: false, notes: ['NC2'], label: 'NC2' });
assert.equal(creditAdjustment({ estado: 'Anulado', detalles: {} }).annulled, true);
const partial = creditAdjustment({ estado: 'Emitido', detalles: { fiscal_adjustment_status: 'PARTIALLY_CREDITED', notasCredito: [{ numero: 'NC3' }] } });
assert.equal(partial.annulled, false); assert.equal(partial.partial, true); assert.equal(partial.label, 'NC3');
assert.deepEqual(creditAdjustment({ estado: 'Emitido', detalles: {} }), { annulled: false, partial: false, notes: [], label: '' });
console.log('PASS: se distingue factura anulada, ajustada parcialmente y vigente.');

const ui = await readFile(new URL('../src/modules/facturacion/electronica/FacturaElectronicaModule.jsx', import.meta.url), 'utf8');
for (const text of ['credit.annulled ? "ANULADA"', 'const saldoPendienteNum = credit.annulled ? 0', 'discarded || credit.annulled ? <span className="text-slate-300">—</span> : <button',
  'Ver ${credit.label || "nota crédito"} (anulada)', 'Anulada con ${creditAdjustment(detailModalFactura).label']) assert.ok(ui.includes(text), text);
const link = await readFile(new URL('../src/services/billingReceiptLinkService.js', import.meta.url), 'utf8');
assert.ok(link.includes('fue anulada con nota crédito; no se le pueden asociar recibos'));
console.log('PASS: la lista muestra ANULADA con la nota, Por pagar $0, sin "+ Asociar" y con "Ver NC" en lugar de generar otra.');
