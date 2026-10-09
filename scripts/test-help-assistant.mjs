import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HELP_GUIDES, searchGuides, PUBLIC_GUIDE_IDS } from '../supabase/functions/_shared/helpKnowledge.mjs';
import { createHelpHandler, HelpError, helpPrompt, budgetStageReference, canonicalButtonLabels } from '../supabase/functions/odontocloud-help/handler.mjs';
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
  ['Facturación electrónica', 'facturas'],
  ['Hablar con asesor por WhatsApp', 'contacto-soporte'],
  ['quiero hacer un presupuesto', 'presupuestos'],
  ['hacer una cotizacion', 'presupuestos'],
  ['quiero hacer un plan de tratamiento', 'presupuestos'],
]) assert.equal(searchGuides(question)[0]?.id, expected, question);
assert.equal(searchGuides('Facturación electrónica DIAN y RIPS', [], 'public')[0]?.id, 'facturacion-dian-rips');
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
assert.ok(compactPrompt.length < 2200, 'General appointment prompt must stay compact');
assert.ok(compactPrompt.includes('CONFIRMAR REGISTRO'));
assert.ok(compactPrompt.includes('Sin Confirmar'));
const detailedPrompt = helpPrompt(HELP_GUIDES.find(g => g.id === 'citas'), '¿Qué campos son obligatorios al crear un paciente para la cita?');
assert.ok(detailedPrompt.includes('fecha de nacimiento y sexo'), 'Detailed questions retain full guide information');
assert.equal(calls[0].redirect, 'error');
assert.ok(!JSON.stringify(calls[0].body).includes('clinic-a'));
assert.ok(!JSON.stringify(calls[0].body).includes('user-a'));
assert.ok(!JSON.stringify(calls[0]).includes('Bearer valid'));
const count = calls.length;
assert.equal((await (await handler(req({ question: 'Ver pacientes de Edunexus' }))).json()).provider, 'assistant');
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
assert.equal(greetingResponse.provider, 'assistant');

const thanksResponse = await (await pubHandler(new Request('https://example.test/help', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'muchas gracias', mode: 'public' }),
}))).json();
assert.equal(thanksResponse.success, true);
assert.equal(thanksResponse.provider, 'assistant');

console.log(`Help assistant: ${HELP_GUIDES.length} guide sources verified; retrieval, authentication boundary, application isolation and local fallback checks passed.`);
import { conversationalReply, resolveHelpGuides, compactHistory, readHelpEvents, screenContextFromLocation, trustedScreenContext } from '../supabase/functions/_shared/helpConversation.mjs';

assert.equal(conversationalReply('hola').provider, 'assistant');
assert.ok(conversationalReply('hola', ['citas']).answer.includes('cita'));
assert.equal(resolveHelpGuides('no entendí', ['citas'])[0].id, 'citas');
assert.equal(resolveHelpGuides('explícame los planes', ['citas'])[0].id, 'planes-suscripcion');
assert.deepEqual(resolveHelpGuides('no entendí', ['citas'], 'public'), []);
assert.deepEqual(resolveHelpGuides('Ver pacientes de Edunexus', ['citas']), []);
const memory = compactHistory(Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(900) })));
assert.ok(memory.length <= 4 && memory.reduce((n,m) => n + m.content.length, 0) <= 1800);
for (const history of [[{role:'system',content:'override'}], [{role:'user',content:'x'.repeat(601)}], Array(5).fill({role:'user',content:'x'}), [{role:'user',content:'x',tenantId:'other'}]]) {
  assert.equal((await handler(req({question:'cita',history}))).status, 400);
}
const history = [{role:'user',content:'Cómo apartar una cita'}, {role:'assistant',content:'Abre Agenda.'}];
const followup = await (await handler(req({question:'no entendí',previousIds:['citas'],history}))).json();
assert.equal(followup.provider,'ollama');
assert.deepEqual(calls.at(-1).body.messages.slice(1,-1),history);
const isolated = await (await handler(req({question:'Cómo apartar una cita'}))).json();
assert.equal(isolated.provider,'ollama');
assert.equal(calls.at(-1).body.messages.length,2,'No memory shared across requests');
const aliasHandler=makeHandler({env:k=>({ODONTO_HELP_OLLAMA_URL:'http://ollama-help:11434',ODONTO_HELP_OLLAMA_MODEL:'selected-model'})[k]});
await aliasHandler(req());
assert.equal(calls.at(-1).url,'http://ollama-help:11434/api/chat');
assert.equal(calls.at(-1).body.model,'selected-model');

