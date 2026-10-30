import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { factusPaymentCode } from '../src/services/factusPayment.js';
import { receiptConceptAmounts } from '../src/services/receiptInvoiceItems.js';
import { billingFullName, billingItemDescription, billingPatient } from '../src/utils/billingPresentation.js';
import { generateElectronicInvoiceHtml } from '../src/utils/electronicInvoiceTemplate.js';
import { readValidatedCreditNote } from '../src/services/factusCreditNoteResponse.js';

const validatedNote = {number:'NC1',cude:'a'.repeat(96),reference_code:'NC-OC-TEST',is_validated:true,
  validated_at:'30-10-2026 06:44:33 AM',
  bill:{number:'FCEV1345',cufe:'b'.repeat(96)}};
assert.equal(readValidatedCreditNote({result:{data:validatedNote}}, {referenceCode:'NC-OC-TEST',billNumber:'FCEV1345'}).number,'NC1');
assert.equal(readValidatedCreditNote({result:{data:{credit_note:validatedNote}}}).cude,'a'.repeat(96));
assert.equal(readValidatedCreditNote(validatedNote).validated_at,'2026-10-30T06:44:33-05:00');
for (const bad of [validatedNote.bill, {...validatedNote,cude:null}, {...validatedNote,is_validated:false}]) {
  assert.throws(()=>readValidatedCreditNote({result:{data:bad}}),{code:'CREDIT_NOTE_RESPONSE_INDETERMINATE'});
}
assert.throws(()=>readValidatedCreditNote(validatedNote,{referenceCode:'OTHER'}),{code:'CREDIT_NOTE_RESPONSE_INDETERMINATE'});

assert.equal(billingFullName({nombre:'JAVIER ANDRÉS',apellidos:'PÉREZ GÓMEZ'}),'JAVIER ANDRÉS PÉREZ GÓMEZ');
assert.equal(billingFullName({nombre:'JAVIER ANDRÉS PÉREZ GÓMEZ',apellido:'PÉREZ GÓMEZ'}),'JAVIER ANDRÉS PÉREZ GÓMEZ');
const printItem={code_reference:'890304',concepto:'890304',descripcion:'890304 - CONTROL SOBRE PLANO',precioUnitario:150000,cantidad:1,total:150000};
assert.equal(billingItemDescription(printItem),'CONTROL SOBRE PLANO');
assert.equal(billingItemDescription({code:'890304',descripcion:'CONTROL 890304 POSTERIOR'}),'CONTROL 890304 POSTERIOR');
const printPatient=billingPatient({nombres:'JAVIER ANDRÉS',apellidos:'PÉREZ GÓMEZ',direccion:'Barrio de prueba',municipality:{name:'Sincelejo'}});
const printHtml=generateElectronicInvoiceHtml({factura:{numero:'TEST1',total:150000},patient:printPatient,items:[printItem]});
for(const text of ['JAVIER ANDRÉS PÉREZ GÓMEZ','Barrio de prueba','Sincelejo','CONTROL SOBRE PLANO','Código','Descripción']) assert.ok(printHtml.includes(text),`Print missing ${text}`);
assert.ok(!printHtml.includes('890304 - CONTROL SOBRE PLANO'));

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
let reconciledRow, reconciledInvoice, checkedNoteReference;
const creditCheckCalls = [];
const storedNote = {id:'local-note',tenant_id:'clinic',factura_id:'invoice',numero:'FCEV1345',cude:null,
  reference_code:validatedNote.reference_code,dian_status:'ACCEPTED',tipo_nota_credito:'TOTAL',monto_acreditado:150000,
  facturas:{id:'invoice',detalles:{notasCredito:[{id:'local-note',numero:'FCEV1345'}]}}};
