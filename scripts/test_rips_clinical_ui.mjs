// Navegador aislado, base de datos sintética y cero llamadas a servicios externos.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const tenant = '00000000-0000-4000-a000-000000000001';
const doctor = '00000000-0000-4000-a000-000000000002';
const patient = '00000000-0000-4000-a000-000000000003';
const professional = { id: doctor, tenant_id: tenant, role: 'doctor', full_name: 'Profesional Prueba',
  nombreCompleto: 'Profesional Prueba', numeroDocumento: '12345678', generaRips: true, esDoctor: true, ripsCodigoUnico: '7000101658' };
const tables = {
  tenants: [{ id: tenant, nit: '901234567', esIps: false }],
  website_config: [{ tenant_id: tenant, config: { empresa_datos: { providerType: 'PROFESIONAL_INDEPENDIENTE',
    billingObligation: 'NOT_REQUIRED', administrativeConfirmation: true }, user_details: { [doctor]: professional } } }],
  profiles: [professional],
  pacientes: [{ id: patient, tenant_id: tenant, nombreCompleto: 'Paciente Prueba', nroDocumento: '98765432',
    tipoDoc: 'CC', fechaNacimiento: '1990-01-01', sexo: 'F', codMunicipioResidencia: '70001' }],
  treatment_plans: [{ id: 'plan-prueba', tenant_id: tenant, paciente_id: patient, items: [
    { id: 'proc-1', code: '232102', desc: 'Procedimiento Prueba', amount: 50000, qty: 1, realizado: true, fechaRealizado: '2026-10-03' },
    { id: 'con-1', code: '890203', desc: 'Consulta Prueba', amount: 30000, qty: 1, realizado: true,
      fechaRealizado: '2026-10-04', asocConsultaId: 'consulta-prueba' },
  ] }],
  evoluciones: [{ id: 'evo-prueba', tenant_id: tenant, paciente_id: patient, profesional_id: doctor, fecha: '2026-10-03T14:00:00',
    tratamiento: JSON.stringify({ planId: 'plan-prueba', doctorId: doctor, dxPrincipal: { code: 'K021' },
      plantillaItems: { 'proc-1': { realizado: true } } }) }],
  documentos_clinicos: [{ id: 'consulta-prueba', tenant_id: tenant, paciente_id: patient, tipo: 'Consulta',
    metadata: { profesional: 'Profesional Prueba', cups: '890203', fechaIso: '2026-10-04T14:00:00', dxPrincipalConsulta: { code: 'K021' } } }],
};
const stub = `const tables = ${JSON.stringify(tables)};
// Forma real de persistencia de createPlan/updatePlan, no la vista del editor.
for (const plan of tables.treatment_plans) { plan.detalles = { items: plan.items }; delete plan.items; }
const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'ips') {
  tables.tenants[0].esIps = true;
  Object.assign(tables.website_config[0].config.empresa_datos, {providerType:'IPS',billingObligation:'ELECTRONIC_INVOICE_REQUIRED',codigoPrestador:'700010000101'});
  tables.facturas_electronicas = [{id:'factura-prueba',tenant_id:'${tenant}',paciente_id:'${patient}',numero:'FE-PRUEBA',fecha:'2026-10-05',cufe:'CUFE-PRUEBA',
    items: tables.treatment_plans[0].detalles.items.map(item=>({...item, cups:item.code, planId:'plan-prueba',planItemId:item.id,clinicalSourceId:item.id,clinicalSourceType:'PLAN_ITEM',total:item.amount}))}];
}
if (mode === 'missing-diagnosis') {
  const data = JSON.parse(tables.evoluciones[0].tratamiento); delete data.dxPrincipal;
  tables.evoluciones[0].tratamiento=JSON.stringify(data);
}
if (mode === 'tariff-disabled') {
  tables.listas_precios = [{id:'tarifa',tenant_id:'${tenant}',descripcion:JSON.stringify([
    {codigo:'232102',nombre:'Procedimiento Prueba',genera_rips:false},
    {codigo:'890203',nombre:'Consulta Prueba',genera_rips:false}
  ])}];
}
if (mode === 'unconfirmed') tables.website_config[0].config.empresa_datos.administrativeConfirmation=false;
if (mode === 'cups-conflict') {
  const item=tables.treatment_plans[0].detalles.items[0]; item.code='890203'; item.es_consulta=false;
}
if (mode === 'duplicate-tariff') {
  tables.treatment_plans[0].detalles.baseListId='correct-list';
  tables.treatment_plans[0].detalles.items[0].desc='Consulta de Control sobre plano Estabilizador';
  tables.treatment_plans[0].detalles.items[0].es_consulta=true; // copia antigua incorrecta
  tables.listas_precios=[
    {id:'correct-list',tenant_id:'${tenant}',descripcion:JSON.stringify([
      {codigo:'232102',nombre:'Consulta de Control sobre plano Estabilizador',genera_rips:true,es_consulta:false},
      {codigo:'232102',nombre:'Otro producto',genera_rips:false,es_consulta:true},
      {codigo:'890203',nombre:'Consulta Prueba',genera_rips:true,es_consulta:true}
    ])},
    {id:'other-list',tenant_id:'${tenant}',descripcion:JSON.stringify([
      {codigo:'232102',nombre:'Consulta de Control sobre plano Estabilizador',genera_rips:false,es_consulta:true}
    ])}
  ];
}
if (['renamed-product','equivalent-products','needs-link'].includes(mode)) {
  tables.treatment_plans[0].detalles.baseListId='current-list';
  Object.assign(tables.treatment_plans[0].detalles.items[0], {desc:mode==='renamed-product'
    ? 'Consulta de Control o seguimientos sobre plano Estabilizador' : 'Nombre antiguo no recuperable',genera_rips:false});
  tables.listas_precios=[{id:'current-list',nombre:'Tarifario actual',tenant_id:'${tenant}',descripcion:JSON.stringify([
    {id:'actual',codigo:'232102',nombre:'Control o seguimiento sobre plano Estabilizador',genera_rips:true,es_consulta:false},
    {id:'another',codigo:'232102',nombre:'Otro producto',genera_rips:mode==='equivalent-products',es_consulta:mode!=='equivalent-products'},
    {id:'consultation',codigo:'890203',nombre:'Consulta Prueba',genera_rips:true,es_consulta:true}
  ])}];
  if (localStorage.getItem('__ripsTestConfig_'+mode)) Object.assign(tables.website_config[0].config, JSON.parse(localStorage.getItem('__ripsTestConfig_'+mode)));
}
window.__ripsQueries = [];
window.__ripsWrites = [];
window.__ripsOriginalPlans = JSON.stringify(tables.treatment_plans);
const client = { from(table) {
  window.__ripsQueries.push(table); let rows = tables[table] || []; let single = false;
  const query = { select() {return this;}, eq(key,value) { rows=rows.filter(r=>r[key]===value); return this; },
    order(){return this;}, limit(){return this;}, in(){return this;},
    range(start,end){rows=rows.slice(start,end+1);return this;}, maybeSingle(){single=true;return this;},
    then(resolve,reject){ return Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(resolve,reject); }
  }; return query;
}, async rpc(name,args){
  if(name==='set_tenant_config_section'){
    if(args.p_tenant_id!=='${tenant}')throw new Error('tenant incorrecto');
    window.__ripsWrites.push({name,args}); tables.website_config[0].config[args.p_key]=args.p_value;
    localStorage.setItem('__ripsTestConfig_'+mode,JSON.stringify({[args.p_key]:args.p_value}));
    return {data:{[args.p_key]:args.p_value},error:null};
  }
  return {data:null,error:null};
}, functions:{async invoke(name,{body}){if(name!=='muv-proxy'||body.operation!=='RIPS_WITHOUT_FEV')throw new Error('Operación inesperada');window.__ripsTransmission=body;return {data:{success:true,cuv:'CUV-SIMULADO'},error:null};}} };
window.__ripsCurrentPlans=()=>JSON.stringify(tables.treatment_plans);
globalThis.__supabase = client; export const supabase = client; export default client;`;
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{ name: 'rips-isolated-fixtures', enforce: 'pre',
    load(id) {
      if (id === '/__rips_test_entry.jsx') return `
        import React from 'react'; import {createRoot} from 'react-dom/client';
        import {MemoryRouter} from 'react-router-dom'; import Rips from '/src/modules/rips/RipsGenerator.jsx';
        createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(Rips)));`;
      if (id.replaceAll('\\', '/').endsWith('/src/lib/supabaseClient.js')) return stub;
      if (id.replaceAll('\\', '/').endsWith('/src/context/AuthContext.jsx')) return `export const useAuth=()=>({userProfile:{inquilino:'${tenant}'}});`;
    },
    resolveId(id) { if (id === '/__rips_test_entry.jsx') return id; },
    configureServer(server) { server.middlewares.use('/__rips_test', async (_req,res) => {
      res.setHeader('Content-Type','text/html');
      res.end(await server.transformIndexHtml('/__rips_test', '<div id="root"></div><script type="module" src="/__rips_test_entry.jsx"></script>'));
    }); },
  }, react()],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test`);
  await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
  await page.locator('select').selectOption(doctor);
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
  await page.getByRole('button', { name: /^Buscar$/ }).click();
  await page.getByText('Documentos DIAN', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).waitFor({ timeout: 30000 });
  assert.equal(await page.getByText('Configuración Incompleta para RIPS', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Documentos DIAN', { exact: true }).count(), 1);
  assert.equal(await page.locator('table').first().getByText('Sin datos', { exact: true }).count(), 1);
  assert.equal(await page.getByText(/Recibo: RIPS-/).count(), 0);
  assert.equal(await page.getByText('98765432', { exact: true }).count(), 3, 'paciente, consulta y procedimiento visibles');
  assert.equal(await page.getByText('890203', { exact: true }).count(), 1);
  assert.equal(await page.getByText('232102', { exact: true }).count(), 1);
  const queries = await page.evaluate(() => window.__ripsQueries);
  assert.equal(queries.some(table => table.startsWith('facturas')), false, 'sin dependencia de facturación');
  assert.deepEqual(errors, []);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^EXPORTAR$/ }).click()]);
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const files = Object.values(zip.files).filter(file => file.name.endsWith('.json'));
  assert.equal(files.length, 2);
  const payloads = await Promise.all(files.map(async file => JSON.parse(await file.async('string'))));
  for (const payload of payloads) { assert.equal(payload.numFactura, null); assert.equal(payload.usuarios.length, 1); }
  assert.equal(payloads.reduce((sum,p) => sum + (p.usuarios[0].servicios.consultas?.length || 0), 0), 1);
  assert.equal(payloads.reduce((sum,p) => sum + (p.usuarios[0].servicios.procedimientos?.length || 0), 0), 1);
  await page.getByRole('button', {name:'Enviar consulta 890203 de 98765432',exact:true}).click();
  await page.getByRole('button', {name:'Ver CUV',exact:true}).waitFor();
  const transmission=await page.evaluate(()=>window.__ripsTransmission);
  assert.equal(transmission.ripsJson.numFactura,null);
  assert.equal(transmission.ripsJson.usuarios[0].servicios.consultas.length,1);
  assert.equal(transmission.ripsJson.usuarios[0].servicios.procedimientos?.length||0,0);
  assert.equal(await page.getByRole('button',{name:'Enviar procedimiento 232102 de 98765432',exact:true}).count(),1);
  console.log('PASS UI: envío individual simulado transmite solo su consulta y muestra CUV, procedimiento sigue pendiente.');
  console.log('PASS UI: profesional no obligado, REPS de usuario, paciente/consulta/procedimiento y JSON sin FEV, sin consultar facturas.');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test?mode=missing-diagnosis`);
  await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
  await page.locator('select').selectOption(doctor);
  await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
  await page.getByRole('button', { name: /^Buscar$/ }).click();
  await page.getByText(/Diagnóstico principal CIE-10 no registrado/).first().waitFor();
  assert.equal(await page.getByText('98765432', { exact: true }).count(), 3);
  assert.equal(await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).count(), 0);
  console.log('PASS UI: diagnóstico faltante se muestra sin ocultar paciente ni atenciones.');
  for (const mode of ['tariff-disabled']) {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test?mode=${mode}`);
    await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
    await page.locator('select').selectOption(doctor);
    await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
    await page.getByRole('button', { name: /^Buscar$/ }).click();
    await page.getByRole('region', { name: 'Observaciones RIPS' }).waitFor();
    assert.equal(await page.getByText('98765432', { exact: true }).count(), 3);
    assert.equal(await page.locator('table').first().getByText('Sin datos', { exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).count(), 0);
    if (mode === 'tariff-disabled') await page.getByText(/tiene desactivado Genera RIPS/).first().waitFor();
    else await page.getByText(/confirmación administrativa|confirmada administrativamente|confirmado administrativamente/i).first().waitFor();
    console.log(`PASS UI ${mode}: servicios visibles, impedimento explícito, sin soportes en DIAN ni JSON oficial inválido.`);
  }
  for (const mode of ['unconfirmed', 'duplicate-tariff', 'renamed-product', 'equivalent-products']) {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test?mode=${mode}`);
    await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
    await page.locator('select').selectOption(doctor);
    await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
    await page.getByRole('button', { name: /^Buscar$/ }).click();
    await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Observaciones RIPS' }).count(), 0);
    assert.equal(await page.getByText('232102', { exact: true }).count(), 1);
    assert.equal(await page.getByText('890203', { exact: true }).count(), 1);
    assert.equal(await page.locator('table').first().getByText('Sin datos', { exact: true }).count(), 1);
    console.log(`PASS UI ${mode}: procedimiento evolucionado y consulta vinculada con tarifario correcto; sin requisito tributario extra.`);
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test?mode=needs-link`);
  await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
  await page.locator('select').first().selectOption(doctor);
  await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
  await page.getByRole('button', { name: /^Buscar$/ }).click();
  await page.getByRole('region', { name: 'Vincular productos históricos RIPS' }).waitFor();
  await page.getByRole('combobox', { name: /Producto RIPS de/ }).selectOption({ label:'Tarifario actual / Control o seguimiento sobre plano Estabilizador · Genera RIPS: Sí · Procedimiento' });
  await page.getByRole('button', { name:'Vincular solo para RIPS' }).click();
  await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).waitFor();
  assert.equal(await page.getByRole('region', { name:'Observaciones RIPS' }).count(),0);
  assert.equal(await page.evaluate(()=>window.__ripsWrites.length),1);
  assert.equal(await page.evaluate(()=>window.__ripsOriginalPlans===window.__ripsCurrentPlans()),true);
  await page.reload();
  await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
  await page.locator('select').first().selectOption(doctor);
  await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
  await page.getByRole('button', { name: /^Buscar$/ }).click();
  await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).waitFor();
  assert.equal(await page.getByRole('region', { name:'Vincular productos históricos RIPS' }).count(),0);
  console.log('PASS UI: vínculo histórico guardado y recuperado tras recarga, sin modificar presupuesto ni evolución.');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test?mode=cups-conflict`);
  await page.getByRole('option', { name: /Profesional Prueba/ }).waitFor({ state: 'attached' });
  await page.locator('select').selectOption(doctor);
  await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
  await page.getByRole('button', { name: /^Buscar$/ }).click();
  await page.getByText(/RIPS_SERVICE_TYPE_CUPS_MISMATCH/).first().waitFor();
  assert.equal(await page.getByRole('button', { name: /Descargar RIPS Sin FEV/ }).count(), 0);
  assert.equal(await page.getByText(/sin registro de consulta médica realizada/).count(), 0);
  console.log('PASS UI: conflicto entre Es consulta y CUPS oficial se informa sin pedir Docclinic para un procedimiento.');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__rips_test?mode=ips`);
  await page.getByText('Sucursales', { exact: true }).waitFor();
  await dates.nth(0).fill('2026-10-01'); await dates.nth(1).fill('2026-10-22');
  await page.getByRole('button', { name: /^Buscar$/ }).click();
  await page.getByText('LISTO FEV-RIPS', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await page.getByText('Documentos DIAN', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Atenciones sin factura', { exact: true }).count(), 0);
  assert.equal(await page.getByText('232102', { exact: true }).count(), 1);
  assert.equal(await page.getByText('890203', { exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS UI: IPS conserva facturas DIAN, consultas, procedimientos y preparación FEV-RIPS.');
} finally { await browser?.close(); await server.close(); }