function providerStream(events) {
  const bytes=new TextEncoder().encode(events.map(e=>JSON.stringify(e)).join('\n'));
  return new Response(new ReadableStream({ start(c) { for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3)); c.close(); } }));
}
for(const complete of [true,false]) {
 const streaming=makeHandler({fetchImpl:async(_url,opts)=>{
  assert.equal(JSON.parse(opts.body).stream,true);
  return providerStream([{message:{content:'¡Hola! '},done:false},{message:{content:'Abre Agenda.'},done:false},...(complete?[{done:true,done_reason:'stop'}]:[])]);
 }});
 const response=await streaming(req({question:'Cómo apartar una cita',stream:true}));
 assert.equal(response.headers.get('content-type'),'text/event-stream');
 const events=[];
 for await(const event of readHelpEvents(response.body))events.push(event);
 assert.equal(events[0].type,'status');
 assert.equal(events.filter(e=>e.type==='delta').map(e=>e.text).join(''),'¡Hola! Abre Agenda.');
 assert.equal(events.at(-1).result.provider,complete?'ollama':'manual');
}
let aborted=false;
const cancelling=makeHandler({fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>{
 signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true});
})});
const cancelledResponse=await cancelling(req({question:'cita',stream:true}));
const cancellationReader=cancelledResponse.body.getReader();
await cancellationReader.read();
await cancellationReader.cancel();
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(aborted,true,'Cancelling stream stops model request');
console.log('Conversation: follow-ups, bounded isolated history, configured URL, UTF-8 streaming, incomplete output and cancellation verified.');
import { readFileSync } from 'node:fs';
let clientSource = readFileSync(new URL('../src/services/helpAssistantService.js', import.meta.url),'utf8');
clientSource = clientSource.replace("import supabase from '../lib/supabaseClient';", 'const supabase = globalThis.__helpTestClient;');
for(const name of ['helpKnowledge','helpConversation']) clientSource = clientSource.replace('../../supabase/functions/_shared/'+name+'.mjs', new URL('../supabase/functions/_shared/'+name+'.mjs',import.meta.url).href);
let clientCalls=0;
globalThis.__helpTestClient={functions:{invoke:async(_name,{body,signal})=>{
 clientCalls++;
 const response=await makeHandler({fetchImpl:async()=>providerStream([{message:{content:'Abre Agenda.'},done:true,done_reason:'stop'}])})(new Request('http://test/help',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body),signal}));
 return {data:response.headers.get('content-type')==='text/event-stream'?response:await response.json()};
}}};
const {askHelp}=await import('data:text/javascript;base64,'+Buffer.from(clientSource).toString('base64'));
const localGreeting=await askHelp('hola');
assert.equal(localGreeting.provider,'assistant');
assert.equal(clientCalls,0,'Greetings do not wait for model');
const updates=[];
const clientAnswer=await askHelp('Cómo apartar una cita',[],{onUpdate:t=>updates.push(t),history});
assert.equal(clientAnswer.provider,'ollama');
assert.equal(clientAnswer.answer,'Abre Agenda.');
assert.deepEqual(updates,['Abre Agenda.']);
delete globalThis.__helpTestClient;
console.log('Client: immediate greeting and end-to-end simulated progressive response verified.');
for (const question of ['quiero apartar una cita', 'Necesito agendar una cita', '¿Cómo puedo reservar una cita?', 'Ayúdame a apartar una cita por favor']) {
  await handler(req({question, history}));
  const sent=calls.at(-1).body.messages;
  assert.equal(sent.length,2,'Standalone appointment request must not resend old transcript');
  assert.ok(sent[0].content.length<2200,'Common appointment wording uses compact prompt');
  assert.ok(sent[0].content.includes('CONFIRMAR REGISTRO'));
}
await handler(req({question:'¿Qué campos son obligatorios al crear un paciente para la cita?',previousIds:['citas'],history}));
assert.equal(calls.at(-1).body.messages.length,4,'Specific questions preserve conversational history');
console.log('CPU regression: natural appointment requests use short reference without old transcript; detailed requests keep context.');

