import{o as e}from"./rolldown-runtime-C0FnF6B9.js";import{D as t,b as n}from"./vendor-BuK9oQ-q.js";import{t as r}from"./supabaseClient-CYUkZD2c.js";import{i,r as a}from"./index-BbpXE6Ax.js";var o=e(i()),s={generatePDF:async(e,i,s,c)=>{if(!e||!i||!s){console.error(`Missing data for PDF generation:`,{pago:e,patient:i,clinic:s}),t.error(`Datos insuficientes para generar el recibo`);return}let l=t.loading(`Generando recibo de caja...`);try{let u=null,d=null,f=null,p=e.planTitle,m=e.planId||e.plan_id,h=i.id||e.pacienteId||e.paciente_id;if(m)try{let{data:e}=await r.from(`treatment_plans`).select(`*`).eq(`id`,m).maybeSingle();if(e){p=e.title||e.nombre||p||`Tratamiento Odontológico`,u=Number(e.total||0);let{data:t}=await r.from(`pagos`).select(`*`).eq(`planId`,m);d=(t||[]).reduce((e,t)=>e+Number(t.monto||0),0),f=Math.max(0,u-d)}}catch{}else if(h&&e.tipo!==`egreso`)try{let{data:e}=await r.from(`treatment_plans`).select(`*`).eq(`paciente_id`,h).order(`created_at`,{ascending:!1}).limit(1);if(e&&e.length>0){let t=e[0];p=t.title||t.nombre||`Tratamiento Odontológico`,u=Number(t.total||0);let{data:n}=await r.from(`pagos`).select(`*`).eq(`pacienteId`,h);d=(n||[]).reduce((e,t)=>e+Number(t.monto||0),0),f=Math.max(0,u-d)}}catch{}let g=document.createElement(`div`);g.style.position=`absolute`,g.style.left=`-9999px`,g.style.top=`0`,g.style.width=`850px`,g.style.padding=`40px`,g.style.backgroundColor=`white`,g.style.color=`#1e293b`,g.style.fontFamily=`'Inter', system-ui, -apple-system, sans-serif`;let _=s.inquilino||c?.inquilino||``,v=``,y=``,b=``,x=``,S=``,C=``;if(_)try{let{data:e}=await r.from(`tenants`).select(`*`).eq(`id`,_).maybeSingle();e&&(v=e.logo||e.logo_url||e.logoUrl||``,y=e.nombre_comercial||e.nombreComercial||e.name||e.nombre||``,b=e.nit||``,x=e.address||e.direccion||``,S=e.phone||e.telefono||``,C=e.email||``)}catch(e){console.error(`Error loading tenant config for print:`,e)}let w=v||s.logo||s.logoUrl||``,T=y||s.nombreComercial||s.nombre||`Clínica Dental`,E=b||s.nit||`—`,D=x||s.direccion||`—`,O=S||s.telefono||`—`,k=C||s.email||``,ee=i.nombreCompleto||`${i.nombres||i.nombre||``} ${i.apellidos||i.apellido||``}`.trim()||i.displayName||e.pacienteNombre||e.patientNombre||`Paciente`,A=i.documento||i.nroDocumento||i.numero_documento||i.nro_documento||i.identificacion||i.cedula||i.docNumber||e.pacienteDocumento||e.documento||e.patientDoc||`—`,j=i.tipoDocumento||i.tipo_documento||i.tipoDoc||e.tipoDocumento||`CC`,M=i.direccion||i.direccionDomicilio||i.lugarResidencia||i.address||`—`,N=i.ciudadDomicilio||i.ciudad||i.municipio||s.ciudad||`Sincelejo`,P=i.celular||i.telefono||i.phone||i.movil||`—`,F=String(e.nroConsecutivo||``).trim();F.startsWith(`No.`)&&(F=F.replace(/^No\.\s*/i,``));let I=F||`S/N`,L=(e.fecha?e.fecha.toDate?e.fecha.toDate():new Date(e.fecha):new Date).toLocaleDateString(`es-CO`,{day:`numeric`,month:`long`,year:`numeric`}),R=`$ ${Number(e.monto||0).toLocaleString(`es-CO`)}`,z=`$ ${Number(e.monto||0).toLocaleString(`es-CO`)}`,B=e.concepto||`Abono a tratamiento`,V=e.notas||`Abono de tratamiento`,H=e.tipo===`egreso`,U=!H&&typeof u==`number`&&u>0,W=H?`#dc2626`:`#2563eb`,G=H?`#fef2f2`:`#eff6ff`,K=H?`#fca5a5`:`#dbeafe`,q=e.documentTitle||(H?`Comprobante de Egreso`:`Recibo de Caja`),J=`
                <div style="border: 1px solid #e2e8f0; padding: 40px; border-radius: 24px; position: relative; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    <!-- Top accent bar -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background-color: ${W}; border-top-left-radius: 24px; border-top-right-radius: 24px;"></div>

                    <!-- Unified Premium Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid ${W}; padding-bottom: 25px; margin-bottom: 30px; margin-top: 15px;">
                        <div style="display: flex; gap: 25px; align-items: center;">
                            ${w?`<img src="${w}" style="max-height: 75px; max-width: 165px; object-fit: contain;" crossorigin="anonymous" />`:`<div style="width: 80px; height: 80px; background: ${W}; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 900; text-transform: uppercase;">${T.substring(0,1)||`O`}</div>`}
                            <div>
                                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -1px;">${T}</h1>
                                <p style="margin: 4px 0; font-size: 13px; color: #475569; font-weight: 800;">NIT: ${E}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500;">${D}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500;">TEL: ${O} | ${k}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${G}; padding: 12px 20px; border-radius: 16px; border: 2px solid ${K}; margin-bottom: 8px; display: inline-block;">
                                <span style="font-size: 16px; font-weight: 900; color: ${W}; text-transform: uppercase; letter-spacing: 0.5px;">${q}</span>
                            </div>
                            <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 900; text-transform: uppercase;">FECHA DE EMISIÓN: ${L}</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 900; color: ${W}; font-family: monospace;">NRO: ${I}</p>
                        </div>
                    </div>

                    <!-- CUSTOMER / BENEFICIARY INFO CARD -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 25px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
                        <div style="border-right: 1px solid #cbd5e1; padding-right: 20px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                                ${H?`Beneficiario / Proveedor / Tercero`:`Información del Paciente`}
                            </span>
                            <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">${ee}</h2>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 10px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">ID / DOC:</strong> ${j.toUpperCase()} ${A}</p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Dirección:</strong> ${M} (${N})</p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Celular:</strong> ${P}</p>
                            </div>
                        </div>
                        <div style="padding-left: 10px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                                ${H?`Detalles del Egreso`:`Detalles del Recibo`}
                            </span>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Medio de Pago:</strong> <span style="text-transform: uppercase;">${e.medio||e.metodo||e.metodo_pago||e.medioPago||`Efectivo`}</span></p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Elaborado por:</strong> <span style="text-transform: uppercase;">${e.registradoPor&&!e.registradoPor.includes(`@`)?e.registradoPor:c?.nombreCompleto||c?.nombre||`Guillermo Rodríguez`}</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- ITEMS DETAIL TABLE -->
                    <div style="margin-bottom: 30px;">
                        <table style="width: 100%; border-collapse: collapse; border-radius: 16px; overflow: hidden; border-style: hidden; box-shadow: 0 0 0 1px #e2e8f0;">
                            <thead>
                                <tr style="background: ${W}; color: white;">
                                    <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Concepto</th>
                                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 120px;">Precio Unitario</th>
                                    <th style="padding: 12px 15px; text-align: center; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 70px;">Cantidad</th>
                                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 130px;">Total</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 12px; color: #334155; font-weight: 600;">
                                ${e.itemPayments&&e.itemPayments.length>0?e.itemPayments.map((e,t)=>`
                                    <tr style="background: ${t%2==0?`#ffffff`:`#f8fafc`}; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 15px; font-weight: 800; text-transform: uppercase;">${e.desc}</td>
                                        <td style="padding: 12px 15px; text-align: right; font-family: monospace;">$ ${Number(e.monto).toLocaleString(`es-CO`)}</td>
                                        <td style="padding: 12px 15px; text-align: center; font-weight: 900;">1</td>
                                        <td style="padding: 12px 15px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">$ ${Number(e.monto).toLocaleString(`es-CO`)}</td>
                                    </tr>
                                `).join(``):`
                                    <tr style="background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 14px 15px; font-weight: 800; text-transform: uppercase;">${B}</td>
                                        <td style="padding: 14px 15px; text-align: right; font-family: monospace;">$ ${Number(e.monto||0).toLocaleString(`es-CO`)}</td>
                                        <td style="padding: 14px 15px; text-align: center; font-weight: 900;">1</td>
                                        <td style="padding: 14px 15px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">$ ${Number(e.monto||0).toLocaleString(`es-CO`)}</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- OBS & TOTALS ROW -->
                    <div style="display: flex; justify-content: space-between; gap: 40px; margin-bottom: 60px; align-items: flex-start;">
                        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 20px; padding: 20px; background-color: #f8fafc; font-size: 11px; line-height: 1.6;">
                            <span style="font-weight: 900; color: #475569; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 8px;">Observaciones:</span>
                            <div style="font-weight: 500; color: #334155; white-space: pre-wrap;">${V}</div>
                        </div>
                        <div style="width: 280px; display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #64748b; padding: 0 4px;">
                                <span style="text-transform: uppercase; letter-spacing: 1px;">Subtotal</span>
                                <span>${R}</span>
                            </div>
                            <div style="height: 2px; background: ${W}; margin: 6px 0;"></div>
                            <div style="display: flex; justify-content: space-between; align-items: center; background: ${W}; color: white; padding: 12px 18px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">${H?`TOTAL EGRESO`:`TOTAL ABONADO`}</span>
                                <span style="font-size: 18px; font-weight: 900;">${z}</span>
                            </div>

                            ${U?`
                                <div style="height: 1px; border-top: 1px dashed #cbd5e1; margin: 12px 0 6px 0;"></div>

                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Plan de Trat.:</span>
                                    <span style="font-weight: 800; text-transform: uppercase; text-align: right;" title="${p||`Tratamiento`}">${p||`Tratamiento`}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Total plan:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(u).toLocaleString(`es-CO`)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #10b981; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Total pagado:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(d||0).toLocaleString(`es-CO`)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #ef4444; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Saldo restante:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(f||0).toLocaleString(`es-CO`)}</span>
                                </div>
                            `:``}
                        </div>
                    </div>

                    <!-- SIGNATURE BLOCK -->
                    <div style="margin-top: 80px; display: flex; justify-content: space-between; gap: 80px; padding: 0 30px;">
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Elaborado por</p>
                            <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${e.registradoPor&&!e.registradoPor.includes(`@`)?e.registradoPor:c?.nombreCompleto||c?.nombre||`Cajero / Auxiliar`}</p>
                        </div>
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">${H?`Recibido / Beneficiario`:`Aceptado por el Paciente`}</p>
                            <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Firma y Cédula / Sello</p>
                        </div>
                    </div>
                </div>
            `;g.innerHTML=n.sanitize(J),document.body.appendChild(g);let Y=g.querySelectorAll(`img`);await Promise.all(Array.from(Y).map(e=>e.complete?Promise.resolve():new Promise(t=>{e.onload=t,e.onerror=t})));let X=await(0,o.default)(g,{scale:2.5,useCORS:!0,logging:!1,backgroundColor:`#ffffff`,windowWidth:850}),Z=new a({orientation:`portrait`,unit:`pt`,format:`a4`}),Q=X.toDataURL(`image/jpeg`,.95),$=Z.internal.pageSize.getWidth(),te=X.height*$/X.width;Z.addImage(Q,`JPEG`,0,0,$,te,void 0,`FAST`);let ne=Z.output(`bloburl`);window.open(ne,`_blank`),document.body.removeChild(g),t.dismiss(l),t.success(`Recibo de caja generado correctamente`)}catch(e){console.error(`Error generating receipt PDF:`,e),t.dismiss(l),t.error(`Error al generar el recibo de caja en PDF`)}}};export{s as t};