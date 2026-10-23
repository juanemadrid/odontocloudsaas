import assert from 'node:assert/strict';
import { readRipsSource, ripsDocumentInRange, buildRipsClinicalSources, collectRipsConsultations, getRipsPlanItems } from '../src/modules/rips/v003/services/ripsSourceService.js';
import { normalizeRipsBillingSource } from '../src/modules/rips/v003/adapters/ripsBillingSourceAdapter.js';
import { resolveProviderProfile, resolveRipsProviderContext } from '../src/modules/rips/v003/services/ripsProviderProfileService.js';
import { resolveRipsServiceSettings, resolveRipsTariffItem, isRipsConsultation } from '../src/modules/rips/v003/services/ripsTariffService.js';
import { applyRipsHistoricalLinks, ripsHistoricalLinkKey } from '../src/modules/rips/v003/services/ripsHistoricalLinkService.js';

const line = { id: 'invoice-line', clinicalSourceId: 'plan-item', clinicalSourceType: 'PLAN_ITEM',
  fechaAtencion: '2026-10-05', profesionalId: 'doctor-1', genera_rips: false, cups: '232102', total: 50000 };
const doc = { id: 'invoice', numero: 'FE-1', fecha: '2026-09-30', items: [line] };
const normalized = normalizeRipsBillingSource(doc, 'facturas_electronicas');
assert.equal(normalized.items[0].planItemId, 'plan-item');
assert.equal(normalized.items[0].clinicalSourceId, 'plan-item');
assert.equal(normalized.items[0].profesionalId, 'doctor-1');
assert.equal(normalized.items[0].genera_rips, false);
assert.equal(normalized.items[0].fechaRealizado, '2026-10-05');
const range = { start: '2026-10-01', end: '2026-10-22' };
const date = value => value?.slice(0, 10);
assert.equal(ripsDocumentInRange(doc, 'realizado', range, date), true);
assert.equal(ripsDocumentInRange(doc, 'facturacion', range, date), false);
assert.equal(ripsDocumentInRange({ ...doc, items: [{ fechaAtencion: '2026-11-01' }] }, 'realizado', range, date), false);
assert.equal(resolveProviderProfile({ esIps: true }, { empresa_datos: { providerType: 'PROFESIONAL_INDEPENDIENTE', esIps: false } }).providerType, 'PROFESIONAL_INDEPENDIENTE');
assert.equal(resolveProviderProfile({ esIps: false }, { empresa_datos: { providerType: 'IPS' } }).providerType, 'IPS');

const calls = [];
const rows = Array.from({ length: 1101 }, (_, id) => ({ id }));
const client = { from(table) {
  assert.equal(table, 'facturas');
  return { select() { return this; }, eq(key, tenant) {
    assert.equal(key, 'tenant_id'); assert.equal(tenant, 'tenant-a'); return this;
  }, order() { return this; }, async range(start, end) {
    calls.push([start, end]); return { data: rows.slice(start, end + 1) };
  } };
} };
assert.equal((await readRipsSource(client, 'facturas', 'tenant-a')).length, 1101);
assert.equal(calls.length, 3);
const failingClient = code => ({ from() { return { select() { return this; }, eq() { return this; }, order() { return this; },
  async range() { return { error: { code, message: 'test failure' } }; } }; } });
assert.deepEqual(await readRipsSource(failingClient('PGRST205'), 'legacy', 'tenant-a', { optional: true }), []);
await assert.rejects(readRipsSource(failingClient('42501'), 'facturas', 'tenant-a', { optional: true }), /test failure/);
await assert.rejects(readRipsSource(failingClient('PGRST205'), 'evoluciones', 'tenant-a'), /test failure/);
console.log('PASS: vínculos clínicos, fechas de atención, perfil, paginación y errores visibles.');

const professional = { id: 'doctor-1', nombreCompleto: 'Profesional Prueba', generaRips: true,
  numeroDocumento: '12345678', ripsCodigoUnico: '7000101658' };
