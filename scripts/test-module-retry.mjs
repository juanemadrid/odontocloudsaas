// Carga de módulos con reintentos y service worker sin respuestas "408" vacías. Sin red.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { retryImport, isChunkLoadError } from '../src/utils/retryImport.js';

const noSleep = async () => {};
const chunkError = (url = 'https://odontocloudcolombia.com/assets/Caja-AbC123.js') =>
  new TypeError(`Failed to fetch dynamically imported module: ${url}`);

// 1. Corte breve: el primer intento falla y el reintento (con dirección nueva) carga el módulo.
{
  const urls = [];
  let calls = 0;
  const mod = await retryImport(async () => { calls += 1; throw chunkError(); }, {
    sleep: noSleep, importUrl: async (u) => { urls.push(u); return { default: 'Caja' }; },
  });
  assert.equal(mod.default, 'Caja');
  assert.equal(calls, 1);
  assert.match(urls[0], /^https:\/\/odontocloudcolombia\.com\/assets\/Caja-AbC123\.js\?reintento=1-\d+$/);
}
console.log('PASS: un corte breve se recupera solo, sin pantalla de error.');

// 2. Sin dirección en el mensaje (Safari/Firefox): se repite la misma carga.
{
  let calls = 0;
  const mod = await retryImport(async () => {
    calls += 1;
    if (calls < 3) throw new TypeError('Importing a module script failed.');
    return { default: 'Agenda' };
  }, { sleep: noSleep });
  assert.equal(mod.default, 'Agenda');
  assert.equal(calls, 3);
}
console.log('PASS: en navegadores que no dicen la dirección también se reintenta.');

// 3. Si la conexión no vuelve, se rinde tras 3 reintentos y deja actuar a la pantalla de error de siempre.
{
  let attempts = 0;
  await assert.rejects(retryImport(async () => { attempts += 1; throw new TypeError('Importing a module script failed.'); }, { sleep: noSleep }),
    /Importing a module script failed/);
  assert.equal(attempts, 4);
}
console.log('PASS: sin conexión real, no se queda reintentando para siempre.');

// 4. Un error del propio módulo (no de descarga) no se reintenta ni se oculta.
{
  let attempts = 0;
  await assert.rejects(retryImport(async () => { attempts += 1; throw new ReferenceError('x is not defined'); }, { sleep: noSleep }), /x is not defined/);
  assert.equal(attempts, 1);
  assert.ok(isChunkLoadError(new Error('Unable to preload CSS for /assets/Caja.css')));
  assert.ok(!isChunkLoadError(new Error('Cannot read properties of undefined')));
}
console.log('PASS: los errores de programación no se esconden con reintentos.');

// 5. Todos los módulos usan la carga con reintentos.
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8').then((s) => s.replace(/\r\n/g, '\n'));
for (const f of ['src/App.jsx', 'src/pages/Dashboard.jsx', 'src/modules/pacientes/components/HistoriaClinicaContainer.jsx']) {
  const src = await read(f);
  assert.ok(!src.includes('React.lazy('), `${f} todavía usa React.lazy directo`);
  assert.ok(src.includes('lazyWithRetry(() => import('), f);
}
console.log('PASS: Caja, Agenda, Facturación, Reportes y demás módulos cargan con reintentos.');

// 6. El service worker ya no inventa respuestas 408 vacías.
const sw = await read('public/sw.js');
assert.ok(!sw.includes('408'));
assert.ok(sw.includes('Response.error()'));
assert.ok(sw.includes("if (event.request.method !== 'GET') return;"));
assert.ok(sw.includes('if (url.origin !== self.location.origin) return;'), 'sigue sin tocar Supabase ni APIs externas');
console.log('PASS: el service worker reintenta una vez y ya no devuelve el 408 vacío.');
