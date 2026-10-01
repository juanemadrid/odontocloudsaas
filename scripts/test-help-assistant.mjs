import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HELP_GUIDES, searchGuides } from '../supabase/functions/_shared/helpKnowledge.mjs';
import { createHelpHandler, HelpError, helpPrompt } from '../supabase/functions/odontocloud-help/handler.mjs';
import { authenticateHelp } from '../supabase/functions/odontocloud-help/auth.mjs';

function mockAdmin({ authError = null, profile = { tenant_id: 'clinic-a', activo: true }, tenant = { id: 'clinic-a', activo: true } } = {}) {
  const reads = [];
  return {
    reads,
    auth: { getUser: async token => { assert.equal(token, 'verified-token'); return { data: { user: authError ? null : { id: 'verified-user' } }, error: authError }; } },
    from: table => ({ select: () => ({ eq: (column, value) => ({ maybeSingle: async () => {
      reads.push({ table, column, value });
      return { data: table === 'profiles' ? profile : tenant, error: null };
    } }) }) }),
  };
}
const admin = mockAdmin();
assert.deepEqual(await authenticateHelp(admin, 'verified-token'), { userId: 'verified-user', tenantId: 'clinic-a', active: true });
assert.deepEqual(admin.reads, [{ table: 'profiles', column: 'id', value: 'verified-user' }, { table: 'tenants', column: 'id', value: 'clinic-a' }]);
for (const options of [{ authError: new Error('invalid') }, { profile: null }, { profile: { tenant_id: 'clinic-a', activo: false } }, { tenant: null }, { tenant: { id: 'clinic-a', activo: false } }]) {
  await assert.rejects(() => authenticateHelp(mockAdmin(options), 'verified-token'), HelpError);
}

for (const guide of HELP_GUIDES) {
  assert.ok(existsSync(guide.source), `Missing source: ${guide.id}`);
  assert.ok(guide.steps.length >= 3);
}
assert.equal(new Set(HELP_GUIDES.map(g => g.id)).size, HELP_GUIDES.length);
for (const [question, expected] of [
  ['¿Cómo hago para apartar una cita?', 'citas'],
  ['¿Cómo cancelo una cita?', 'editar-cita'],
  ['¿Cómo reprogramo una cita?', 'editar-cita'],
  ['¿Cómo crear un paciente?', 'pacientes'],
  ['Importar pacientes Excel', 'importar-pacientes'],
  ['Cerrar caja y contar efectivo', 'cerrar-caja'],
  ['Abrir caja', 'abrir-caja'],
  ['Factura electrónica DIAN', 'facturas'],
  ['Consultar odontograma', 'odontograma'],
  ['Registrar una evolución', 'evoluciones'],
  ['No veo el botón por permisos', 'usuarios'],
  ['Validar RIPS al MUV', 'rips'],
  ['¿Cuáles son los planes de suscripción y precios de OdontoCloud?', 'planes-suscripcion'],
  ['¿Cómo funciona la prueba gratis?', 'prueba-gratis'],
  ['Facturación electrónica DIAN y RIPS', 'facturacion-dian-rips'],
  ['Hablar con asesor por WhatsApp', 'contacto-soporte'],
]) assert.equal(searchGuides(question)[0]?.id, expected, question);
assert.deepEqual(searchGuides('Receta de una torta', ['citas']), []);
assert.deepEqual(searchGuides('Ver pacientes de Edunexus', ['citas']), []);
assert.equal(searchGuides('¿Y después?', ['citas'])[0]?.id, 'citas');