const configData = { empresa_datos: { providerType: 'PROFESIONAL_INDEPENDIENTE',
  billingObligation: 'NOT_REQUIRED', administrativeConfirmation: true } };
const providerContext = resolveRipsProviderContext({ tenant: {}, professional, configData });
assert.equal(providerContext.valid, true);
assert.equal(providerContext.providerCode, professional.ripsCodigoUnico);
assert.equal(providerContext.obligatedDocument, professional.numeroDocumento);
assert.equal(providerContext.ripsMode, 'OFFICIAL_RIPS_WITHOUT_FEV');
const patient = { id: 'patient-a', tenant_id: 'tenant-a', nombreCompleto: 'Paciente Prueba', nroDocumento: '98765432' };
const plan = { id: 'plan-a', tenant_id: 'tenant-a', paciente_id: patient.id, items: [
  { id: 'procedure', code: '232102', desc: 'Procedimiento', amount: 50000, qty: 2, descuento: 10000, realizado: true, fechaRealizado: '2026-10-03' },
  { id: 'consultation', code: '890203', desc: 'Consulta', amount: 30000, qty: 1, realizado: true,
    fechaRealizado: '2026-10-04', asocConsultaId: 'consult-a' },
  { id: 'pending', code: '232102', realizado: false },
  { id: 'disabled', code: '232102', realizado: true, genera_rips: false, profesionalId: professional.id, fechaRealizado: '2026-10-03' },
] };
const evolution = { id: 'evo-a', tenant_id: 'tenant-a', paciente_id: patient.id,
  profesional_id: professional.id, fecha: '2026-10-03', tratamiento: JSON.stringify({
    planId: plan.id, plantillaItems: { procedure: { realizado: true } }, dxPrincipal: { code: 'K021' }, doctorId: professional.id,
  }) };
const consultation = { id: 'consult-a', tenant_id: 'tenant-a', paciente_id: patient.id, tipo: 'Consulta',
  metadata: { profesional: professional.nombreCompleto, dxPrincipalConsulta: { code: 'K021' }, fechaIso: '2026-10-04' } };
const fixture = { plans: [plan], evolutions: [evolution], consultations: [consultation], professional,
  patients: [patient], tenantId: 'tenant-a', range, normalizeDate: date };
