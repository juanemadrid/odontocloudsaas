// Isolated browser test: real component, mocked client, no remote services or real accounts.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin)) return route.abort();
    if (new URL(url).pathname !== '/__help_controls_test') return route.continue();
    await route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' });
  });
  await page.goto(`${origin}/__help_controls_test`);
  await page.evaluate(() => {
    const state = { global: { id: true, enabled: false, daily_limit: 40, monthly_limit: 500 }, clinics: [], fail: false, writes: [],
      keyConfigured: false, keyFail: false, keyCalls: [] };
    window.__helpState = state;
    window.__supabase = { functions: { invoke: async (name, { body }) => {
      if (name !== 'odontocloud-help-settings') throw new Error('Unexpected function');
      state.keyCalls.push(body.action);
      if (body.action === 'diagnose') {
        const enabled = state.global.enabled && state.clinics.find(c => c.tenant_id === body.tenantId)?.enabled;
        return { data: { success: true, result: enabled ? { provider: 'gemini', model: 'gemini-3.8-flash', answer: 'Abre el módulo indicado.' } : { provider: 'manual', reason: 'disabled' } }, error: null };
      }
      if (body.action === 'status') return { data: { success: true, configured: state.keyConfigured, source: state.keyConfigured ? 'panel' : 'none',
        model: 'gemini-2.5-flash-lite', encryptionReady: true }, error: null };
      if (state.keyFail) return { data: { success: false, error: 'Prueba rechazada. Se conserva la clave anterior.' }, error: null };
      if (body.action === 'save') state.keyConfigured = true;
      return { data: { success: true, message: body.action === 'save' ? 'Clave probada y guardada.' : 'Conexión correcta.' }, error: null };
    } }, from(table) {
      let mutation, value;
      const query = {
        select() { return query; }, eq() { return query; }, single() { return query; },
        update(v) { mutation = 'update'; value = v; return query; },
        upsert(v) { mutation = 'upsert'; value = v; return query; },
        then(resolve) {
          if (state.fail) return Promise.resolve({ data: null, error: { message: 'simulated failure' } }).then(resolve);
          if (mutation) {
            state.writes.push({ table, value });
            if (table === 'odonto_help_global') Object.assign(state.global, value);
            else {
              const existing = state.clinics.find(c => c.tenant_id === value.tenant_id);
              if (existing) Object.assign(existing, value); else state.clinics.push(value);
            }
          }
          return Promise.resolve({ data: structuredClone(table === 'odonto_help_global' ? state.global : mutation ? value : state.clinics), error: null }).then(resolve);
        },
      };
      return query;
    } };
  });
  await page.evaluate(async () => {
    const { default: RefreshRuntime } = await import('/@react-refresh');
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Controls } = await import('/src/modules/superadmin/HelpAiControls.jsx');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Controls, { tenants: [{ id: 'clinic-a', name: 'Clínica A' }, { id: 'clinic-b', name: 'Clínica B' }] }));
  });
  await page.locator('summary').click();
  const global = page.getByRole('switch', { name: 'Asistente IA en todas las clínicas', exact: true });
  const clinicA = page.getByRole('switch', { name: 'Asistente IA para Clínica A', exact: true });
  const clinicB = page.getByRole('switch', { name: 'Asistente IA para Clínica B', exact: true });
  await global.waitFor();
  assert.equal(await global.getAttribute('aria-checked'), 'false');
  await clinicA.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Asistente IA para Clínica A"]')?.getAttribute('aria-checked') === 'true');
  assert.equal(await clinicB.getAttribute('aria-checked'), 'false');
  assert.ok(await page.getByText('Pausada por el interruptor general.', { exact: false }).isVisible());
  await global.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Asistente IA en todas las clínicas"]')?.getAttribute('aria-checked') === 'true');
  await clinicA.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Asistente IA para Clínica A"]')?.getAttribute('aria-checked') === 'false');
  await page.evaluate(() => { window.__helpState.fail = true; });
  await clinicB.click();
  await page.getByRole('alert').waitFor();
  assert.equal(await clinicB.getAttribute('aria-checked'), 'false');
  assert.deepEqual(errors, []);
  assert.equal((await page.evaluate(() => window.__helpState.writes)).length, 3);
  const settings = page.getByRole('region', { name: 'Conexión de Gemini para ayuda' });
  const keyField = settings.getByLabel('Nueva clave API de Gemini');
  assert.equal(await keyField.getAttribute('type'), 'password');
  assert.equal(await keyField.getAttribute('maxlength'), '1024');
  const authKey = 'AQ.' + 'syntheticSegment_-'.repeat(20) + '.tail';
  await keyField.fill(authKey);
  assert.equal(await keyField.inputValue(), authKey);
  await settings.getByRole('button', { name: 'Probar conexión', exact: true }).click();
  await settings.getByText('Conexión correcta.', { exact: true }).waitFor();
  assert.ok(await keyField.inputValue());
  await page.evaluate(() => { window.__helpState.keyFail = true; });
  await settings.getByRole('button', { name: 'Probar y guardar clave' }).click();
  await settings.getByRole('alert').waitFor();
  assert.ok(await keyField.inputValue());
  assert.equal(await page.evaluate(() => window.__helpState.keyConfigured), false);
  await page.evaluate(() => { window.__helpState.keyFail = false; });
  await settings.getByRole('button', { name: 'Probar y guardar clave' }).click();
  await page.waitForFunction(() => document.getElementById('help-gemini-key').value === '');
  await settings.getByText('Clave configurada · Guardada desde este panel', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__helpState.keyCalls), ['status','test','save','save','status']);
  await page.evaluate(() => { window.__helpState.fail = false; });
  await page.getByRole('button', { name: 'Probar IA para Clínica A', exact: true }).click();
  await page.getByText('La prueba no obtuvo respuesta de Gemini', { exact: true }).waitFor();
  await clinicA.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Asistente IA para Clínica A"]')?.getAttribute('aria-checked') === 'true');
  await page.getByRole('button', { name: 'Probar IA para Clínica A', exact: true }).click();
  await page.getByText('Gemini respondió · gemini-3.8-flash', { exact: true }).waitFor();
  console.log('Help controls browser: switches, isolated clinics, masked key entry, test/save, failed replacement and field clearing verified without remote requests.');
} finally { await browser?.close(); await server.close(); }