let calls = [];
const makeHandler = (overrides = {}) => createHelpHandler({
  authenticate: async token => {
    if (token !== 'valid') throw new HelpError(401, 'Sesión inválida');
    return { userId: 'user-a', tenantId: 'clinic-a', active: true };
  },
  env: name => ({ ODONTO_HELP_OLLAMA_URL: 'http://ollama:11434', ODONTO_HELP_OLLAMA_MODEL: 'local-test' })[name],
  fetchImpl: async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    return Response.json({ done: true, message: { content: 'Abre Agenda y revisa la guía.' } });
  },
  ...overrides,
});
const req = (body = { question: 'Cómo apartar una cita' }, token = 'valid') => new Request('https://example.test/help', {
  method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
});
const handler = makeHandler();
assert.equal((await handler(req(undefined, null))).status, 401);
assert.equal((await handler(req(undefined, 'edunexus-token'))).status, 401);
assert.equal(calls.length, 0);
assert.equal((await makeHandler({ authenticate: async () => ({ userId: 'u', tenantId: 't', active: false }) })(req())).status, 403);
for (const extra of [{ app: 'edunexus' }, { tenantId: 'clinic-b' }, { model: 'other' }, { messages: [] }, { url: 'http://elsewhere' }]) {
  assert.equal((await handler(req({ question: 'cita', ...extra }))).status, 400);
}
assert.equal((await handler(req({ question: 'x'.repeat(1201) }))).status, 400);
assert.equal((await handler(req({ question: 'x'.repeat(9000) }))).status, 413);
assert.equal((await handler(req({ question: 'cita', previousIds: ['foreign-doc'] }))).status, 400);
assert.equal((await handler(new Request('https://example.test/help', { method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{bad' }))).status, 400);
const answer = await (await handler(req())).json();
assert.equal(answer.provider, 'ollama');
assert.ok(answer.sources.some(s => s.id === 'citas'));
assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'http://ollama:11434/api/chat');
assert.equal(calls[0].body.messages.length, 2);
assert.equal(calls[0].body.model, 'local-test');
const compactPrompt = calls[0].body.messages[0].content;
assert.ok(compactPrompt.length < 800, 'General appointment prompt must stay compact');
assert.ok(compactPrompt.includes('CONFIRMAR REGISTRO'));
assert.ok(compactPrompt.includes('Sin Confirmar'));
const detailedPrompt = helpPrompt(HELP_GUIDES.find(g => g.id === 'citas'), '¿Qué campos son obligatorios al crear un paciente para la cita?');
assert.ok(detailedPrompt.includes('fecha de nacimiento y sexo'), 'Detailed questions retain full guide information');
assert.equal(calls[0].redirect, 'error');
assert.ok(!JSON.stringify(calls[0].body).includes('clinic-a'));
assert.ok(!JSON.stringify(calls[0].body).includes('user-a'));
assert.ok(!JSON.stringify(calls[0]).includes('Bearer valid'));
const count = calls.length;
assert.equal((await (await handler(req({ question: 'Ver pacientes de Edunexus' }))).json()).provider, 'manual');
assert.equal(calls.length, count);
assert.equal((await (await makeHandler({ env: () => undefined })(req())).json()).reason, 'not_configured');
for (const fetchImpl of [
  async () => { throw new Error('private provider diagnostic'); },
  async () => new Response('private error', { status: 500 }),
  async () => Response.json({ message: { content: '' } }),
  async () => Response.json({ done: false, message: { content: 'partial' } }),
]) {
  const fallback = await (await makeHandler({ fetchImpl })(req())).json();
  assert.equal(fallback.provider, 'manual');
  assert.equal(fallback.reason, 'unavailable');
  assert.ok(fallback.answer.includes('CONFIRMAR REGISTRO'));
  assert.ok(!JSON.stringify(fallback).includes('private'));
}
assert.equal((await handler(new Request('https://example.test/help'))).status, 405);
assert.equal((await handler(new Request('https://example.test/help', { method: 'OPTIONS' }))).status, 204);
const events = [];
const slowAuth = makeHandler({ authenticate: () => new Promise(() => {}), authTimeoutMs: 5, log: event => events.push(event) });
assert.equal((await slowAuth(req())).status, 503);
assert.deepEqual(events.map(e => e.stage), ['auth_started', 'request_rejected']);
assert.equal(events.at(-1).status, 503);
events.length = 0;
const slowModel = makeHandler({ ollamaTimeoutMs: 5, log: event => events.push(event), fetchImpl: (_url, { signal }) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
}) });
const timedOut = await (await slowModel(req())).json();
assert.equal(timedOut.provider, 'manual');
assert.equal(timedOut.reason, 'unavailable');
assert.equal(events.at(-1).reason, 'timeout');
assert.ok(!JSON.stringify(events).includes('valid'));
assert.ok(!JSON.stringify(events).includes('clinic-a'));
assert.ok(!JSON.stringify(events).includes('apartar'));
const truncated = await (await makeHandler({fetchImpl: async () => Response.json({ done: true, done_reason: 'length', message: { content: 'Incomplete instructions' } })})(req())).json();
assert.equal(truncated.provider, 'manual');
assert.ok(!truncated.answer.includes('Incomplete instructions'));

const pubHandler = makeHandler();
const pubResponse = await (await pubHandler(new Request('https://example.test/help', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'que planes tienes', mode: 'public' }),
}))).json();
assert.equal(pubResponse.success, true);
assert.equal(pubResponse.sources[0]?.id, 'planes-suscripcion');

const greetingResponse = await (await pubHandler(new Request('https://example.test/help', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'hola', mode: 'public' }),
}))).json();
assert.equal(greetingResponse.success, true);
assert.equal(greetingResponse.provider, 'ollama');

const thanksResponse = await (await pubHandler(new Request('https://example.test/help', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'muchas gracias', mode: 'public' }),
}))).json();
assert.equal(thanksResponse.success, true);
assert.equal(thanksResponse.provider, 'ollama');

console.log(`Help assistant: ${HELP_GUIDES.length} guide sources verified; retrieval, authentication boundary, application isolation and local fallback checks passed.`);