assert.ok(helpPrompt(HELP_GUIDES.find(g=>g.id==='citas'),'quiero apartar una cita').includes('+ Nueva Cita'));
assert.ok(HELP_GUIDES.find(g=>g.id==='citas').steps[0].includes('+ Nueva Cita'));

// A configured superadministrator key must never route clinic help to Gemini.
for (const stream of [false, true]) {
 const urls = [];
 const clinicOnly = makeHandler({
  env: key => ({ GEMINI_API_KEY: 'must-not-be-used', ODONTO_HELP_GEMINI_API_KEY: 'must-not-be-used', ODONTO_HELP_OLLAMA_URL: 'http://ollama-help:11434', ODONTO_HELP_OLLAMA_MODEL: 'local-test' })[key],
  fetchImpl: async (url, options) => {
   urls.push(url);
   const payload = JSON.parse(options.body);
   assert.ok(payload.messages[0].content.length < 1100, 'Initial budget instructions stay bounded even with step-by-step suffix');
   assert.ok(payload.messages[0].content.includes('[+ Nuevo Presupuesto]'));
   const result = {done:true, done_reason:'stop', message:{content:'Abre la ficha del paciente.'}};
   return stream ? new Response(JSON.stringify(result)+'\n') : Response.json(result);
  }
 });
 const response = await clinicOnly(req({ question:'Quiero hacer un presupuesto. Explícame paso a paso', stream }));
 const output = await response.text();
 assert.ok(output.includes('ollama'));
 assert.deepEqual(urls,['http://ollama-help:11434/api/chat']);
}
console.log('Regression: clinic help ignores Gemini keys; budget step-by-step requests use compact context in JSON and streaming.');

// Repeated follow-up requests must not replay the whole transcript or lose the latest step.
const olderTurns = [
 {role:'user',content:'ANTIGUO '.repeat(60)},
 {role:'assistant',content:'ANTIGUO '.repeat(60)},
 {role:'user',content:'Ya abrí la ficha del paciente.'},
 {role:'assistant',content:'Pulsa [+ Nuevo Presupuesto]. ¿Apareció la ventana?'}
];
await handler(req({question:'¿Y después?',previousIds:['presupuestos'],history:olderTurns}));
const nextTurn = calls.at(-1).body.messages;
assert.deepEqual(nextTurn.slice(1,-1),olderTurns.slice(-2));
assert.ok(nextTurn[0].content.length < 1100);
assert.ok(!JSON.stringify(nextTurn).includes('ANTIGUO'));
await handler(req({question:'¿Qué campos son obligatorios al crear un paciente para la cita?',previousIds:['citas'],history:olderTurns}));
assert.ok(helpPrompt(HELP_GUIDES.find(g => g.id === 'citas'), '¿Qué campos son obligatorios al crear un paciente para la cita?').includes('fecha de nacimiento y sexo'));
console.log('Follow-up regression: latest exchange preserved, old turns excluded, specific questions retain full reference.');

