// Caja: quien cierra, traslados a bancos al cierre, Caja → Bancos y módulo Traslados. Sin red.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.endsWith('lib/supabaseClient.js')) return { url: 'data:text/javascript,export default {};', shortCircuit: true };
    if (specifier.endsWith('configPersistenceService.js')) return { url: 'data:text/javascript,export const getConfigSection=async()=>[];export const saveConfigSection=async()=>{};export const getConfigItems=async()=>[];', shortCircuit: true };
    return next(specifier, context);
  }`));
const svc = await import('../src/services/bankTransferService.js');
const { buildClosingTransfers, saveTransfers, loadAllTransfers, bankMovements, bankNames } = svc;

// 1. Traslados del cierre: validados y con todo lo que leen Traslados, Bancos y Reportes.
const caja = { id: '8f2c1a90-aaaa', nombre: 'Caja Principal', usuarioNombre: 'Juan Madrid' };
let n = 0;
const now = new Date('2026-10-31T02:19:00Z'); // 30-oct 9:19 p. m. en Colombia
const tr = buildClosingTransfers({ caja, destinos: [{ banco: 'nequi', valor: 50000, medio: 'Efectivo' }], contado: 100000, usuario: 'Juan Madrid', now, makeId: () => `id${++n}` });
assert.equal(tr.length, 1);
assert.deepEqual({ ...tr[0] }, {
  id: 'id1', tipo: 'cierre_caja', caja_id: caja.id, fecha: '2026-10-30', origen: 'Caja: Caja Principal', destino: 'nequi', monto: 50000,
  medio: 'Efectivo', descripcion: 'Traslado por cierre de caja - Caja Principal (Efectivo)', referencia: 'TR-CIERRE-8F2C1A', estado: 'Activo',
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
console.log('PASS: cierre, lista de cajas, detalle, Bancos, Traslados y el menú de Facturación quedan conectados.');
