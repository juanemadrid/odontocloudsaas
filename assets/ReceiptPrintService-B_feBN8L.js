import{s as x,F as at,G as rt}from"./index-BOnJasis.js";import{ah as d}from"./vendor-D-sKmyMP.js";const ct={generatePDF:async(t,o,a,n)=>{if(!t||!o||!a){console.error("Missing data for PDF generation:",{pago:t,patient:o,clinic:a}),d.error("Datos insuficientes para generar el recibo");return}const $=d.loading("Generando recibo de caja...");try{let s=null,c=null,g=null,f=t.planTitle;const b=t.planId||t.plan_id,y=o.id||t.pacienteId||t.paciente_id;if(b)try{const{data:e}=await x.from("treatment_plans").select("*").eq("id",b).maybeSingle();if(e){f=e.title||e.nombre||f||"Tratamiento Odontológico",s=Number(e.total||0);const{data:r}=await x.from("pagos").select("*").eq("planId",b);c=(r||[]).reduce((w,v)=>w+Number(v.monto||0),0),g=Math.max(0,s-c)}}catch{}else if(y&&t.tipo!=="egreso")try{const{data:e}=await x.from("treatment_plans").select("*").eq("paciente_id",y).order("created_at",{ascending:!1}).limit(1);if(e&&e.length>0){const r=e[0];f=r.title||r.nombre||"Tratamiento Odontológico",s=Number(r.total||0);const{data:w}=await x.from("pagos").select("*").eq("pacienteId",y);c=(w||[]).reduce((v,it)=>v+Number(it.monto||0),0),g=Math.max(0,s-c)}}catch{}const i=document.createElement("div");i.style.position="absolute",i.style.left="-9999px",i.style.top="0",i.style.width="850px",i.style.padding="40px",i.style.backgroundColor="white",i.style.color="#1e293b",i.style.fontFamily="'Inter', system-ui, -apple-system, sans-serif";const C=a.inquilino||(n==null?void 0:n.inquilino)||"";let z="",D="",S="",N="",T="",E="";if(C)try{const{data:e}=await x.from("tenants").select("*").eq("id",C).maybeSingle();e&&(z=e.logo||e.logo_url||e.logoUrl||"",D=e.nombre_comercial||e.nombreComercial||e.name||e.nombre||"",S=e.nit||"",N=e.address||e.direccion||"",T=e.phone||e.telefono||"",E=e.email||"")}catch(e){console.error("Error loading tenant config for print:",e)}const O=z||a.logo||a.logoUrl||"",I=D||a.nombreComercial||a.nombre||"Clínica Dental",A=S||a.nit||"—",j=N||a.direccion||"—",k=T||a.telefono||"—",R=E||a.email||"",P=o.nombreCompleto||`${o.nombres||o.nombre||""} ${o.apellidos||o.apellido||""}`.trim()||o.displayName||t.pacienteNombre||t.patientNombre||"Paciente",_=o.documento||o.nroDocumento||o.numero_documento||o.nro_documento||o.identificacion||o.cedula||o.docNumber||t.pacienteDocumento||t.documento||t.patientDoc||"—",U=o.tipoDocumento||o.tipo_documento||o.tipoDoc||t.tipoDocumento||"CC",F=o.direccion||o.direccionDomicilio||o.lugarResidencia||o.address||"—",B=o.ciudadDomicilio||o.ciudad||o.municipio||a.ciudad||"Sincelejo",q=o.celular||o.telefono||o.phone||o.movil||"—";let m=String(t.nroConsecutivo||"").trim();m.startsWith("No.")&&(m=m.replace(/^No\.\s*/i,""));const M=m||"S/N",G=(t.fecha?t.fecha.toDate?t.fecha.toDate():new Date(t.fecha):new Date).toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"}),W=`$ ${Number(t.monto||0).toLocaleString("es-CO")}`,H=`$ ${Number(t.monto||0).toLocaleString("es-CO")}`,J=t.concepto||"Abono a tratamiento",K=t.notas||"Abono de tratamiento",p=t.tipo==="egreso",Y=!p&&typeof s=="number"&&s>0,l=p?"#dc2626":"#2563eb",Q=p?"#fef2f2":"#eff6ff",V=p?"#fca5a5":"#dbeafe",X=t.documentTitle||(p?"Comprobante de Egreso":"Recibo de Caja"),Z=`
                <div style="border: 1px solid #e2e8f0; padding: 40px; border-radius: 24px; position: relative; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    <!-- Top accent bar -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background-color: ${l}; border-top-left-radius: 24px; border-top-right-radius: 24px;"></div>

                    <!-- Unified Premium Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid ${l}; padding-bottom: 25px; margin-bottom: 30px; margin-top: 15px;">
                        <div style="display: flex; gap: 25px; align-items: center;">
                            ${O?`<img src="${O}" style="max-height: 75px; max-width: 165px; object-fit: contain;" crossorigin="anonymous" />`:`<div style="width: 80px; height: 80px; background: ${l}; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 900; text-transform: uppercase;">${I.substring(0,1)||"O"}</div>`}
                            <div>
                                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -1px;">${I}</h1>
                                <p style="margin: 4px 0; font-size: 13px; color: #475569; font-weight: 800;">NIT: ${A}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500;">${j}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500;">TEL: ${k} | ${R}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${Q}; padding: 12px 20px; border-radius: 16px; border: 2px solid ${V}; margin-bottom: 8px; display: inline-block;">
                                <span style="font-size: 16px; font-weight: 900; color: ${l}; text-transform: uppercase; letter-spacing: 0.5px;">${X}</span>
                            </div>
                            <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 900; text-transform: uppercase;">FECHA DE EMISIÓN: ${G}</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 900; color: ${l}; font-family: monospace;">NRO: ${M}</p>
                        </div>
                    </div>

                    <!-- CUSTOMER / BENEFICIARY INFO CARD -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 25px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
                        <div style="border-right: 1px solid #cbd5e1; padding-right: 20px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                                ${p?"Beneficiario / Proveedor / Tercero":"Información del Paciente"}
                            </span>
                            <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">${P}</h2>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 10px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">ID / DOC:</strong> ${U.toUpperCase()} ${_}</p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Dirección:</strong> ${F} (${B})</p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Celular:</strong> ${q}</p>
                            </div>
                        </div>
                        <div style="padding-left: 10px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                                ${p?"Detalles del Egreso":"Detalles del Recibo"}
                            </span>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Medio de Pago:</strong> <span style="text-transform: uppercase;">${t.medio||t.metodo||t.metodo_pago||t.medioPago||"Efectivo"}</span></p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Elaborado por:</strong> <span style="text-transform: uppercase;">${t.registradoPor&&!t.registradoPor.includes("@")?t.registradoPor:(n==null?void 0:n.nombreCompleto)||(n==null?void 0:n.nombre)||"Guillermo Rodríguez"}</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- ITEMS DETAIL TABLE -->
                    <div style="margin-bottom: 30px;">
                        <table style="width: 100%; border-collapse: collapse; border-radius: 16px; overflow: hidden; border-style: hidden; box-shadow: 0 0 0 1px #e2e8f0;">
                            <thead>
                                <tr style="background: ${l}; color: white;">
                                    <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Concepto</th>
                                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 120px;">Precio Unitario</th>
                                    <th style="padding: 12px 15px; text-align: center; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 70px;">Cantidad</th>
                                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 130px;">Total</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 12px; color: #334155; font-weight: 600;">
                                ${t.itemPayments&&t.itemPayments.length>0?t.itemPayments.map((e,r)=>`
                                    <tr style="background: ${r%2===0?"#ffffff":"#f8fafc"}; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 15px; font-weight: 800; text-transform: uppercase;">${e.desc}</td>
                                        <td style="padding: 12px 15px; text-align: right; font-family: monospace;">$ ${Number(e.monto).toLocaleString("es-CO")}</td>
                                        <td style="padding: 12px 15px; text-align: center; font-weight: 900;">1</td>
                                        <td style="padding: 12px 15px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">$ ${Number(e.monto).toLocaleString("es-CO")}</td>
                                    </tr>
                                `).join(""):`
                                    <tr style="background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 14px 15px; font-weight: 800; text-transform: uppercase;">${J}</td>
                                        <td style="padding: 14px 15px; text-align: right; font-family: monospace;">$ ${Number(t.monto||0).toLocaleString("es-CO")}</td>
                                        <td style="padding: 14px 15px; text-align: center; font-weight: 900;">1</td>
                                        <td style="padding: 14px 15px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">$ ${Number(t.monto||0).toLocaleString("es-CO")}</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- OBS & TOTALS ROW -->
                    <div style="display: flex; justify-content: space-between; gap: 40px; margin-bottom: 60px; align-items: flex-start;">
                        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 20px; padding: 20px; background-color: #f8fafc; font-size: 11px; line-height: 1.6;">
                            <span style="font-weight: 900; color: #475569; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 8px;">Observaciones:</span>
                            <div style="font-weight: 500; color: #334155; white-space: pre-wrap;">${K}</div>
                        </div>
                        <div style="width: 280px; display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #64748b; padding: 0 4px;">
                                <span style="text-transform: uppercase; letter-spacing: 1px;">Subtotal</span>
                                <span>${W}</span>
                            </div>
                            <div style="height: 2px; background: ${l}; margin: 6px 0;"></div>
                            <div style="display: flex; justify-content: space-between; align-items: center; background: ${l}; color: white; padding: 12px 18px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">${p?"TOTAL EGRESO":"TOTAL ABONADO"}</span>
                                <span style="font-size: 18px; font-weight: 900;">${H}</span>
                            </div>

                            ${Y?`
                                <div style="height: 1px; border-top: 1px dashed #cbd5e1; margin: 12px 0 6px 0;"></div>

                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Plan de Trat.:</span>
                                    <span style="font-weight: 800; text-transform: uppercase; text-align: right;" title="${f||"Tratamiento"}">${f||"Tratamiento"}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Total plan:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(s).toLocaleString("es-CO")}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #10b981; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Total pagado:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(c||0).toLocaleString("es-CO")}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #ef4444; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Saldo restante:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(g||0).toLocaleString("es-CO")}</span>
                                </div>
                            `:""}
                        </div>
                    </div>

                    <!-- SIGNATURE BLOCK -->
                    <div style="margin-top: 80px; display: flex; justify-content: space-between; gap: 80px; padding: 0 30px;">
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Elaborado por</p>
                            <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${t.registradoPor&&!t.registradoPor.includes("@")?t.registradoPor:(n==null?void 0:n.nombreCompleto)||(n==null?void 0:n.nombre)||"Cajero / Auxiliar"}</p>
                        </div>
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">${p?"Recibido / Beneficiario":"Aceptado por el Paciente"}</p>
                            <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Firma y Cédula / Sello</p>
                        </div>
                    </div>
                </div>
            `;i.innerHTML=Z,document.body.appendChild(i);const tt=i.querySelectorAll("img");await Promise.all(Array.from(tt).map(e=>e.complete?Promise.resolve():new Promise(r=>{e.onload=r,e.onerror=r})));const h=await at(i,{scale:2.5,useCORS:!0,logging:!1,backgroundColor:"#ffffff",windowWidth:850}),u=new rt({orientation:"portrait",unit:"pt",format:"a4"}),et=h.toDataURL("image/jpeg",.95),L=u.internal.pageSize.getWidth(),ot=h.height*L/h.width;u.addImage(et,"JPEG",0,0,L,ot,void 0,"FAST");const nt=u.output("bloburl");window.open(nt,"_blank"),document.body.removeChild(i),d.dismiss($),d.success("Recibo de caja generado correctamente")}catch(s){console.error("Error generating receipt PDF:",s),d.dismiss($),d.error("Error al generar el recibo de caja en PDF")}}};export{ct as R};