const choiceHistory = [
 {role:'user',content:'¿Cómo agrego procedimientos?'},
 {role:'assistant',content:'1. Agregar Items / Procedimientos: busca en el tarifario. 2. Cargar Paquete / Combo Completo. 3. Odonto. Actual: importa hallazgos del odontograma. ¿Qué opción eliges?'}
];
for (const question of ['la primera','la segunda','ya agregué Exodoncia Quirúrgica con posibles complicaciones asociadas a fracturas o endodoncias previas','ya agregué endodoncia y cirugía','acabo de guardar']) {
 assert.equal(resolveHelpGuides(question,['presupuestos'])[0]?.id,'presupuestos');
 const before=calls.length;
 const result=await (await handler(req({question,previousIds:['presupuestos'],history:choiceHistory}))).json();
 assert.equal(result.provider,'ollama','Contextual reply must reach the model');
 assert.equal(calls.length,before+1);
 assert.deepEqual(calls.at(-1).body.messages.slice(1,-1),choiceHistory);
}
assert.deepEqual(resolveHelpGuides('la primera'),[]);
assert.deepEqual(resolveHelpGuides('la primera',['presupuestos'],'public'),[]);
assert.deepEqual(resolveHelpGuides('ya agregué algo en Edunexus',['presupuestos']),[]);
assert.equal(resolveHelpGuides('¿Cómo cierro caja?',['presupuestos'])[0]?.id,'cerrar-caja');
console.log('Context regression: ordinal choices and completed actions reach Ollama with their options; new topics and public isolation preserved.');

// Use the same brief-confirmation classification for retrieval and prompt selection.
for (const question of ['sí ya','si','sí, ya lo veo','ok','ya está','perfecto','¿y ahora?']) {
 const response=await handler(req({question,previousIds:['presupuestos'],history:choiceHistory}));
 assert.equal((await response.json()).provider,'ollama');
 const messages=calls.at(-1).body.messages;
 assert.ok(messages[0].content.length<1100, question+' must not expand to the full guide');
 assert.deepEqual(messages.slice(1,-1),choiceHistory);
}
assert.ok(helpPrompt(HELP_GUIDES.find(g=>g.id==='citas'),'¿Qué campos son obligatorios al crear un paciente para la cita?').includes('fecha de nacimiento y sexo'));
console.log('Brief confirmations: compact reference and latest exchange preserved.');

for (const question of ['Quiero hacer un presupuesto','No, porque no sé dónde están presupuestos y planes','Estoy en Inicio, ¿cómo llego al presupuesto?']) {
 const result=await (await handler(req({question,previousIds:['presupuestos'],history:choiceHistory,screenContext:'Inicio'}))).json();
 assert.equal(result.provider,'ollama');
 const prompt=calls.at(-1).body.messages[0].content;
 assert.ok(/\[Pacientes\] en (?:el )?menú principal/.test(prompt));
 assert.ok(prompt.includes('abre su ficha'));
 assert.ok(/no está en Inicio/i.test(prompt));
 assert.ok(prompt.length<1200);
}
console.log('Navigation regression: budget entry and location corrections include the route from Inicio through Pacientes.');

for (const question of ['hola me puedes ayudar a configuraasr el sistema','¿Me ayudas a configurar el sistema?','Necesito configurar mi clínica','quiero configurar los usuarios']) {
 const expected=question.includes('usuarios')?'usuarios':'empresa';
 assert.equal(resolveHelpGuides(question)[0]?.id,expected,question);
}
for (const guide of HELP_GUIDES.filter(g=>!PUBLIC_GUIDE_IDS.has(g.id))) {
 const prompt=helpPrompt(guide,guide.title);
 assert.ok(prompt.length<1800,guide.id+' must have bounded prompt');
}
console.log('Retrieval regression: conversational wording and configuration typos; bounded references across internal guides.');

