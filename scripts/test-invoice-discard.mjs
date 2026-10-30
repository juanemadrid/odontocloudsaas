// Numeración sin falsos consecutivos y descarte seguro de intentos rechazados.
// No usa la red ni la base de datos: el cliente es un doble en memoria.
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Sin red ni base de datos: el cliente real de Supabase se reemplaza por un doble vacío.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) {
      return { url: 'data:text/javascript,export default {};export const supabase={};', shortCircuit: true };
    }
    return next(specifier, context);
  }`));
const {
  NO_FISCAL_NUMBER_LABEL, fiscalInvoiceNumber, invoiceDisplayNumber, isDiscardedInvoice,
  isProvisionalInvoiceNumber, newProvisionalInvoiceNumber,
} = await import('../src/utils/invoiceNumbering.js');
const { canDiscardInvoice, discardBlockReason, discardRejectedInvoice } = await import('../src/services/invoiceDiscardService.js');
const { getFevRetryDecision } = await import('../src/services/factusRetryService.js');
const { generateElectronicInvoiceHtml } = await import('../src/utils/electronicInvoiceTemplate.js');

// 1. Etiquetas internas frente a números fiscales.
for (const n of ['FE-8181', 'FE-9500', 'fe-7997', newProvisionalInvoiceNumber(1761830000000, () => 0.5)]) {
  assert.ok(isProvisionalInvoiceNumber(n), n);
}
for (const n of ['FCEV1347', 'FCEV-0013', 'SETP990000001', 'BORRADOR-OC-1', '']) assert.ok(!isProvisionalInvoiceNumber(n), n);
assert.match(newProvisionalInvoiceNumber(), /^SIN-DIAN-[A-Z0-9]+$/);
assert.notEqual(newProvisionalInvoiceNumber(1, () => 0.1), newProvisionalInvoiceNumber(1, () => 0.9));

const rejected = {
  id: 'inv-8181', tenant_id: 'clinic', numero: 'FE-8181', estado: 'Pendiente', total: 1200000,
  detalles: {
    dianStatus: 'RECHAZADA', factusInvoiceNumber: null, saldo_pendiente: 1200000,
    recibos_asociados: [], factusReferenceCode: 'OC-MVUYVYWO',
    fevAttempts: [{ attempt_number: 1, status: 'FACTUS_VALIDATION_REJECTED', is_validated: false,
      factus_status: 'RECHAZADA', error_message: 'Errores de validación en: El campo código tributo es inválido.' }],
  },
};
// La lista mezclaba la etiqueta con el número de Factus: ahora nunca.
assert.equal(fiscalInvoiceNumber({ ...rejected, factusInvoiceNumber: 'FE-8181' }), null);
assert.equal(invoiceDisplayNumber(rejected), NO_FISCAL_NUMBER_LABEL);
assert.equal(invoiceDisplayNumber({ numero: 'FCEV1347', detalles: { factusInvoiceNumber: 'FCEV1347' } }), 'FCEV1347');
assert.equal(invoiceDisplayNumber({ numero: 'BORRADOR-OC-a0e' }), 'BORRADOR-OC-a0e');
assert.equal(invoiceDisplayNumber({ id: 'abcd1234', numero: null }), NO_FISCAL_NUMBER_LABEL);
console.log('PASS: las etiquetas FE-xxxx / SIN-DIAN-… nunca se presentan como consecutivo DIAN.');

// 2. Impresión: sin número inventado.
const printed = generateElectronicInvoiceHtml({ factura: rejected, patient: { nombreCompleto: 'X' }, items: [] });
assert.ok(printed.includes('SIN NÚMERO DIAN'));
assert.ok(printed.includes('No. SIN NÚMERO DIAN') && !printed.includes('FE-8181'));
const printedReal = generateElectronicInvoiceHtml({ factura: { numero: 'FCEV1347', total: 1 }, patient: {}, items: [] });
assert.ok(printedReal.includes('No. FCEV1347'));
console.log('PASS: la impresión dice "SIN NÚMERO DIAN" y conserva los números reales.');

// 3. Qué se puede descartar.
assert.equal(discardBlockReason(rejected), null);
// Estado exacto de FE-8181 / FE-9500 / FE-7997 en producción (30-10-2026).
const prodState = { ...rejected, detalles: { ...rejected.detalles, technicalError: false, factusExists: null,
  factusIsValidated: false, pending409: null, receiptLinkState: null, monto_pagado: 0,
  fevAttempts: [{ status: 'FACTUS_VALIDATION_REJECTED', error_code: '422', is_validated: false }] } };
assert.equal(getFevRetryDecision(prodState).reason, 'FACTUS_VALIDATION_FAILED');
assert.equal(discardBlockReason(prodState), null);
const blocked = [
  { ...rejected, numero: 'FCEV1347', detalles: { ...rejected.detalles, dianStatus: 'ACEPTADA', cufe: 'c'.repeat(96) } },
  { ...rejected, detalles: { ...rejected.detalles, factusExists: true } },
  { ...rejected, detalles: { ...rejected.detalles, pending409: true } },
  { ...rejected, detalles: { ...rejected.detalles, technicalError: true, dianStatus: 'INDETERMINADO' } },
  { ...rejected, detalles: { ...rejected.detalles, recibos_asociados: [{ id: 'r1', monto: 1 }] } },
  { ...rejected, detalles: { ...rejected.detalles, fevAttempts: [{ status: 'DIAN_REJECTED', is_validated: true }] } },
  { ...rejected, detalles: { ...rejected.detalles, descartada: true } },
];
for (const invoice of blocked) assert.ok(!canDiscardInvoice(invoice), JSON.stringify(invoice.detalles).slice(0, 90));
console.log('PASS: no se descarta nada con CUFE, registrado en Factus, en duda, con recibos o rechazado por la DIAN.');

// 4. Descarte real contra un doble de la base de datos.
const makeDb = (row) => {
  const db = { row: structuredClone(row), updates: [] };
  db.from = () => {
    const filters = []; let patch = null;
    const q = {
      select: () => q, update: (v) => { patch = v; return q; },
      eq: (col, val) => { filters.push([col, val]); return q; },
      single: async () => {
        const ok = filters.every(([c, v]) => c === 'detalles' ? JSON.stringify(db.row.detalles) === v : db.row[c] === v);
        if (!ok) return { data: null, error: { message: 'no rows' } };
        if (patch) { db.updates.push(patch); db.row = { ...db.row, ...patch }; return { data: { id: db.row.id }, error: null }; }
        return { data: structuredClone(db.row), error: null };
      },
    };
    return q;
  };
  return db;
};
const db = makeDb(rejected);
await assert.rejects(discardRejectedInvoice({ invoiceId: 'inv-8181', tenantId: 'clinic', reason: 'no', client: db }), /motivo/);
await assert.rejects(discardRejectedInvoice({ invoiceId: 'inv-8181', tenantId: 'otra', reason: 'Intento duplicado', client: db }), /No se pudo leer/);
await discardRejectedInvoice({ invoiceId: 'inv-8181', tenantId: 'clinic', reason: 'Intento duplicado de la misma venta',
  userProfile: { nombreCompleto: 'Maria Arroyo', uid: 'u1' }, client: db });
assert.equal(db.updates.length, 1);
assert.equal(db.row.estado, 'Cancelado');
assert.equal(db.row.numero, 'FE-8181', 'el registro no se borra ni se renumera');
assert.equal(db.row.total, 1200000);
assert.equal(db.row.detalles.descartada, true);
assert.equal(db.row.detalles.saldo_pendiente, 0);
assert.equal(db.row.detalles.descarte.usuario, 'Maria Arroyo');
assert.equal(db.row.detalles.descarte.saldo_anterior, 1200000);
assert.deepEqual(db.row.detalles.fevAttempts, rejected.detalles.fevAttempts, 'el historial de intentos se conserva');
assert.ok(isDiscardedInvoice(db.row));
const decision = getFevRetryDecision(db.row);
assert.equal(decision.canRetry, false);
assert.equal(decision.reason, 'DISCARDED_ATTEMPT');
await assert.rejects(discardRejectedInvoice({ invoiceId: 'inv-8181', tenantId: 'clinic', reason: 'Otra vez el mismo', client: db }), /ya fue descartado/);
console.log('PASS: el descarte conserva el registro, sale de cartera y bloquea cualquier reenvío.');

// 5. Otra sesión cambió la factura entre la lectura y la escritura: no se toca.
const race = makeDb(rejected);
const originalFrom = race.from;
let reads = 0;
race.from = (t) => {
  const q = originalFrom(t);
  const single = q.single;
  q.single = async () => { const r = await single(); if (reads++ === 0) race.row.detalles = { ...race.row.detalles, technicalError: false, otro: 1 }; return r; };
  return q;
};
await assert.rejects(discardRejectedInvoice({ invoiceId: 'inv-8181', tenantId: 'clinic', reason: 'Intento duplicado', client: race }), /Otra sesión/);
assert.equal(race.row.estado, 'Pendiente');
console.log('PASS: si otra sesión modifica la factura a la vez, el descarte no se aplica.');
