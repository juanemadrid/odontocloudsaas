import assert from 'node:assert/strict';
import { normalizeRipsBillingSource, safeParseNotas } from '../src/modules/rips/v003/adapters/ripsBillingSourceAdapter.js';

console.log('--- TEST SUITE: RIPS BILLING SOURCE NORMALIZATION ---');

// Mock context: patient treatment plan with 1 consultation and 1 procedure
const mockPatientPlanes = [
  {
    id: 'plan-100',
    paciente_id: 'pac-maria-elena',
    items: [
      {
        id: 'item-consulta-1',
        desc: 'Consulta odontológica de primera vez',
        codigo: '890201',
        codigo_cups: '890201',
        asocConsultaId: 'doc-clinico-consulta-123',
        amount: 200000,
        qty: 1,
        realizado: true,
        fechaRealizado: '2026-09-27'
      },
      {
        id: 'item-proc-2',
        desc: 'Profilaxis dental',
        codigo: '997100',
        codigo_cups: '997100',
        evolutionId: 'evo-profilaxis-456',
        amount: 80000,
        qty: 1,
        realizado: true,
        fechaRealizado: '2026-09-27'
      }
    ]
  }
];

// 1. pagos.paciente_id se resuelve correctamente (snake_case)
const rawPago1 = {
  id: 'd89c0a0c-3456-789a-bcde-0123456789ab',
  paciente_id: 'pac-maria-elena',
  monto: 200000,
  notas: JSON.stringify({
    nroConsecutivo: '0001',
    planId: 'plan-100',
    itemPayments: [
      { itemId: 'item-consulta-1', desc: 'Consulta odontológica', monto: 200000 }
    ]
  }),
  fecha: '2026-09-27T10:00:00Z'
};

const norm1 = normalizeRipsBillingSource(rawPago1, 'pagos', { patientPlanes: mockPatientPlanes });
assert.equal(norm1.pacienteId, 'pac-maria-elena', 'Case 1: pagos.paciente_id must resolve');
console.log('✓ Case 1: pagos.paciente_id resolved correctly.');

// 2. notas JSON object se lee directamente
const rawPago2 = {
  id: 'pay-2',
  paciente_id: 'pac-maria-elena',
  notas: {
    nroConsecutivo: '0002',
    itemPayments: [{ itemId: 'item-consulta-1', monto: 200000 }]
  }
};
const norm2 = normalizeRipsBillingSource(rawPago2, 'pagos', { patientPlanes: mockPatientPlanes });
assert.equal(norm2.documentNumber, 'RC-0002', 'Case 2: notas as object must be read');
console.log('✓ Case 2: notas JSON object parsed.');

// 3. notas JSON string se parsea
const parsedNotas = safeParseNotas('{"nroConsecutivo":"0003"}');
assert.equal(parsedNotas.data.nroConsecutivo, '0003', 'Case 3: safeParseNotas string');
console.log('✓ Case 3: notas JSON string parsed safely.');

// 4. nroConsecutivo sale de notas
assert.equal(norm1.documentNumber, 'RC-0001', 'Case 4: documentNumber formatted as RC-0001');
console.log('✓ Case 4: nroConsecutivo extracted and formatted.');

// 5. itemPayments se recupera
assert.equal(norm1.items.length, 1, 'Case 5: itemPayments array extracted');
console.log('✓ Case 5: itemPayments retrieved.');

// 6. CUPS se conserva
assert.equal(norm1.items[0].cups, '890201', 'Case 6: CUPS 890201 preserved from plan item');
console.log('✓ Case 6: Real CUPS preserved.');

// 7. asocConsultaId se conserva
assert.equal(norm1.items[0].asocConsultaId, 'doc-clinico-consulta-123', 'Case 7: asocConsultaId preserved');
console.log('✓ Case 7: asocConsultaId preserved.');

// 8. Consulta pagada clasifica como CONSULTA
assert.equal(norm1.items[0].es_consulta, true, 'Case 8: consultation payment must classify as es_consulta');
console.log('✓ Case 8: Consultation classified correctly.');