const clinical = buildRipsClinicalSources(fixture);
for (const persisted of [
  { ...plan, items: undefined, detalles: { items: plan.items } },
  { ...plan, items: undefined, detalles: JSON.stringify({ items: plan.items }) },
  { ...plan, items: undefined, detalles: plan.items },
  { ...plan, items: undefined, detalles: JSON.stringify(plan.items) },
]) {
  assert.equal(getRipsPlanItems(persisted).length, plan.items.length);
  assert.deepEqual(buildRipsClinicalSources({ ...fixture, plans: [persisted] }), clinical,
    'la representación persistida del presupuesto debe producir las mismas atenciones');
}
assert.equal(clinical.length, 1);
assert.equal(clinical[0].items.length, 3, 'atenciones realizadas visibles, incluso exclusión explícita por corregir');
assert.equal(clinical[0].items[2].genera_rips, false);
assert.equal(clinical[0].items[0].evolutionId, 'evo-a');
assert.equal(clinical[0].items[0].total, 90000);
assert.equal(clinical[0].items[1].asocConsultaId, 'consult-a');
const source = normalizeRipsBillingSource(clinical[0], 'atenciones_clinicas', { providerContext });
assert.equal(source.numFactura, null);
assert.equal(source.isOfficialInvoice, false);
assert.equal(source.sourceMode, 'OFFICIAL_RIPS_WITHOUT_FEV');
assert.equal(source.documentNumber, clinical[0].id);
assert.equal(source.items[0].evolutionId, 'evo-a');
assert.equal(source.items[1].asocConsultaId, 'consult-a');
assert.equal(buildRipsClinicalSources({ ...fixture, professional: { ...professional, generaRips: false } }).length, 0);
assert.equal(buildRipsClinicalSources({ ...fixture, tenantId: 'other-tenant' }).length, 0);
assert.equal(buildRipsClinicalSources({ ...fixture, range: { start: '2026-11-01', end: '2026-11-30' } }).length, 0);
assert.equal(buildRipsClinicalSources({ ...fixture, patientFilter: 'otro paciente' }).length, 0);
assert.equal(buildRipsClinicalSources({ ...fixture, plans: [{ ...plan, sucursal_id: 'sede-b' }], branchId: 'sede-a' }).length, 0);
const linkedFixture = { ...fixture, plans: [{ ...plan, items: plan.items.filter(item => item.id !== 'disabled') }] };
assert.equal(buildRipsClinicalSources({ ...linkedFixture, evolutions: [{ ...evolution, profesional_id: 'other-doctor' }], consultations: [] }).length, 0);
assert.equal(buildRipsClinicalSources({ ...linkedFixture, evolutions: [{ ...evolution, tratamiento: JSON.stringify({ planId: 'otro-plan', plantillaItems: { procedure: { realizado: true } } }) }], consultations: [] }).length, 0);
const embedded = collectRipsConsultations([], [{ ...patient, historial_medico: { documentosClinicos: [{ ...consultation, metadata: undefined, profesional: professional.nombreCompleto }] } }], 'tenant-a');
assert.equal(embedded.length, 1);
assert.equal(buildRipsClinicalSources({ ...fixture, consultations: embedded })[0].items.length, 3);
assert.equal(collectRipsConsultations([consultation], [{ ...patient, historial_medico: { documentosClinicos: [consultation] } }], 'tenant-a').length, 1);
const blockedPayer = normalizeRipsBillingSource({ ...clinical[0], pagador: 'EPS' }, 'atenciones_clinicas', { providerContext });
assert.equal(blockedPayer.sourceMode, 'LOCAL_PREVIEW');
assert.match(blockedPayer.modeEligibilityError, /PAYER_REQUIRES_FEV/);
const fev = normalizeRipsBillingSource(doc, 'facturas_electronicas', { providerContext });
assert.equal(fev.sourceMode, 'OFFICIAL_FEV');
assert.equal(fev.numFactura, 'FE-1');
console.log('PASS: presupuesto → evolución/consulta → RIPS sin FEV, profesional, REPS, aislamiento y FEV conservada.');

const lists = [
  { id: 'own-list', descripcion: JSON.stringify([
    { id: 'correct-product', codigo: '232102', nombre: 'Consulta de control sobre plano', genera_rips: true, es_consulta: false },
    { id: 'different-product', codigo: '232102', nombre: 'Otro servicio mismo CUPS', genera_rips: false, es_consulta: true },
  ]) },
  { id: 'other-list', descripcion: JSON.stringify([
    { codigo: '232102', nombre: 'Consulta de control sobre plano', genera_rips: false, es_consulta: true },
  ]) },
];
const savedItem = { code: '232102', desc: 'Consulta de control sobre plano', es_consulta: true, genera_rips: false };
const savedPlan = { detalles: { baseListId: 'own-list' } };
const settings = resolveRipsServiceSettings(savedItem, savedPlan, lists);
assert.equal(settings.es_consulta, false, 'el producto correcto prevalece sobre otro producto con mismo CUPS y sobre copia antigua');
assert.equal(settings.genera_rips, true);
assert.equal(resolveRipsTariffItem({ ...savedItem, desc: '', catalogItemId: 'correct-product' }, savedPlan, lists).item.id, 'correct-product');
assert.match(resolveRipsTariffItem({ code: '232102' }, savedPlan, lists).error, /opciones RIPS diferentes/);
assert.equal(isRipsConsultation({ code: '890203', es_consulta: false, asocConsultaId: 'stale-link' }), false);
assert.equal(isRipsConsultation({ code: '232102', es_consulta: true }), true);
assert.equal(isRipsConsultation({ code: '890203' }), true, 'compatibilidad sin opción explícita');
assert.equal(normalizeRipsBillingSource({ ...doc, items: [{ ...line, cups: '890203', es_consulta: false }] }, 'facturas_electronicas').items[0].es_consulta, false);
const persistedNoFev = resolveRipsProviderContext({ professional, configData: { empresa_datos: {
  ...configData.empresa_datos, administrativeConfirmation: false,
} } });
assert.equal(persistedNoFev.ripsMode, 'OFFICIAL_RIPS_WITHOUT_FEV');
console.log('PASS: tarifario por producto/lista, CUPS duplicados, Es consulta=false y sin confirmación interna adicional.');

