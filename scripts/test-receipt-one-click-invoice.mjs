// "Generar factura" desde Recibos de caja: un clic emite; recibos ya facturados no se pueden volver a marcar.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const list = await readFile(new URL('../src/modules/facturacion/recibo/ReciboCajaList.jsx', import.meta.url), 'utf8');
const form = await readFile(new URL('../src/modules/facturacion/electronica/FacturaElectronicaForm.jsx', import.meta.url), 'utf8');

// 1. La lógica real que decide si un recibo ya está facturado.
const start = list.indexOf('    const receiptInvoiceNumber = (r) => {');
const end = list.indexOf('    const isUUID = (str) =>');
const receiptInvoiceNumber = new Function(list.slice(start, end) + '\nreturn receiptInvoiceNumber;')();
assert.equal(receiptInvoiceNumber({ docRefNumber: 'FCEV1350', associatedDoc: { numero: 'FCEV1350', rawFactura: { estado: 'Emitido' } } }), 'FCEV1350');
assert.equal(receiptInvoiceNumber({ docRefNumber: 'BORRADOR-OC-1', associatedDoc: { numero: 'BORRADOR-OC-1', rawFactura: { estado: 'Pendiente' } } }), 'BORRADOR-OC-1');
assert.equal(receiptInvoiceNumber({ docRefNumber: 'BORRADOR-OC-2', associatedDoc: { numero: 'BORRADOR-OC-2', rawFactura: { estado: 'Cancelado' } } }), '');
assert.equal(receiptInvoiceNumber({ docRefNumber: null, associatedDoc: null, fevNumero: null }), '');
console.log('PASS: un recibo ya facturado (o con borrador vigente) queda bloqueado; uno libre o de borrador cancelado se puede marcar.');

// 2. Cableado: casilla reemplazada por candado, "seleccionar todo" excluye facturados, emisión automática.
assert.ok(list.includes('{receiptInvoiceNumber(r) ? ('));
assert.ok(list.includes('&& !receiptInvoiceNumber(r));'));
assert.ok(list.includes('initialFactura={invoiceToReview}\n            autoEmit'));
assert.ok(!list.includes('Borrador guardado. Revise los datos fiscales'));
assert.ok(form.includes('initialFactura = null, autoEmit = false }'));
assert.ok(form.includes('Promise.resolve(handleSaveFactura()).finally(() => setAutoEmitPending(false));'));
assert.ok(form.includes('autoEmitStarted.current = true;'), 'solo se intenta una vez');
assert.ok(form.indexOf('if (!autoEmit || !initialFactura || autoEmitStarted.current || !initialDataReady || !billingCfgReady) return;') > 0, 'espera a que carguen tercero y configuración');
console.log('PASS: un solo clic emite con el mismo proceso de Facturas de venta, una sola vez y con los datos ya cargados.');
