// Comprobante de egreso: misma impresión desde Egresos y desde Facturas de compra. Sin red ni base de datos.
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) {
      return { url: 'data:text/javascript,export default {};export const supabase={};export const supabaseUrl="http://x";export const supabaseAnonKey="k";', shortCircuit: true };
    }
    return next(specifier, context);
  }`));
const { prepareExpensePrint, cleanExpenseObservation, matchBeneficiary } = await import('../src/services/expensePrintService.js');

// Egreso real 1649, generado desde Liquidaciones (sin documento ni celular del beneficiario).
const egreso1649 = {
  id: 'pago_liq_1', consecutivo: '1649', fecha: '2026-10-29', tercero: 'ELIECER JOSE HERNÁNDEZ DEL CASTILLO',
  profesional: 'ELIECER JOSE HERNÁNDEZ DEL CASTILLO', medioPago: 'Efectivo', concepto: 'Liquidación comisiones',
  monto: 150000, total: 150000, liquidacionId: 'liq_1793317308503', created_by: 'MARIA ARROYO',
  items: [{ concepto: 'Liquidación comisiones', cantidad: 1, precio: 150000, total: 150000 }],
  observaciones: 'Generado automáticamente desde módulo de Liquidaciones. Liquidación ID: liq_1793317308503',
};
const dcse782 = { id: 'fc782', nroFactura: 'DCSE782', proveedor: 'ELIECER JOSE HERNÁNDEZ DEL CASTILLO',
  documentoTercero: '1083043573-6', telefono: '3024237917', egresoAsociadoId: 'pago_liq_1', total: 150000 };
const sources = { facturasMap: { fc782: dcse782, DCSE782: dcse782 }, purchases: [dcse782], candidates: [{ __compra: true,
  nombre: dcse782.proveedor, documento: dcse782.documentoTercero, telefono: dcse782.telefono }] };

const desdeEgresos = await prepareExpensePrint({ tenantId: 't', pago: egreso1649, sources });
const desdeCompras = await prepareExpensePrint({ tenantId: 't', pago: egreso1649, fallbackFactura: dcse782, sources });
for (const r of [desdeEgresos, desdeCompras]) {
  assert.equal(r.patientPayload.documento, '1083043573-6');
  assert.equal(r.patientPayload.celular, '3024237917');
  assert.deepEqual(r.pagoPayload.itemPayments, [{ desc: 'Liquidación comisiones', monto: 150000, precioUnitario: 150000, cantidad: 1 }]);
  assert.equal(r.pagoPayload.observaciones, 'Generado automáticamente desde módulo de Liquidaciones.');
  assert.equal(r.pagoPayload.nroConsecutivo, '1649');
  assert.equal(r.pagoPayload.monto, 150000);
}
assert.deepEqual(desdeEgresos.patientPayload, desdeCompras.patientPayload);
assert.deepEqual(desdeEgresos.pagoPayload.itemPayments, desdeCompras.pagoPayload.itemPayments);
console.log('PASS: el egreso 1649 sale igual desde Egresos y desde Facturas de compra (documento, celular, concepto y valores).');

assert.equal(cleanExpenseObservation('Generado automáticamente desde módulo de Liquidaciones. Liquidación ID: liq_1'), 'Generado automáticamente desde módulo de Liquidaciones.');
assert.equal(cleanExpenseObservation('Pago de arriendo'), 'Pago de arriendo');
console.log('PASS: observaciones sin el ID interno de la liquidación.');

// Sin datos y con nombres repetidos de personas distintas: no se inventa el documento.
const twins = matchBeneficiary({ tercero: 'ANA PEREZ' }, null, [{ nombre: 'ANA PEREZ', nroDocumento: '111' }, { nombre: 'ana pérez', nroDocumento: '222' }]);
assert.equal(twins.documento, '');
// Ítems antiguos con precio/valor en vez de total y egreso sin ítems.
const legacy = await prepareExpensePrint({ tenantId: 't', pago: { tercero: 'X', monto: 50000, items: [{ concepto: 'Insumos', valor: 25000, cantidad: 2 }] },
  sources: { facturasMap: {}, purchases: [], candidates: [] } });
assert.deepEqual(legacy.pagoPayload.itemPayments[0], { desc: 'Insumos', monto: 50000, precioUnitario: 25000, cantidad: 2 });
const empty = await prepareExpensePrint({ tenantId: 't', pago: { tercero: 'X', monto: 70000 }, fallbackFactura: { nroFactura: 'DS9', total: 70000 },
  sources: { facturasMap: {}, purchases: [], candidates: [] } });
assert.equal(empty.pagoPayload.itemPayments[0].desc, 'Pago Factura / Documento Soporte: DS9');
assert.ok(!JSON.stringify([legacy, empty]).includes('NaN') && !JSON.stringify([legacy, empty]).includes('undefined'));
console.log('PASS: nunca imprime UNDEFINED ni $NaN; no inventa documentos con nombres ambiguos.');
