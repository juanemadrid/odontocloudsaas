import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { factusPaymentCode } from '../src/services/factusPayment.js';
import { receiptConceptAmounts } from '../src/services/receiptInvoiceItems.js';

const receipt = { consecutivoNumero: 2076, total: 190000, conceptos: [{}] };
assert.deepEqual(receiptConceptAmounts({ precioUnitario:190000, total:190000 }, receipt),
  { precioUnitario:190000, total:190000, cantidad:1, descuento:0 });
assert.deepEqual(receiptConceptAmounts({ precioUnitario:100000, cantidad:2, descuento:5000, total:190000 }, receipt),
  { precioUnitario:100000, total:190000, cantidad:2, descuento:10000 });
assert.equal(receiptConceptAmounts({ total:190000, cantidad:2 }, receipt).precioUnitario,95000);
assert.throws(() => receiptConceptAmounts({}, { ...receipt, conceptos:[{},{}] }), /inconsistentes/);
assert.throws(() => receiptConceptAmounts({ precioUnitario:0, total:190000 }, receipt), /inconsistentes/);
assert.throws(() => receiptConceptAmounts({ precioUnitario:100000, total:190000 }, receipt), /inconsistentes/);
console.log('PASS: receipt unit prices, quantities, per-unit discounts and missing/inconsistent line amounts.');

// Exercise the actual status handler with a deferred transport and rapid clicks.
const moduleSource = await readFile(new URL('../src/modules/facturacion/electronica/FacturaElectronicaModule.jsx', import.meta.url), 'utf8');
const statusHandler = moduleSource.slice(moduleSource.indexOf('  const handleCheckStatus ='), moduleSource.indexOf('  const handleStartCorrection ='));
let finishStatusCheck;
let checkCalls = 0, releaseCalls = 0, busyInvoice = null;
const statusSandbox = vm.createContext({
  statusChecksInFlight: { current: new Set() },
  setStatusCheckingId: value => { busyInvoice = typeof value === 'function' ? value(busyInvoice) : value; },
  acquireFevBackendLock: async () => ({lockToken:'owned'}),
  releaseFevBackendLock: async () => { releaseCalls++; },
  getOrGenerateAuthoritativeReferenceCode: () => 'stable',
  checkFactusBillStatus: async () => { checkCalls++; return new Promise(resolve => { finishStatusCheck = resolve; }); },
  supabase: { from: () => ({update: () => ({eq: () => ({eq: async () => ({error:null})})})}) },
  inquilino:'clinic', userProfile:{}, FEV_LOCK_STATE:{CHECKING_STATUS:'CHECKING_STATUS'},
  toast:{info(){},error(){},success(){},warning(){}}, console,
  loadFacturas:async () => {}, reconcileFactusInvoice:async () => {},
});
vm.runInContext(statusHandler + '\nthis.runCheck = handleCheckStatus;', statusSandbox);
const firstCheck = statusSandbox.runCheck({id:'invoice',detalles:{}});
await Promise.resolve();
await statusSandbox.runCheck({id:'invoice',detalles:{}});
assert.equal(checkCalls,1);
assert.equal(busyInvoice,'invoice');
assert.equal(releaseCalls,0);
finishStatusCheck({found:false});
await firstCheck;
assert.equal(releaseCalls,1);
assert.equal(busyInvoice,null);
assert.equal(statusSandbox.statusChecksInFlight.current.size,0);
console.log('PASS: rapid status clicks issue one query, preserve busy state and release only the owned lock.');

// Real service code, isolated transport: never sends invoices or accesses a DB.
const context = vm.createContext({ console, Date, Set, crypto: globalThis.crypto,
  process: { exit: (code) => assert.equal(code, 0, 'Legacy regression suite failed') } });