// 9. Procedimiento pagado clasifica como PROCEDIMIENTO
const rawPagoProc = {
  id: 'pay-proc-1',
  paciente_id: 'pac-maria-elena',
  notas: JSON.stringify({
    nroConsecutivo: '0004',
    itemPayments: [{ itemId: 'item-proc-2', monto: 80000 }]
  })
};
const normProc = normalizeRipsBillingSource(rawPagoProc, 'pagos', { patientPlanes: mockPatientPlanes });
assert.equal(normProc.items[0].es_consulta, false, 'Case 9: procedure payment must not be consultation');
assert.equal(normProc.items[0].cups, '997100', 'Case 9: procedure CUPS preserved');
console.log('✓ Case 9: Procedure classified correctly.');

// 10. No genera SIN_CUPS si CUPS existe
assert.notEqual(norm1.items[0].cups, 'SIN_CUPS', 'Case 10: must not be SIN_CUPS');
assert.ok(norm1.items[0].cups.length === 6, 'Case 10: CUPS has 6 chars');
console.log('✓ Case 10: No SIN_CUPS fallback when CUPS exists.');

// 11. No usa UUID fallback visible si existe nroConsecutivo
assert.equal(norm1.documentNumber, 'RC-0001', 'Case 11: Document number is RC-0001, not UUID substring');
assert.ok(!norm1.documentNumber.includes('d89c0a0c'), 'Case 11: Not UUID fallback');
console.log('✓ Case 11: UUID fallback avoided when consecutivo exists.');

// 12. Receipt/payment queda LOCAL_PREVIEW
assert.equal(norm1.sourceMode, 'LOCAL_PREVIEW', 'Case 12: sourceMode must be LOCAL_PREVIEW');
assert.equal(norm1.isOfficialInvoice, false, 'Case 12: isOfficialInvoice must be false');
console.log('✓ Case 12: LOCAL_PREVIEW mode set.');

// 13. MUV bloqueado para LOCAL_PREVIEW
function canSendToMuv(doc) {
  if (doc.sourceMode === 'LOCAL_PREVIEW' || !doc.isOfficialInvoice) {
    return { allowed: false, reason: 'OFFICIAL_FEV_REQUIRED' };
  }
  return { allowed: true };
}
const muvCheck = canSendToMuv(norm1);
assert.equal(muvCheck.allowed, false, 'Case 13: MUV must be blocked');
assert.equal(muvCheck.reason, 'OFFICIAL_FEV_REQUIRED', 'Case 13: Reason must be OFFICIAL_FEV_REQUIRED');
console.log('✓ Case 13: MUV blocked for LOCAL_PREVIEW.');

// 14. Factura oficial conserva flujo actual
const rawFactura = {
  id: 'fac-uuid-123',
  numeroFactura: 'FCEV1314',
  paciente_id: 'pac-maria-elena',
  total: 200000,
  items: [{ codigo: '890201', descripcion: 'Consulta', total: 200000 }]
};
const normFac = normalizeRipsBillingSource(rawFactura, 'facturas', { patientPlanes: mockPatientPlanes });
assert.equal(normFac.sourceMode, 'OFFICIAL_FEV', 'Case 14: Official invoice has OFFICIAL_FEV mode');
assert.equal(normFac.isOfficialInvoice, true, 'Case 14: isOfficialInvoice is true');
assert.equal(normFac.documentNumber, 'FCEV1314', 'Case 14: Invoice number is FCEV1314');
const muvCheckFac = canSendToMuv(normFac);
assert.equal(muvCheckFac.allowed, true, 'Case 14: MUV allowed for official invoice');
console.log('✓ Case 14: Official invoice flow preserved.');

// 15. Malformed notas produce error controlado
const rawBadNotas = {
  id: 'pay-bad',
  paciente_id: 'pac-1',
  notas: '{ bad json here ::: '
};
const normBad = normalizeRipsBillingSource(rawBadNotas, 'pagos');
assert.ok(normBad.metadataError?.includes('RIPS_PAYMENT_METADATA_INVALID'), 'Case 15: Controlled error on bad JSON');
console.log('✓ Case 15: Malformed notas handled cleanly with controlled error.');

// 16. Maria Elena specific verification
assert.equal(norm1.items[0].asocConsultaId, 'doc-clinico-consulta-123', 'Maria Elena consulta link verified');
assert.equal(norm1.items[0].cups, '890201', 'Maria Elena CUPS verified');
assert.equal(norm1.pacienteId, 'pac-maria-elena', 'Maria Elena pacienteId verified');

console.log('\nALL 16 NORMALIZATION AND PRECHECK TEST CASES PASSED CLEANLY!');
