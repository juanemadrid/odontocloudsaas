import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const tenant='tenant-test',doctor='doctor-test',admin='admin-test';
let handler, rows, calls, mode;
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://selfhost.test',SUPABASE_SERVICE_ROLE_KEY:'test',MUV_GATEWAY_SHARED_SECRET:'test',MUV_GATEWAY_URL:'https://gateway.test'})[key]},serve:fn=>handler=fn};
const professional={id:doctor,numeroDocumento:'123',generaRips:true,ripsCodigoUnico:'7000101658'};
function reset(m='success') {mode=m;calls=[];rows={profiles:[{id:admin,tenant_id:tenant,role:m==='impersonation'?'doctor':'admin',activo:true},{id:doctor,tenant_id:m==='foreign-doctor'?'other':tenant,activo:true}],website_config:[{tenant_id:tenant,config:{empresa_datos:{providerType:m==='ips'?'IPS':'PROFESIONAL_INDEPENDIENTE',billingObligation:'NOT_REQUIRED'},user_details:{[doctor]:professional}}}],tenant_secrets:[{tenant_id:tenant,sispro_config:{doctores:{[doctor]:m==='no-secret'?{}:{sisproPasswordEncrypted:'encrypted',documento:'123'}}}}],pacientes:[{id:'patient',tenant_id:tenant,nroDocumento:'456'}],rips_validaciones:[]};}
globalThis.__createClient=()=>({auth:{getUser:async()=>({data:{user:{id:admin}}})},from(table){
 let filters=[],op='select',patch,single=false;
 const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(){return q},maybeSingle(){single=true;return q},single(){single=true;return q},insert(v){op='insert';patch=v;return q},update(v){op='update';patch=v;return q},then(resolve,reject){
 let result;
 if(op==='insert') {if(rows[table].some(r=>r.idempotency_key===patch[0].idempotency_key))result={error:{code:'23505'}};else{const row={...patch[0],id:'validation-'+rows[table].length};rows[table].push(row);result={data:row};}}
 else {const selected=rows[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(op==='update'){if(mode==='save-error')result={error:{message:'save failed'}};else selected.forEach(r=>Object.assign(r,patch));} result||={data:single?selected[0]||null:selected,error:null};}
 return Promise.resolve(result).then(resolve,reject);
 }};return q;
}});
globalThis.__decrypt=async()=> 'secret-test-only';
globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(mode==='rejected'?{success:false,errores:['clinical rejection']}:{success:true,cuv:'CUV-TEST'}, {status:200});};
let source=await readFile('supabase/functions/muv-proxy/index.ts','utf8');
source=source.replace(/import \{ createClient \} from [^;]+;/,'const createClient=globalThis.__createClient;').replace(/import \{[\s\S]*?\} from "\.\.\/tenant-secrets\/crypto.ts";/,'const decryptDoctorSisproSecret=globalThis.__decrypt; const decryptInstitutionalSisproSecret=globalThis.__decrypt;');
await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const payload={operation:'RIPS_WITHOUT_FEV',doctorIdOverride:doctor,ripsJson:{numFactura:null,numDocumentoIdObligado:'123',usuarios:[{numDocumentoIdentificacion:'456',servicios:{procedimientos:[{codPrestador:'7000101658',codProcedimiento:'232102'}]}}]}};
async function send(body=payload){const response=await handler(new Request('https://local.test',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};}
reset();let result=await send();assert.equal(result.status,200);assert.equal(result.data.cuv,'CUV-TEST');assert.equal(calls.length,1);assert.equal(calls[0].body.operation,'RIPS_WITHOUT_FEV');assert.equal(calls[0].body.rips.numFactura,null);assert.equal(calls[0].body.xml,undefined);assert.equal(JSON.stringify(result).includes('secret-test-only'),false);await send();assert.equal(calls.length,1,'CUV cache evita duplicados');console.log('PASS proxy: envío sin FEV, secreto solo en servidor, CUV persistido e idempotencia.');
for(const [scenario,status] of [['foreign-doctor',403],['impersonation',403],['ips',400],['no-secret',400]]){reset(scenario);result=await send();assert.equal(result.status,status,scenario);assert.equal(calls.length,0);}
reset();const foreign=structuredClone(payload);foreign.ripsJson.usuarios[0].numDocumentoIdentificacion='999';assert.equal((await send(foreign)).status,403);assert.equal(calls.length,0);
reset();const invalid=structuredClone(payload);invalid.ripsJson.numFactura='FE1';assert.equal((await send(invalid)).status,400);assert.equal(calls.length,0);console.log('PASS proxy: bloquea otro tenant, suplantación, IPS, credenciales ausentes, paciente ajeno y factura en modo sin FEV.');
reset('rejected');result=await send();assert.equal(result.data.estado,'REJECTED');assert.equal(rows.rips_validaciones[0].idempotency_key,null);console.log('PASS proxy: rechazo MUV no genera CUV y permite corregir/reintentar.');
reset('save-error');result=await send();assert.equal(result.status,500);assert.equal(result.data.cuv,'CUV-TEST');assert.ok(rows.rips_validaciones[0].idempotency_key,'no liberar un envío aceptado si falla persistencia');console.log('PASS proxy: fallo al guardar aceptación conserva bloqueo contra reenvío.');