const renamedLists = [{ id: 'own-list', nombre: 'Tarifario correcto', descripcion: [
  { id: 'renamed', codigo: '232102', nombre: 'Control o seguimiento sobre plano Estabilizador', genera_rips: true, es_consulta: false },
  { id: 'other', codigo: '232102', nombre: 'Otro producto', genera_rips: false, es_consulta: true },
] }];
const historic = { ...plan.items[0], desc: 'Consulta de Control o seguimientos sobre plano Estabilizador', genera_rips: false };
const fixed = resolveRipsServiceSettings(historic, savedPlan, renamedLists);
assert.equal(fixed.genera_rips, true);
assert.equal(fixed.es_consulta, false);
assert.equal(fixed._ripsConfigError, null);
assert.equal(fixed.desc, historic.desc, 'conserva descripción clínica original');
const equivalent = resolveRipsTariffItem({ code: '232102', desc: 'Nombre antiguo' }, {}, [{ id: 'same', descripcion: [
  { id: 'one', codigo: '232102', nombre: 'Producto A', genera_rips: true, es_consulta: false },
  { id: 'two', codigo: '232102', nombre: 'Producto B', genera_rips: true, es_consulta: false },
] }]);
assert.equal(equivalent.status, 'EQUIVALENT_SETTINGS');
assert.equal(equivalent.item.id, undefined, 'resolver opciones equivalentes no inventa identidad de producto');
const original = structuredClone(plan);
const linkKey = await ripsHistoricalLinkKey('tenant-a', plan.id, plan.items[0].id, '232102');
assert.match(linkKey, /^[a-z0-9_]{1,80}$/);
const linkConfig = { [linkKey]: { tenantId: 'tenant-a', planId: plan.id, itemId: plan.items[0].id,
  cups: '232102', listId: 'own-list', productId: 'renamed' } };
const linked = await applyRipsHistoricalLinks([plan], renamedLists, linkConfig, 'tenant-a');
assert.equal(linked[0].items[0].catalogItemId, 'renamed');
assert.equal(linked[0].items[0].amount, plan.items[0].amount);
assert.equal(linked[0].items[0].fechaRealizado, plan.items[0].fechaRealizado);
assert.equal(linked[0].items[0].realizado, plan.items[0].realizado);
assert.deepEqual(plan, original, 'el vínculo no muta el registro histórico');
assert.equal((await applyRipsHistoricalLinks([plan], renamedLists, { [linkKey]: { ...linkConfig[linkKey], tenantId: 'other-tenant' } }, 'tenant-a'))[0].items[0].catalogItemId, undefined);
assert.equal((await applyRipsHistoricalLinks([plan], renamedLists, { [linkKey]: { ...linkConfig[linkKey], cups: '890203' } }, 'tenant-a'))[0].items[0].catalogItemId, undefined);
console.log('PASS: renombrado histórico, opciones equivalentes y vínculo RIPS persistible sin mutar historia, precios ni realización.');
