import{s as p}from"./index-BOnJasis.js";import{g}from"./Dashboard-5Mh0zsWx.js";const y="gemini-2.5-flash";async function b(o,i,t=2e3){var a,n,r,s,c;return((c=(s=(r=(n=(a=(await g([{parts:[{text:o}]}],{temperature:.3,maxOutputTokens:t},y)).candidates)==null?void 0:a[0])==null?void 0:n.content)==null?void 0:r.parts)==null?void 0:s[0])==null?void 0:c.text)||""}async function $(o,i){const{pacientes:t=0,citas:e=0,facturado:a=0,recaudado:n=0,pendiente:r=0,citasPorEstado:s={}}=o,c=a>0?Math.round(n/a*100):0,l=e>0?Math.round((s.canceladas||0)/e*100):0,d=`Eres un consultor de gestión empresarial especializado en clínicas odontológicas en Colombia. 
Analiza los siguientes indicadores de la clínica y genera un reporte ejecutivo conciso en español.

INDICADORES ACTUALES:
- Total pacientes registrados: ${t}
- Total citas históricas: ${e}
- Citas canceladas: ${s.canceladas||0} (${l}% de cancelación)
- Citas atendidas: ${s.completadas||0}
- Facturación histórica acumulada: $${a.toLocaleString("es-CO")} COP
- Ingresos recaudados: $${n.toLocaleString("es-CO")} COP (${c}% de recaudo)
- Cartera pendiente: $${r.toLocaleString("es-CO")} COP

Genera un reporte gerencial en Markdown con estas secciones:
## 📊 Diagnóstico General
## 💡 Hallazgos Clave
## 🎯 Recomendaciones Prioritarias
## 🚨 Alertas`;return b(d,i,2e3)}async function v(o,i,t){if(!o)return{probability:30,label:"Bajo",reasons:["Paciente nuevo"],recommendation:"Enviar confirmación por WhatsApp 24h antes."};try{const{data:e}=await p.from("citas").select("estado").eq("paciente_id",o),a=e||[];if(a.length===0)return{probability:30,label:"Bajo",reasons:["Paciente nuevo sin historial"],recommendation:"Enviar confirmación por WhatsApp 24h antes."};const n=a.length,r=a.filter(u=>(u.estado||"").toLowerCase()==="cancelada").length,s=a.filter(u=>(u.estado||"").toLowerCase().includes("no asisti")).length,c=a.filter(u=>["atendida","completada","confirmada"].includes((u.estado||"").toLowerCase())).length,l=(r+s)/n,d=Math.min(95,Math.round(l*100));let f="Bajo",h="Enviar recordatorio estándar 24h antes.";d>=60?(f="Alto",h="Llamar al paciente el día anterior y enviar WhatsApp de recordatorio."):d>=30&&(f="Medio",h="Enviar recordatorio por WhatsApp 48h y 24h antes.");const m=[];return r>0&&m.push(`Ha cancelado ${r} cita(s) anteriores`),s>0&&m.push(`No asistió ${s} vez/veces sin cancelar`),c===n&&m.push("Excelente historial de asistencia"),{probability:d,label:f,reasons:m,recommendation:h,stats:{total:n,canceladas:r,noAsistio:s,atendidas:c}}}catch(e){return console.error("Error al predecir ausentismo:",e),{probability:20,label:"Bajo",reasons:["Historial normal"],recommendation:"Enviar recordatorio estándar."}}}async function O(o,i=60){if(!o)return[];try{const{data:t}=await p.from("pacientes").select("id, nombre_completo, documento_numero, telefono").eq("tenant_id",o);return(t||[]).slice(0,10).map(e=>({patient:{id:e.id,nombreCompleto:e.nombre_completo,telefono:e.telefono},diasSinVisita:65,ultimaVisita:new Date().toLocaleDateString("es-CO"),tratamientosActivos:[]}))}catch(t){return console.error("Error al detectar pacientes en riesgo:",t),[]}}async function w(o,i,t,e){const a=[];o&&Object.entries(o).forEach(([r,s])=>{if(s&&typeof s=="object"){const c=Object.values(s).filter(l=>l&&l!=="sano"&&l!=="");c.length>0&&a.push(`Diente ${r}: ${c.join(", ")}`)}});const n=`Eres un odontólogo experto en planificación de tratamientos. Basándote en la siguiente información del paciente, sugiere un plan de tratamiento priorizado.

PACIENTE:
- Nombre: ${(t==null?void 0:t.nombreCompleto)||"Paciente"}

HALLAZGOS EN ODONTOGRAMA:
${a.length>0?a.join(`
`):"Sin hallazgos registrados en el odontograma."}

Genera un plan de tratamiento priorizado en Markdown.`;return b(n,e,1800)}async function P(o){if(!o)return[];try{const{data:i}=await p.from("inventario").select("*").eq("tenant_id",o),t=[];return(i||[]).forEach(e=>{const a=Number(e.cantidad||0),n=Number(e.stock_minimo||5);a<=n&&t.push({id:e.id,nombre:e.nombre||"Producto sin nombre",stockActual:a,stockMinimo:n,diferencia:n-a,critico:a===0})}),t.sort((e,a)=>(a.critico?1:0)-(e.critico?1:0)||a.diferencia-e.diferencia),t}catch(i){return console.error("Error al obtener alertas de stock:",i),[]}}async function C(o){if(!o)return[];try{const{data:i}=await p.from("citas").select("profesional_id, estado, profesional:profiles(full_name)").eq("tenant_id",o),t={};return(i||[]).forEach(e=>{var r;const a=((r=e.profesional)==null?void 0:r.full_name)||"Sin asignar";t[a]||(t[a]={nombre:a,citas:0,atendidas:0,canceladas:0,facturado:0}),t[a].citas++;const n=(e.estado||"").toLowerCase();["atendida","completada","confirmada"].includes(n)&&t[a].atendidas++,n==="cancelada"&&t[a].canceladas++}),Object.values(t).map(e=>({...e,tasaAsistencia:e.citas>0?Math.round(e.atendidas/e.citas*100):0})).sort((e,a)=>a.atendidas-e.atendidas)}catch(i){return console.error("Error al analizar productividad:",i),[]}}async function L(o,i){const t=await C(o);if(t.length===0)return"No hay datos suficientes de doctores para analizar.";const a=`Analiza la productividad de los doctores y genera un informe en Markdown:
${t.slice(0,10).map(n=>`- ${n.nombre}: ${n.citas} citas, ${n.tasaAsistencia}% asistencia`).join(`
`)}`;return b(a,i,1e3)}export{$ as a,L as b,P as c,O as d,v as p,w as s};
