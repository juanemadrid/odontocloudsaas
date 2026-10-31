// Caja: quien cierra, traslados a bancos al cierre, Caja → Bancos y módulo Traslados. Sin red.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) return { url: 'data:text/javascript,export default {};', shortCircuit: true };
    if (specifier.endsWith('configCacheService.js')) return { url: 'data:text/javascript,export const loadConfigSection=async()=>[];', shortCircuit: true };
    if (specifier.endsWith('configPersistenceService.js')) return { url: 'data:text/javascript,export const getConfigSection=async()=>[];export const saveConfigSection=async()=>{};export const getConfigItems=async()=>[];', shortCircuit: true };
    return next(specifier, context);
  }`));
const svc = await import('../src/services/bankTransferService.js');
const { buildClosingTransfers, saveTransfers, loadAllTransfers, bankMovements, bankNames, cajaLabel, tidyTransferText, localDate, cajaTransferMovements, loadOpenCajas } = svc;

// 1. Traslados del cierre: validados y con todo lo que leen Traslados, Bancos y Reportes.
const caja = { id: '8f2c1a90-aaaa', nombre: 'Caja Principal', usuarioNombre: 'Juan Madrid' };
let n = 0;
const now = new Date('2026-10-31T02:19:00Z'); // 30-oct 9:19 p. m. en Colombia
const tr = buildClosingTransfers({ caja, destinos: [{ banco: 'nequi', valor: 50000, medio: 'Efectivo' }], contado: 100000, usuario: 'Juan Madrid', now, makeId: () => `id${++n}` });
assert.equal(tr.length, 1);
assert.deepEqual({ ...tr[0] }, {
  id: 'id1', tipo: 'cierre_caja', caja_id: caja.id, fecha: '2026-10-30', origen: 'Caja Principal', destino: 'nequi', monto: 50000,
  medio: 'Efectivo', descripcion: 'Traslado por cierre de Caja Principal (Efectivo)', referencia: 'TR-CIERRE-8F2C1A', estado: 'Activo',
  usuario: 'Juan Madrid', created_at: '2026-10-31T02:19:00.000Z',
});
assert.throws(() => buildClosingTransfers({ caja, destinos: [{ banco: 'nequi', valor: 150000 }], contado: 100000 }), /no puede ser mayor/);
assert.throws(() => buildClosingTransfers({ caja, destinos: [{ banco: '', valor: 1000 }], contado: 100000 }), /Seleccione el banco/);
assert.throws(() => buildClosingTransfers({ caja, destinos: [{ banco: 'nequi', valor: 0 }], contado: 100000 }), /Escriba el valor/);
assert.deepEqual(buildClosingTransfers({ caja, destinos: [], contado: 0 }), []);
console.log('PASS: el traslado del cierre se valida (banco, valor, no más de lo contado) y queda con fecha de Colombia.');

// 2. Se guarda en la sección "traslados" sin duplicar.
let saved = null;
await saveTransfers('t1', tr, { getSection: async () => [{ id: 'viejo' }, { id: 'id1' }], saveSection: async (_t, k, v) => { saved = { k, v }; } });
assert.equal(saved.k, 'traslados');
assert.deepEqual(saved.v.map((x) => x.id), ['id1', 'viejo']);
console.log('PASS: los traslados se guardan donde los leen Traslados, Caja → Bancos y Reportes.');

// 3. Si la tabla "traslados" no existe, igual se leen los de la configuración (antes la lista quedaba vacía).
const brokenClient = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'relation does not exist' } }) }) }) };
const all = await loadAllTransfers('t1', { client: brokenClient, getSection: async () => tr });
assert.equal(all.length, 1);
const dupClient = { from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: 'db1', referencia: 'TR-CIERRE-8F2C1A', monto: 50000 }], error: null }) }) }) };
assert.equal((await loadAllTransfers('t1', { client: dupClient, getSection: async () => tr })).length, 1, 'no duplica el mismo traslado');
console.log('PASS: los traslados se leen aunque la tabla no exista y sin duplicados.');

// 4. Movimientos del banco: entra el traslado y salen los egresos pagados desde ese banco.
const expenses = [
  { id: 'p1', bancoCaja: 'Nequi', monto: 20000, concepto: 'Insumos' },
  { id: 'p2', bancoCaja: 'JUAN MADRID', monto: 400000 },            // pagado desde la caja: no toca el banco
  { id: 'p3', bancoCaja: 'nequi', monto: 9000, estado: 'Anulado' },  // anulado: no cuenta
];
const mov = bankMovements('Nequi', tr, expenses);
assert.equal(mov.entradas, 50000);
assert.equal(mov.salidas, 20000);
assert.deepEqual(mov.movements.map((m) => m.clase), ['Traslado +', 'Egreso desde banco']);
assert.equal(bankMovements('Bancolombia', tr, expenses).movements.length, 0, 'otro banco no recibe el traslado');
assert.deepEqual(bankNames(['nequi', { nombre: 'Nequi' }, { nombre: 'Bancolombia' }, '']), ['nequi', 'Bancolombia']);
console.log('PASS: Caja → Bancos suma los traslados recibidos y resta los egresos pagados desde el banco.');

// 5. Conexiones en las pantallas.
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
const cerrar = await read('src/modules/caja/components/CerrarCajaModal.jsx');
assert.ok(cerrar.includes('userProfile?.nombreCompleto || userProfile?.nombre'));
assert.ok(cerrar.includes('await saveTransfers(inquilino, traslados);'));
assert.ok(!cerrar.includes('from("traslados")') && !cerrar.includes('metodoPago: d.medio'), 'ya no escribe donde fallaba en silencio');
const cajaJsx = await read('src/modules/caja/Caja.jsx');
assert.ok(cajaJsx.includes('{ ...cfgById.get(row.id), ...filled(row) }'), 'combina la fila de la base con la configuración');
const abrir = await read('src/modules/caja/components/AbrirCajaModal.jsx');
assert.ok(abrir.includes('userName: userProfile?.nombreCompleto || userProfile?.nombre'));
const bancos = await read('src/modules/caja/components/BancosView.jsx');
assert.ok(!/\.eq\([^)]*\)\.catch\(/.test(bancos), 'sin consultas con .catch que rompían la vista');
assert.ok(bancos.includes('loadBanksAndExpenses(inquilino)'));
const traslados = await read('src/modules/facturacion/traslados/TrasladosList.jsx');
assert.ok(!/\.eq\([^)]*\)\.catch\(/.test(traslados));
assert.ok(traslados.includes('Traslado + (entradas a bancos)') && traslados.includes('Traslado − (salidas de bancos)'));
assert.ok(!traslados.includes('"Davivienda"'), 'sin bancos inventados');
const detalle = await read('src/modules/caja/components/CajaDetalleView.jsx');
assert.ok(detalle.includes('Traslados a bancos al cierre'));
const hub = await read('src/modules/administracion/views/FacturacionHub.jsx');
assert.ok(hub.includes('if (opt.id === "traslados") return canTraslados;'));
assert.ok(hub.includes('const allowed = base === "traslados"') && hub.includes('[urlSub, can, canTraslados]'), 'al hacer clic no se vuelve a cerrar');
console.log('PASS: cierre, lista de cajas, detalle, Bancos, Traslados y el menú de Facturación quedan conectados.');

// 6. Textos sin "Caja: Caja ..." y etiqueta del tipo en una sola línea.
assert.equal(cajaLabel('Caja Juan Madrid'), 'Caja Juan Madrid');
assert.equal(cajaLabel('juan madrid'), 'Caja Juan Madrid');
assert.equal(cajaLabel('Caja - juan madrid'), 'Caja Juan Madrid');
assert.equal(cajaLabel('Caja de la Sede Norte'), 'Caja de la Sede Norte');
assert.equal(cajaLabel('CAJA PRINCIPAL'), 'Caja Principal');
assert.equal(cajaLabel(''), 'Caja');
assert.equal(buildClosingTransfers({ caja: { id: 'x', nombre: 'Recepción' }, destinos: [{ banco: 'nequi', valor: 1 }], contado: 5, now })[0].origen, 'Caja Recepción');
assert.equal(tidyTransferText('Caja: Caja Juan Madre'), 'Caja Juan Madre');
assert.equal(tidyTransferText('Caja: Caja - juan madrid'), 'Caja Juan Madrid');
assert.equal(tidyTransferText('Traslado por cierre de caja - Caja - juan madrid (Efectivo)'), 'Traslado por cierre de Caja Juan Madrid (Efectivo)');
assert.equal(tidyTransferText('Traslado de fondos de Caja Principal (Efectivo) a nequi'), 'Traslado de fondos de Caja Principal (Efectivo) a nequi');
assert.equal(tidyTransferText('Traslado por cierre de caja - Caja Juan Madre (Efectivo)'), 'Traslado por cierre de Caja Juan Madre (Efectivo)');
assert.equal(tidyTransferText('Caja: Recepción'), 'Caja Recepción');
assert.equal(tidyTransferText('Traslado por cierre de caja - Recepción (Efectivo)'), 'Traslado por cierre de Caja Recepción (Efectivo)');
assert.equal(tidyTransferText('Nequi'), 'Nequi');
assert.equal(tidyTransferText('Caja Principal (Efectivo)'), 'Caja Principal (Efectivo)');
const old = { ...tr[0], origen: 'Caja: Caja Principal', descripcion: 'Traslado por cierre de caja - Caja Principal (Efectivo)' };
const m6 = bankMovements('nequi', [old], []).movements[0];
assert.equal(m6.tercero, 'Caja Principal');
assert.equal(m6.concepto, 'Traslado por cierre de Caja Principal (Efectivo)');
assert.ok(traslados.includes('{tidyTransferText(t.origen) || "—"}') && traslados.includes('{tidyTransferText(t.descripcion) || "—"}'));
assert.ok(traslados.includes('>TRASLADO\u00a0+</span>') && traslados.includes('inline-block whitespace-nowrap px-2 py-1'), 'el + queda al lado');
console.log('PASS: los traslados dicen "Caja Juan Madrid" (sin "Caja: Caja") y "TRASLADO +" se ve en una sola línea.');

// 7. Fechas de solo día y Reporte de facturación.
const d31 = localDate('2026-10-31');
assert.equal([d31.getFullYear(), d31.getMonth() + 1, d31.getDate()].join('-'), '2026-10-31', '"2026-10-31" es el 31, no el 30');
assert.equal(localDate('2026-10-31T12:11:59.434Z').toISOString(), '2026-10-31T12:11:59.434Z');
assert.equal(localDate(''), null);
assert.ok(traslados.includes('const d = localDate(ts);') && traslados.includes('localDate(t.fecha || t.created_at)'), 'Traslados usa el día correcto');
const reporte = await read('src/modules/reportes/views/ReporteFinanciero.jsx');
assert.ok(!reporte.includes('centro del dolor') && !reporte.includes('includes("sincelejo")'), 'sin nombres de sedes escritos a mano');
assert.equal((reporte.match(/rowMatchesProfessional\(r, /g) || []).length, 2, 'selector y tabla usan la misma regla de profesional');
assert.equal((reporte.match(/rowMatchesOffice\(r, /g) || []).length, 2, 'selector y tabla usan la misma regla de sede');
assert.ok(reporte.includes('&& !isTransferRow(r) && r.estado !== "Anulado"'), 'los traslados no suman a ingresos ni egresos');
assert.ok(reporte.includes('Traslados (+):') && reporte.includes('Traslados (−):'));
// Traslado+ = entra a un banco; Traslado− = sale de un banco (traslados y pagos hechos desde el banco).
assert.ok(reporte.includes('if (entraBanco) allRows.push(fila("Traslado+"));'), 'caja → banco solo es Traslado+');
assert.ok(reporte.includes('if (saleBanco || !entraBanco) allRows.push(fila("Traslado-"));'), 'banco → caja solo es Traslado−');
assert.ok(reporte.includes('salidaBanco: esBanco(pp.bancoCaja)'), 'se sabe si un pago salió de un banco');
assert.ok(reporte.includes('!(rowType === "Egreso-" && r.salidaBanco)'), 'el filtro Traslado− incluye los pagos hechos desde el banco');
assert.ok(reporte.includes('if (rowType === "Egreso-" && t.salidaBanco) counts["Traslado-"]'), 'el número del selector coincide con la tabla');
// Las reglas del reporte, probadas de verdad (se toman del archivo tal cual).
const block = reporte.slice(reporte.indexOf('const rowDate = '), reporte.indexOf('export default function ReporteFinanciero'));
const rules = new Function('localDate', block + '; return { rowInRange, rowMatchesOffice, rowMatchesProfessional, isTransferRow };')(localDate);
assert.ok(rules.rowInRange({ fechaSeleccionada: '2026-10-01' }, '2026-10-01', '2026-10-31'), 'el día 1 entra en su mes');
assert.ok(!rules.rowInRange({ fechaSeleccionada: '2026-11-01' }, '2026-10-01', '2026-10-31'));
assert.ok(rules.rowInRange({ fechaSeleccionada: '2026-10-31' }, '2026-10-31', '2026-10-31'));
const sedes = [{ id: 'TODAS', nombre: 'Todas las oficinas' }, { id: 's1', nombre: 'Sede Centro' }, { id: 's2', nombre: 'Sede Norte' }];
assert.ok(rules.rowMatchesOffice({}, 'Todas las oficinas', sedes));
assert.ok(rules.rowMatchesOffice({}, 'Sede Centro', sedes), 'sin sede = sede principal');
assert.ok(!rules.rowMatchesOffice({}, 'Sede Norte', sedes));
assert.ok(rules.rowMatchesOffice({ oficina: 'Sede Norte' }, 'Sede Norte', sedes));
assert.ok(!rules.rowMatchesOffice({ oficina: 'Sede Norte' }, 'Sede Centro', sedes));
const profs = [{ id: 'u1', nombre: 'Andrea Pérez', allNames: ['u1', 'andrea pérez', 'andrea', 'pérez', 'andrea@x.co'] },
               { id: 'u2', nombre: 'Andrea Gómez', allNames: ['u2', 'andrea gómez', 'andrea', 'gómez'] }];
assert.ok(rules.rowMatchesProfessional({ profesional: 'Andrea Pérez' }, 'Andrea Pérez', profs));
assert.ok(rules.rowMatchesProfessional({ profesionalId: 'u1' }, 'Andrea Pérez', profs));
assert.ok(!rules.rowMatchesProfessional({ profesional: '' }, 'Andrea Pérez', profs), 'sin profesional no aparece');
assert.ok(!rules.rowMatchesProfessional({ profesional: 'Andrea Gómez' }, 'Andrea Pérez', profs), 'no confunde dos Andreas');
assert.ok(rules.rowMatchesProfessional({ profesional: 'Dra. Andrea Pérez' }, 'Andrea Pérez', profs));
assert.ok(rules.rowMatchesProfessional({ profesional: 'x' }, 'Todos', profs));
assert.ok(rules.isTransferRow({ tipoDocumento: 'Traslado-' }) && !rules.isTransferRow({ tipoDocumento: 'Egreso-' }));
console.log('PASS: Reporte de facturación: fechas del día correcto, sede y profesional bien filtrados, traslados aparte de ingresos y egresos; Traslado+ entra al banco y Traslado− sale del banco (incluye pagos).');

// 8. Traslados banco ↔ caja abierta: aparecen en los movimientos de la caja y suman a su saldo.
const abierta = { id: 'c-open', nombre: 'Caja - juan madrid', estado: 'abierta', fechaApertura: '2026-10-31T12:14:11.902Z' };
const cerrada = { id: 'c-old', nombre: 'Caja - juan madrid', estado: 'cerrada', fechaApertura: '2026-10-31T11:14:00Z', fechaCierre: '2026-10-31T12:09:00Z' };
const sinCierre = { id: 'c-x', estado: 'cerrada', fechaApertura: '2026-10-30T02:15:44Z' };
const trs = [
  { id: 'a', tipo: 'manual', origen: 'nequi', destino: 'Caja Juan Madrid', caja_destino_id: 'c-open', monto: 200000, referencia: 'TR-1', created_at: '2026-10-31T13:00:00Z' },
  { id: 'b', tipo: 'manual', origen: 'Caja Juan Madrid', destino: 'nequi', caja_origen_id: 'c-open', monto: 20000, created_at: '2026-10-31T13:10:00Z' },
  { id: 'c', tipo: 'manual', origen: 'nequi', destino: 'Caja Principal (Efectivo)', monto: 100000, created_at: '2026-10-31T13:20:00Z' },   // viejo, sin caja: solo una abierta → esta
  { id: 'd', tipo: 'cierre_caja', caja_id: 'c-open', origen: 'Caja: Caja - juan madrid', destino: 'nequi', monto: 5000, created_at: '2026-10-31T13:30:00Z' }, // cierre: no
  { id: 'e', tipo: 'manual', origen: 'nequi', destino: 'Caja Principal (Efectivo)', monto: 7000, estado: 'Anulado', created_at: '2026-10-31T13:40:00Z' }, // anulado: no
  { id: 'f', tipo: 'manual', origen: 'nequi', destino: 'Bancolombia', monto: 9000, created_at: '2026-10-31T13:50:00Z' },                 // entre bancos: no
  { id: 'g', tipo: 'manual', origen: 'nequi', destino: 'Caja Principal (Efectivo)', monto: 1000, created_at: '2026-10-31T11:30:00Z' },   // cuando estaba abierta la otra caja
];
const movs = cajaTransferMovements(trs, abierta, { allCajas: [cerrada, sinCierre, abierta], banks: ['nequi', 'Bancolombia'] });
assert.deepEqual(movs.map((m) => [m.id, m.tipo, m.monto]), [['tr_a', 'ingreso', 200000], ['tr_b', 'egreso', 20000], ['tr_c', 'ingreso', 100000]]);
assert.equal(movs[0].concepto, 'Traslado desde nequi');
assert.equal(movs[1].concepto, 'Traslado hacia nequi');
assert.ok(movs.every((m) => m.esTraslado && m.metodo_pago === 'Efectivo' && m.caja_id === 'c-open'));
assert.deepEqual(cajaTransferMovements(trs, cerrada, { allCajas: [cerrada, sinCierre, abierta], banks: ['nequi'] }).map((m) => m.id), ['tr_g'], 'el traslado viejo va a la caja abierta en ese momento');
// Dos cajas abiertas a la vez: un traslado viejo sin caja no se adivina.
const otra = { id: 'c-2', nombre: 'Recepción', estado: 'abierta', fechaApertura: '2026-10-31T12:00:00Z' };
assert.deepEqual(cajaTransferMovements(trs, abierta, { allCajas: [abierta, otra], banks: ['nequi'] }).map((m) => m.id), ['tr_a', 'tr_b']);
// "Banco Caja Social" es un banco, no una caja.
assert.equal(cajaTransferMovements([{ id: 'h', origen: 'nequi', destino: 'Banco Caja Social', monto: 1, created_at: '2026-10-31T13:00:00Z' }], abierta, { allCajas: [abierta], banks: ['nequi', 'Banco Caja Social'] }).length, 0);
const open = await loadOpenCajas('t1', {
  getSection: async () => [abierta, cerrada, { ...otra, nombre: 'Caja - juan madrid' }],
  client: { from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: 'c-open', estado: 'abierta', tenant_id: 't1' }], error: null }) }) }) },
});
assert.equal(open.length, 2);
assert.ok(open.every((c) => c.label.startsWith('Caja Juan Madrid (abierta ')), 'dos cajas con el mismo nombre se distinguen por la hora');
const detalle2 = await read('src/modules/caja/components/CajaDetalleView.jsx');
assert.ok(detalle2.includes('cajaTransferMovements(ctx.transfers, caja, { allCajas: ctx.cajas, banks: ctx.banks })') && detalle2.includes('m.esTraslado ?'));
const cerrar2 = await read('src/modules/caja/components/CerrarCajaModal.jsx');
assert.ok(cerrar2.includes('setMovimientos([...(data || []), ...trasladoMovs]);'), 'el cierre cuenta los traslados en el efectivo esperado');
const cajaJsx2 = await read('src/modules/caja/Caja.jsx');
assert.ok(cajaJsx2.includes('cajaTransferMovements(trCtx.transfers, c, { allCajas: combined, banks: trCtx.banks })'), 'la lista de cajas suma los traslados');
const lista2 = await read('src/modules/facturacion/traslados/TrasladosList.jsx');
assert.ok(lista2.includes('newTraslado.caja_destino_id = cajaIdDe(destino);') && lista2.includes('loadOpenCajas(inquilino)'), 'el traslado nuevo guarda la caja exacta');
console.log('PASS: un traslado de un banco a la caja abierta aparece en sus movimientos y suma al saldo (y se cuenta al cerrar).');
