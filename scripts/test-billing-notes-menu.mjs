import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';

let allowed=true,mayCreate=true,index=0,effects=[],calls=[];
const bill={id:'invoice',numero:'FCEV1345',total:150000,detalles:{pacienteNombre:'Paciente de prueba'}};
const note={id:'note',factura_id:'invoice',numero:'NC1',fecha:'2026-10-30T11:44:33Z',monto_acreditado:150000,dian_status:'ACCEPTED',cude:'a'.repeat(96)};
const states=()=>[[note],[bill],false,'','',false,null,null,false];
const hooks={default:React,useCallback:f=>f,useMemo:f=>f(),useRef:()=>({current:0}),
  useState:()=>[states()[index++],()=>{}],useEffect:f=>effects.push(f)};
const source=await readFile(new URL('../src/modules/facturacion/nota/BillingNotesModule.jsx',import.meta.url),'utf8');
const transformed=await transformWithOxc(source,'BillingNotesModule.jsx',{jsx:{runtime:'automatic'}});
const context=vm.createContext({console,Date,Map,Number,String,URL,setTimeout});
const module=new vm.SourceTextModule(transformed.code,{context});
const db={from:table=>{
  const query={select:()=>query,eq:(field,value)=>{calls.push({table,field,value});return query;},order:()=>query,
    then:resolve=>Promise.resolve({data:table==='facturas'?[bill]:[note],error:null}).then(resolve)};
  return query;
}};
const mocks={
  react:hooks,'react/jsx-runtime':jsx,
  '../../../lib/supabaseClient':{default:db},
  '../../../context/AuthContext':{useAuth:()=>({userProfile:{tenant_id:'clinic'}})},
  '../../../hooks/usePermissions':{usePermissions:()=>({can:(_module,_feature,action)=>action==='crear'?mayCreate:allowed})},
  '../electronica/NotaCreditoElectronicaModal':{default:()=>null},
  '../../../services/factusService':{downloadCreditNotePDF:()=>{throw Error('Unexpected download');},downloadCreditNoteXML:()=>{throw Error('Unexpected download');}},
  '../../../services/factusCreditNotePayloadBuilder':{validateInvoiceCreditEligibility:()=>{}},
};
await module.link(spec=>{
  const exports=mocks[spec];assert.ok(exports,`Unexpected import ${spec}`);
  return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
});
await module.evaluate();
const render=kind=>{index=0;effects=[];return renderToStaticMarkup(React.createElement(module.namespace.default,{kind}));};
const credit=render('credit');
assert.ok(credit.includes('NC1') && credit.includes('FCEV1345') && credit.includes('Paciente de prueba'));
assert.ok(credit.includes('Nueva nota crédito') && credit.includes('PDF') && credit.includes('XML'));
assert.ok(!credit.includes('Eliminar') && !credit.includes('Anular'));
const cleanup=effects[0]();await new Promise(resolve=>setTimeout(resolve,0));cleanup();
assert.equal(calls.length,2);
for(const call of calls){assert.equal(call.field,'tenant_id');assert.equal(call.value,'clinic');}
const debit=render('debit');
assert.ok(debit.includes('La emisión electrónica de nuevas notas débito no está habilitada'));
assert.ok(!debit.includes('Nueva nota') && !debit.includes('>PDF<') && !debit.includes('Eliminar'));
mayCreate=false;assert.ok(!render('credit').includes('Nueva nota crédito'));
allowed=false;assert.ok(render('credit').includes('No tienes permiso'));
calls=[];effects[0]();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls.length,0);
console.log('PASS: rendered credit/debit histories; tenant-scoped reads; consult/create permissions; fiscal downloads only for verified credit notes; no legacy financial mutations.');