async function moduleFrom(path, mocks) {
  const mod = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context });
  await mod.link(async (specifier) => {
    const exports = mocks[specifier];
    assert.ok(exports, `Unexpected dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await mod.evaluate();
  return mod.namespace;
}
let response;
const proxy = await moduleFrom('../src/services/factusProxyService.js', {
  '../lib/supabaseClient.js': { default: { functions: { invoke: async () => response } } },
});
const retry = await moduleFrom('../src/services/factusRetryService.js', {
  '../lib/supabaseClient.js': { default: {} },
  './factusProxyService.js': { checkFactusBill: async (args) => { response = args; return { exists: false }; }, deleteUnvalidatedFactusBill: async () => {} },
});
let sendResult;
const dian = await moduleFrom('../src/services/DianService.js', {
  './factusService': { default: { sendInvoice: async () => { if (sendResult instanceof Error) throw sendResult; return sendResult; } } },
  './factusRetryService': { normalizeFactusError: retry.normalizeFactusError },
});
const credentials = { factusClientId: 'mock', factusClientSecret: 'mock', factusUsername: 'mock', factusPassword: 'mock', factusTestMode: false };
for (const [label, code] of [['Efectivo','10'],['Transferencia','42'],['Tarjeta crédito','48'],['Tarjeta débito','49'],['10','10']]) assert.equal(factusPaymentCode(label),code);
assert.throws(() => factusPaymentCode('método desconocido'), /PRE_VALIDATION/);
for (const status of [500,502,503,504]) {
  response = { error: { message: 'Edge Function error', context: { status, json: async () => ({ error: 'Servicio no disponible' }) } } };
  let failure;
  try { await proxy.invokeFactusProxy('send_bill'); } catch (e) { failure = e; }
  assert.equal(failure.status, status);
  assert.equal(retry.normalizeFactusError(failure).category, 'TECHNICAL_ERROR');
  sendResult = failure;
  const result = await dian.emitirFacturaDian({}, {}, credentials);
  assert.equal(result.dianStatus, 'INDETERMINADO');
  const details = retry.recordFevAttempt({ factusReferenceCode: 'stable' }, { status: result.errorCategory, error_message: result.message, reference_code: 'stable' });
  assert.equal(retry.getFevRetryDecision({ detalles: details }).requiresStatusCheck, true);
  assert.equal(details.factusReferenceCode, 'stable');
}
assert.equal(retry.normalizeFactusError(new Error('Failed to send a request to the Edge Function')).category, 'TECHNICAL_ERROR');
assert.equal(retry.normalizeFactusError(Object.assign(new Error('customer.email: inválido'), { status:422 })).category, 'FACTUS_VALIDATION_REJECTED');
assert.equal(retry.normalizeFactusError(Object.assign(new Error('Factura pendiente'), { status:409 })).code, '409_CONFLICT_PENDING_BILL');
assert.equal(retry.getFevRetryDecision({ detalles: { dianStatus:'RECHAZADA' } }).requiresStatusCheck, true);
const validationFailure = retry.recordFevAttempt({}, { status:'FACTUS_VALIDATION_REJECTED', error_code:'422', error_message:'Correo inválido' });
assert.equal(retry.getFevRetryDecision({ detalles:validationFailure }).reason, 'FACTUS_VALIDATION_FAILED');
for (const bill of [{ number:'TEST1' }, { number:'TEST1', cufe:'test-cufe', is_validated:false }]) {
  sendResult = { data: { bill } };
  assert.equal((await dian.emitirFacturaDian({}, {}, credentials)).dianStatus, 'INDETERMINADO');
}
sendResult = { data: { bill: { number:'TEST1', cufe:'test-cufe', is_validated:true } } };
assert.equal((await dian.emitirFacturaDian({}, {}, credentials)).dianStatus, 'ACEPTADA');
assert.equal((await dian.emitirFacturaDian({}, {}, { ...credentials, factusTestMode:true })).dianStatus, 'SIMULADA');
await retry.checkFactusBillStatus({ tenantId:'mock', referenceCode:'stable', invoiceNumber:'BORRADOR-OC-test' });
assert.equal(response.billNumber, undefined);
assert.equal(response.referenceCode, 'stable');
console.log('PASS: payment codes; preserved HTTP errors; outages; uncertain outcomes block retries; 422/409; validated/sandbox; draft lookup by reference. No network calls.');

const draftService = await moduleFrom('../src/services/receiptInvoiceDraftService.js', {
  '../lib/supabaseClient.js': { default: {} },
});
function fakeDatabase({ failReceipt = null, failComplete = false } = {}) {
  const tables = { facturas: new Map(), recibos_caja: new Map([['r1',{ id:'r1',tenant_id:'clinic',factura_id:null }]]), pagos: new Map([['r2',{ id:'r2',tenant_id:'clinic',factura_id:null }]]) };
  let seq = 0;
  return { tables, from(table) {
    const filters = []; let action, values;
    const q = {
      insert(v) { action='insert'; values=v; return q; },
      update(v) { action='update'; values=v; return q; },
      eq(k,v) { filters.push([k,v]); return q; },
      is(k,v) { filters.push([k,v]); return q; },
      select() { if (!action) action='select'; return q; },
      single() { return q.then(r => r); },
      then(resolve,reject) { return Promise.resolve().then(() => {
        if (action==='insert') { const row={ ...values[0],id:`draft-${++seq}` }; tables[table].set(row.id,row); return {data:structuredClone(row)}; }
        const row=[...tables[table].values()].find(r=>filters.every(([k,v])=>typeof r[k]==='object' && typeof v==='string' ? JSON.stringify(r[k])===v : r[k]===v));
        if (!row) return { data:null,error:{message:'no matching row'} };
        if (action==='select') return {data:structuredClone(row)};
        if (row.id===failReceipt && values.factura_id) return {data:null,error:{message:'write failed'}};
        if (failComplete && values.detalles?.receiptLinkState==='COMPLETE') return {data:null,error:{message:'completion failed'}};
        Object.assign(row,values); return {data:structuredClone(row)};
      }).then(resolve,reject); },
    }; return q;
  } };
}
const record={ tenant_id:'clinic',numero:'BORRADOR-test',detalles:{dianStatus:'BORRADOR'} };
const receipts=[{id:'r1'},{id:'r2',isPago:true}];
let db=fakeDatabase();
const ready=await draftService.createReceiptInvoiceDraft(record,receipts,db);
assert.equal(ready.detalles.receiptLinkState,'COMPLETE');
assert.equal(db.tables.pagos.get('r2').factura_id,ready.id);
assert.equal(retry.getFevRetryDecision(ready).canRetry,true);
db=fakeDatabase();
const concurrent=await Promise.allSettled([draftService.createReceiptInvoiceDraft(record,receipts,db),draftService.createReceiptInvoiceDraft(record,receipts,db)]);
assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
const winner=concurrent.find(r=>r.status==='fulfilled').value;
assert.equal(db.tables.recibos_caja.get('r1').factura_id,winner.id);
assert.equal(db.tables.pagos.get('r2').factura_id,winner.id);
for (const options of [{failReceipt:'r2'},{failComplete:true}]) {
  db=fakeDatabase(options);
  await assert.rejects(draftService.createReceiptInvoiceDraft(record,receipts,db),/No se emitió/);
  assert.equal(db.tables.recibos_caja.get('r1').factura_id,null);
  assert.equal(db.tables.pagos.get('r2').factura_id,null);
  assert.equal(retry.getFevRetryDecision([...db.tables.facturas.values()][0]).canRetry,false);
}
db=fakeDatabase();
await assert.rejects(draftService.createReceiptInvoiceDraft({...record,tenant_id:'other-clinic'},receipts,db));
assert.equal(db.tables.recibos_caja.get('r1').factura_id,null);
assert.equal(retry.getFevRetryDecision({detalles:{receiptLinkState:'PENDING'}}).canRetry,false);
console.log('PASS: multiple receipts; concurrent claims; partial failure rollback; completion failure; cross-tenant isolation; incomplete drafts cannot emit.');
db=fakeDatabase();
db.tables.facturas.set('invoice',{id:'invoice',tenant_id:'clinic',detalles:{dianStatus:'BORRADOR'}});
const claims=await Promise.allSettled([1,2].map(()=>retry.claimFevEmission({invoiceId:'invoice',tenantId:'clinic',referenceCode:'stable',client:db})));
assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
assert.equal(db.tables.facturas.get('invoice').detalles.technicalError,true);
await assert.rejects(retry.claimFevEmission({invoiceId:'invoice',tenantId:'clinic',referenceCode:'stable',client:db}));
db.tables.facturas.get('invoice').detalles={dianStatus:'ACEPTADA',cufe:'fiscal-cufe'};
await assert.rejects(retry.claimFevEmission({invoiceId:'invoice',tenantId:'clinic',referenceCode:'stable',client:db}));
console.log('PASS: compare-and-set allows one emission; stale sessions, uncertain invoices and accepted invoices cannot transmit.');

const health = await moduleFrom('../src/services/factusHealthPayloadBuilder.js', {});
const billing = await moduleFrom('../src/services/billingReceiptLinkService.js', {
  '../lib/supabaseClient.js': { default: {} },
});
for (const suite of ['test_p1_fev2_retry_suite.mjs', 'test_p1_fev1_receipt_link_suite.mjs']) {
  // Optional legacy local suites are not distributed with the production repo.
  try { await readFile(new URL(suite, import.meta.url)); } catch { continue; }
  await moduleFrom(suite, {
    'node:assert/strict': { default: assert },
    '../src/services/factusRetryService.js': retry,
    '../src/services/factusHealthPayloadBuilder.js': health,
    '../src/services/billingReceiptLinkService.js': billing,
  });
}