const creditDb = {
  rpc:async()=>({data:[{total_factura:150000,total_acreditado:150000,saldo_disponible:0,nc_count:1}],error:null}),
  from:table=>{
    let patch;
    const query={select:()=>query,eq:()=>query,update:value=>{patch=value;return query;},
      single:async()=>{if(patch) reconciledRow=patch;return {data:patch?{...storedNote,...patch}:storedNote,error:null};},
      then:resolve=>{if(table==='facturas') reconciledInvoice=patch;return Promise.resolve({error:null}).then(resolve);}};
    return query;
  },
};
const creditService = await moduleFrom('../src/services/factusCreditNoteService.js', {
  '../lib/supabaseClient.js':{default:creditDb},
  './factusCreditNoteResponse.js':{readValidatedCreditNote},
  './factusRetryService.js':{acquireFevBackendLock:()=>{},releaseFevBackendLock:()=>{},FEV_LOCK_STATE:{}},
  './factusProxyService.js':{
    sendFactusCreditNote:()=>{throw new Error('Reconciliation must never emit');},
    checkFactusCreditNote:async args=>{
      creditCheckCalls.push(args);
      if (!args.number) {checkedNoteReference=args;const {cude,...listed}=validatedNote;return {result:{credit_note:listed}};}
      return {result:{credit_note:validatedNote}};
    },
    deleteUnvalidatedFactusCreditNote:()=>{throw new Error('Reconciliation must never delete');}},
  './factusCreditNotePayloadBuilder.js':{buildFactusCreditNotePayload:()=>{},validateInvoiceCreditEligibility:()=>{}},
  '../utils/dian/creditNoteCatalogs.js':{isTotalCreditNoteConcept:()=>true,isPartialCreditNoteConcept:()=>false},
  './muvCreditNoteRipsBuilder.js':{isHealthInvoice:()=>false,validatePartialCreditNoteClinicalTraceability:()=>{}},
});
const reconciliation=await creditService.checkAndReconcileCreditNote({creditNoteId:'local-note',tenantId:'clinic'});
assert.equal(reconciliation.reconciled,true);
assert.equal(checkedNoteReference.referenceCode,validatedNote.reference_code);
assert.equal(checkedNoteReference.number,null);
assert.equal(creditCheckCalls.length,2);
assert.equal(creditCheckCalls[1].number,'NC1');
assert.equal(reconciledRow.numero,'NC1');
assert.equal(reconciledRow.cude,validatedNote.cude);
assert.equal(reconciledRow.validated_at,'2026-10-30T06:44:33-05:00');
assert.equal(reconciledInvoice.estado,'Anulado');
assert.equal(reconciledInvoice.detalles.notasCredito.length,1);
assert.equal(reconciledInvoice.detalles.notasCredito[0].numero,'NC1');
console.log('PASS: incomplete confirmation reconciles the existing note by reference, repairs invoice history and never emits again.');
let sentInvoice;
const transportMocks = Object.fromEntries(['downloadFactusPdf','downloadFactusAttachedDocumentXml','downloadFactusSupportDocumentPdf','getFactusRanges','getFactusStatus','sendFactusSupportDocument','sendFactusAdjustmentNote','testFactusCredentials','sendFactusCreditNote','checkFactusCreditNote','deleteUnvalidatedFactusCreditNote','downloadFactusCreditNoteXml','downloadFactusCreditNotePdf'].map(name => [name, async () => { throw new Error(`Unexpected transport: ${name}`); }]));
transportMocks.sendFactusBill = async payload => { sentInvoice = payload; return {result:{}}; };
const invoiceService = await moduleFrom('../src/services/factusService.js', {
  './factusProxyService.js': transportMocks,
  './factusHealthPayloadBuilder.js': {isFacturaSectorSalud:()=>false,buildFactusHealthInvoicePayload:payload=>payload},
  '../utils/dian/dianHelpers.js': {calculateNIT_DV:()=>0},
  './factusPayment.js': {factusPaymentCode},
  '../utils/billingPresentation.js': {billingFullName,billingItemDescription},
});
await invoiceService.sendInvoice({numbering_range_id:1,items:[printItem],medioPago:'Efectivo'},
  {nombre:'JAVIER ANDRÉS',apellido:'PÉREZ GÓMEZ',documento:'123456',direccion:'Barrio de prueba',ciudad:'Sincelejo'},
  {serverManaged:true,factusTestMode:false});