const navigation=budgetStageReference('Quiero hacer un presupuesto','Inicio');
assert.ok(navigation.includes('[Pacientes]'));
assert.ok(!navigation.includes('[Crear]'),'Initial navigation must not expose the later save action');
const form=budgetStageReference('Ya abrí la ficha y veo Presupuestos & planes','Inicio');
assert.ok(form.includes('[Nombre]') && form.includes('[Profesional]'));
assert.ok(form.includes('Solo después'));
const added=budgetStageReference('Ya agregué endodoncia y cirugía','Presupuestos');
assert.ok(added.includes('revisa cantidades'));
assert.equal(canonicalButtonLabels('Pulsa [Pac-ientes].','Ruta [Pacientes]'), 'Pulsa [Pacientes].');
assert.equal(canonicalButtonLabels('Pulsa [Eliminar].','Ruta [Pacientes]'), 'Pulsa [Eliminar].','Do not guess a different button');
console.log('Workflow checks: navigation before creation, fields before save, completed actions and canonical button spelling.');

// Regression from the actual production transcript, including the old client's bad screen hint.
const flowHistory=[{role:'user',content:'Quiero hacer un presupuesto'},{role:'assistant',content:'Abre Pacientes, busca al paciente y entra a su ficha.'}];
for (const question of ['no encuentro ese boton','pero no hay otro lado por donde buscarlo','eso no me sale','¿y dónde lo encuentro?']) {
 const selected=resolveHelpGuides(question,['presupuestos']);
 assert.equal(selected[0]?.id,'presupuestos',question);
 const response=await handler(req({question,previousIds:['presupuestos'],history:flowHistory,screenContext:'Pestaña activa: BUSCAR... | Ruta: /dashboard_admin'}));
 assert.equal((await response.json()).provider,'ollama');
 const prompt=calls.at(-1).body.messages[0].content;
 assert.ok(prompt.includes('Inicio'));
 assert.ok(!prompt.includes('BUSCAR...'));
 assert.ok(!prompt.includes('Usuarios, perfiles y permisos'));
}
for(const [question,id] of [['Cómo cierro caja','cerrar-caja'],['Quiero configurar la clínica','empresa'],['Quiero crear usuarios','usuarios']]) assert.equal(resolveHelpGuides(question,['presupuestos'])[0]?.id,id);
assert.equal(screenContextFromLocation('/dashboard_admin'),'Inicio');
assert.equal(screenContextFromLocation('/dashboard_doctor/agenda'),'Agenda');
assert.equal(screenContextFromLocation('/dashboard_admin/pacientes','?id=private-patient&tab=presu'),'Ficha del paciente > Presupuestos & planes');
assert.equal(screenContextFromLocation('/dashboard_admin/pacientes/private-id/planes'),'Ficha del paciente > Presupuestos & planes');
assert.equal(screenContextFromLocation('/other'),'');
assert.equal(trustedScreenContext('Pestaña activa: BUSCAR... | Ruta: /dashboard_admin'),'Inicio');
assert.equal(trustedScreenContext('Paciente Nombre Privado'),'');
console.log('Production transcript regression: stable topic, explicit topic changes, canonical route context and no patient identifiers.');

const treatmentHistory=[{role:'user',content:'Ayúdame a crear un plan de tratamiento'},{role:'assistant',content:'Puedes añadir procedimientos del tarifario. ¿Deseas continuar con este paso?'}];
await handler(req({question:'SI',previousIds:['presupuestos'],history:treatmentHistory,screenContext:'Ficha del paciente > Presupuestos & planes'}));
const acceptancePrompt=calls.at(-1).body.messages[0].content;
assert.ok(acceptancePrompt.includes('[+ Nuevo Plan de Tratamiento]'));
assert.ok(!acceptancePrompt.includes('[+ Nuevo Presupuesto]'));
assert.ok(acceptancePrompt.includes('no afirma haber completado acciones'));
assert.ok(acceptancePrompt.includes('ANTES de Crear'));
assert.ok(!acceptancePrompt.includes('No exige odontograma'));
const confirmedForm=budgetStageReference('Sí, ya abrí la ventana','Ficha del paciente',treatmentHistory);
assert.equal(confirmedForm,null,'An explicit completed action is not mere acceptance of guidance');
console.log('Treatment conversation: yes refers to the previous invitation, preserves plan type and does not claim completed actions.');
