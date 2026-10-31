// Fecha de factura en hora de Colombia y "Elaborado por" = usuario que factura. Sin red.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { todayBogota, invoiceCalendarDate } from '../src/utils/bogotaDate.js';

// 1. 30-oct-2026 8:49 p. m. en Colombia = 31-oct 01:49 UTC: la fecha debe ser el 30.
assert.equal(todayBogota(new Date('2026-10-31T01:49:12Z')), '2026-10-30');
assert.equal(todayBogota(new Date('2026-10-30T14:00:00Z')), '2026-10-30');
assert.equal(todayBogota(new Date('2026-10-31T05:00:00Z')), '2026-10-31', 'desde la medianoche de Colombia ya es el 31');
assert.equal(invoiceCalendarDate('2026-10-31T01:49:12.000Z'), '2026-10-30');
assert.equal(invoiceCalendarDate('2026-10-30'), '2026-10-30');
assert.equal(invoiceCalendarDate('2026-10-30T00:00:00.000Z'), '2026-10-30', 'fecha sin hora guardada por el formulario');
console.log('PASS: después de las 7 p. m. la factura ya no queda con la fecha de mañana.');

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const form = await read('src/modules/facturacion/electronica/FacturaElectronicaForm.jsx');
assert.ok(form.includes('return todayBogota();'));
assert.ok(form.includes('invoiceCalendarDate(initialFactura.fecha_emision)'));
assert.ok(form.includes('|| fecha || todayBogota()).slice(0, 10);'));
const list = await read('src/modules/facturacion/recibo/ReciboCajaList.jsx');
assert.ok(list.includes('fecha: todayBogota(),'));
const plan = await read('src/modules/pacientes/components/PlanEditor.jsx');
assert.ok(plan.includes('it.fechaRealizado || it.fecha || todayBogota();'));
console.log('PASS: factura, fecha de atención y periodo facturado usan la fecha de Colombia.');

// 2. Elaborado por: el usuario que hizo la factura, no el profesional.
const tpl = await read('src/utils/electronicInvoiceTemplate.js');
const start = tpl.indexOf('// Elaborado por: el usuario que hizo la factura');
const block = tpl.slice(start, tpl.indexOf("'';", start));
assert.ok(start > 0 && !block.includes('?.profesional') && !block.includes('?.doctor') && !block.includes('nombreComercial'));
assert.ok(block.includes('det.creado_por') && block.includes('det.elaborado_por'));
assert.ok(plan.includes("elaborado_por: userProfile?.nombreCompleto || userProfile?.nombre"));
console.log('PASS: "Elaborado por" muestra al usuario que facturó, nunca al profesional.');