assert.equal(sentInvoice.customer.names,'JAVIER ANDRÉS PÉREZ GÓMEZ');
assert.equal(sentInvoice.customer.address,'Barrio de prueba');
assert.equal(sentInvoice.customer.municipality_code,'70001');
assert.equal(sentInvoice.items[0].code_reference,'890304');
assert.equal(sentInvoice.items[0].name,'CONTROL SOBRE PLANO');
console.log('PASS: actual invoice payload sends full name, address, city and separate service code/description.');
let response;
const proxySource = await readFile(new URL('../supabase/functions/factus-proxy/index.ts', import.meta.url), 'utf8');
const checkBillSource = proxySource.slice(proxySource.indexOf('    if (action === "check_bill")'), proxySource.indexOf('    if (action === "delete_unvalidated_bill")')).replaceAll('referenceCode!', 'referenceCode');
let requestedBillPath;
let providerBody;
const proxyCheckContext = vm.createContext({
  action:'check_bill', body:{billNumber:'FCEV1344'}, config:{}, encodeURIComponent,
  json: value => value, HttpError:Error, factusError: () => 'Provider error',
  factusRequest:async (_config,path) => { requestedBillPath=path; return {status:200,ok:true,json:async()=>providerBody}; },
});
for (const nested of [false,true]) {
  const originalBill={number:'FCEV1344',is_validated:true,cufe:'verified',total:150000};
  providerBody={data:{...(nested ? {bill:originalBill} : originalBill),customer:{identification:'123'},items:[{quantity:1,price:150000}]}};
  const checked=await vm.runInContext('(async () => {'+checkBillSource+'})()',proxyCheckContext);
  assert.equal(requestedBillPath,'/v2/bills/FCEV1344');
  assert.equal(checked.result.bill.number,'FCEV1344');
  assert.equal(checked.result.customer.identification,'123');
  assert.equal(checked.result.items.length,1);
}
console.log('PASS: actual proxy uses the V2 bill detail route and preserves nested/flat customer and items.');
const recovery = await moduleFrom('../src/services/factusInvoiceRecovery.js', {
  '../lib/supabaseClient.js': { default:{} },
  './factusProxyService.js': { checkFactusBill:async () => response },
});
const recoveryResponse = {exists:true,result:{
  bill:{number:'FCEV1345',id:1345,is_validated:true,cufe:'verified-cufe',total:'150000',created_at:'2026-10-28T15:51:30-05:00'},
  customer:{names:'Cliente de prueba',identification:'123'},
  items:[{code_reference:'890304',name:'Servicio de prueba',price:'150000',quantity:1,total:150000}],
}};
const recovered = recovery.buildRecoveredInvoice('clinic','FCEV1345',recoveryResponse);
assert.equal(recovered.numero,'FCEV1345');
assert.equal(recovered.detalles.items[0].precioUnitario,150000);
assert.equal(recovered.detalles.monto_pagado,0);
assert.equal(recovered.detalles.recibos_asociados.length,0);
assert.equal(recovered.detalles.dianStatus,'ACEPTADA');
assert.throws(() => recovery.buildRecoveredInvoice('clinic','FCEV1344',recoveryResponse),/solicitada/);
assert.throws(() => recovery.buildRecoveredInvoice('clinic','FCEV1345',{...recoveryResponse,result:{...recoveryResponse.result,bill:{...recoveryResponse.result.bill,is_validated:false}}}),/validación/);
assert.throws(() => recovery.buildRecoveredInvoice('clinic','FCEV1345',{...recoveryResponse,result:{bill:recoveryResponse.result.bill}}),/incompleta/);
console.log('PASS: recovery checks identity, validation, complete detail and does not create a payment.');
const v2Bill = { number:'FCEV1344', is_validated:true, cufe:'test-cufe',
  created_at:'28-10-2026 03:50:49 PM', totals:{total:'150000.00',gross_amount:'150000.00',tax_amount:'0.00'},
  operation_type:{code:'SS-CUFE'},
  health:{provider_code:'test-provider',payment_method:{code:'04'},coverage:{code:'15'},without_contract:{code:'05'},contract_number:null},
  customer:{names:'Cliente de prueba',identification:'123',identification_document:{code:'13'},municipality:{code:'70001',name:'Sincelejo'}},
  items:[{quantity:'1.00',price:'150000.00',total:'150000.00',code_reference:'890304',name:'Servicio de prueba'}],
  related_notes:{credit_notes:[],debit_notes:[]}, links:{qr:'https://example.test/qr'},
};
const v2Recovered = recovery.buildRecoveredInvoice('clinic','FCEV1344',{exists:true,result:{...v2Bill,bill:v2Bill}});
assert.equal(v2Recovered.total,150000);
assert.equal(v2Recovered.subtotal,150000);
assert.equal(v2Recovered.impuestos,0);
assert.equal(v2Recovered.fecha_emision,'2026-10-28T15:50:49-05:00');
assert.equal(v2Recovered.detalles.health.payment_method_code,'04');
assert.equal(v2Recovered.detalles.health.coverage_code,'15');
assert.equal(v2Recovered.detalles.health.without_contract_code,'05');
assert.equal(v2Recovered.detalles.paciente.tipoDocumento,'CC');
assert.equal(v2Recovered.detalles.paciente.municipality_code,'70001');
assert.equal(recovery.recoveredInvoiceDate('28-10-2026 12:00:00 AM'),'2026-10-28T00:00:00-05:00');
assert.equal(recovery.recoveredInvoiceDate('28-10-2026 12:00:00 PM'),'2026-10-28T12:00:00-05:00');
assert.throws(()=>recovery.recoveredInvoiceDate('31-02-2026 03:50:49 PM'),/válida/);
assert.throws(()=>recovery.buildRecoveredInvoice('clinic','FCEV1344',{exists:true,result:{bill:{...v2Bill,totals:{total:'inválido'}}}}),/total/);
console.log('PASS: anonymized V2 response with nested totals, Colombian dates, health codes and municipality.');
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
