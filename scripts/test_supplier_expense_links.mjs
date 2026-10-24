import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/supplierExpenseLinks.js', import.meta.url), 'utf8');
const { getExpenseNumber, expenseMatchesInvoice } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const payment = { id: 'pago_liq_1792790521140', tenant_id: 'clinic-a', numero: '1639', monto: 270000 };
const invoice = { id: 'invoice-a', tenant_id: 'clinic-a', nroFactura: 'DCSE775', egresoAsociadoId: payment.id };
assert.equal(getExpenseNumber({ id: payment.id }), '', 'Internal IDs must never become document numbers');
assert.equal(getExpenseNumber(payment), '1639');
assert.equal(expenseMatchesInvoice(payment, invoice), true, 'Invoice-side link must show in expenses');
assert.equal(expenseMatchesInvoice({ ...payment, facturasSeleccionadas: [invoice.id] }, { ...invoice, egresoAsociadoId: null }), true);
assert.equal(expenseMatchesInvoice(payment, { ...invoice, egresoAsociadoId: null, egresosAplicados: [{ egresoId: payment.id, valor: 270000 }] }), true);
assert.equal(expenseMatchesInvoice(payment, { ...invoice, tenant_id: 'clinic-b' }), false);
assert.equal(expenseMatchesInvoice({ ...payment, proveedor: 'Same supplier' }, { id: 'unrelated', proveedor: 'Same supplier', total: 270000 }), false, 'Same name and amount do not prove a relationship');
assert.equal(expenseMatchesInvoice({ items: [{ isFactura: true }] }, { nroFactura: 'DCSE775' }), false);
assert.equal(expenseMatchesInvoice({ ...payment, items: [{ isFactura: true, facturaId: invoice.id }] }, { ...invoice, egresoAsociadoId: null }), true);
console.log('PASS: official numbering, both link directions, legacy references, tenant isolation and unrelated payments');
