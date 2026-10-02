import{o as e}from"./rolldown-runtime-C0FnF6B9.js";import{j as t,x as n}from"./vendor-ChJqG-e5.js";import{t as r}from"./supabaseClient-yKLA9fFt.js";import{i,r as ee}from"./index-T8qv0Yr6.js";var a=e(i()),o={generatePDF:async(e,i,o,s)=>{if(!e||!i||!o){console.error(`Missing data for PDF generation:`,{pago:e,patient:i,clinic:o}),t.error(`Datos insuficientes para generar el documento`);return}let c=null;if(typeof e.notas==`string`&&e.notas.trim().startsWith(`{`))try{c=JSON.parse(e.notas)}catch{}else e.notas&&typeof e.notas==`object`&&(c=e.notas);let l=e.documentTitle?.toLowerCase().includes(`consumo`)||e.tipoDocumento===`Consumo Saldo a Favor`||e.tipoDoc===`Uso de saldo a favor`||e.tipoDoc===`Consumo Saldo a Favor`||c?.tipoDoc===`Uso de saldo a favor`||c?.tipoDoc===`Consumo Saldo a Favor`||String(e.metodo||e.medio||e.medio_pago||``).toLowerCase()===`saldo a favor`||String(e.referencia||``).toUpperCase().includes(`USO SALDO A FAVOR`)||String(e.concepto||``).toUpperCase().includes(`CONSUMO SALDO A FAVOR`)||String(e.concepto||``).toUpperCase().includes(`USO DE SALDO A FAVOR`),u=!l&&(e.tipo===`egreso`||e.tipoDoc&&e.tipoDoc.toLowerCase().includes(`egreso`)),d=e.documentTitle;d||=l?`CONSUMO SALDO A FAVOR`:u?`Comprobante de Egreso`:`Recibo de Caja`;let f=t.loading(l?`Generando comprobante...`:u?`Generando comprobante de egreso...`:`Generando recibo de caja...`);try{let p=null,m=null,h=null,g=e.planTitle||c?.planTitle,_=e.planId||e.plan_id||c?.planId,v=i.id||e.pacienteId||e.paciente_id;if(_)try{let{data:e}=await r.from(`treatment_plans`).select(`*`).eq(`id`,_).maybeSingle();if(e){g=e.title||e.nombre||g||`Tratamiento Odontológico`,p=Number(e.total||0);let{data:t}=await r.from(`pagos`).select(`*`).eq(`planId`,_);m=(t||[]).reduce((e,t)=>e+Number(t.monto||0),0),h=Math.max(0,p-m)}}catch{}else if(v&&!u)try{let{data:e}=await r.from(`treatment_plans`).select(`*`).eq(`paciente_id`,v).order(`created_at`,{ascending:!1}).limit(1);if(e&&e.length>0){let t=e[0];g=t.title||t.nombre||`Tratamiento Odontológico`,p=Number(t.total||0);let{data:n}=await r.from(`pagos`).select(`*`).eq(`pacienteId`,v);m=(n||[]).reduce((e,t)=>e+Number(t.monto||0),0),h=Math.max(0,p-m)}}catch{}let y=``;c?y=c.observaciones||c.observacion||c.notes||``:typeof e.notas==`string`&&!e.notas.trim().startsWith(`{`)?y=e.notas:e.observaciones&&(y=e.observaciones);let b=String(y||``).trim();if(b.startsWith(`{`)&&b.endsWith(`}`))try{let e=JSON.parse(b);b=String(e.observaciones||e.observacion||``).trim()}catch{b=``}[`abono a tratamiento`,`abono de tratamiento`,`saldo a favor`,`uso de saldo a favor`,`consumo saldo a favor`,`devolución saldo a favor`,`devolucion saldo a favor`,`recibo de caja`].includes(b.toLowerCase())&&(b=``);let x=l?`TOTAL CONSUMIDO`:u?`TOTAL EGRESO`:`TOTAL ABONADO`,S=u?`#dc2626`:l?`#0284c7`:`#2563eb`,C=u?`#fef2f2`:l?`#f0f9ff`:`#eff6ff`,te=u?`#fca5a5`:l?`#bae6fd`:`#dbeafe`,w=e.itemPayments&&e.itemPayments.length>0?e.itemPayments:c?.itemPayments&&c.itemPayments.length>0?c.itemPayments:null,T=e.concepto||c?.concepto||(l?`Consumo saldo a favor`:u?`Egreso / Pago`:`Abono a tratamiento`),E=document.createElement(`div`);E.style.position=`absolute`,E.style.left=`-9999px`,E.style.top=`0`,E.style.width=`720px`,E.style.padding=`14px 18px`,E.style.backgroundColor=`white`,E.style.color=`#1e293b`,E.style.fontFamily=`'Inter', system-ui, -apple-system, sans-serif`;let D=o.inquilino||s?.inquilino||``,O=``,k=``,A=``,j=``,M=``,N=``;if(D)try{let{data:e}=await r.from(`tenants`).select(`*`).eq(`id`,D).maybeSingle();e&&(O=e.logo||e.logo_url||e.logoUrl||``,k=e.nombre_comercial||e.nombreComercial||e.name||e.nombre||``,A=e.nit||``,j=e.address||e.direccion||``,M=e.phone||e.telefono||``,N=e.email||``)}catch(e){console.error(`Error loading tenant config for print:`,e)}let P=O||o.logo||o.logoUrl||``,F=k||o.nombreComercial||o.nombre||`Clínica Dental`,ne=A||o.nit||`—`,I=j||o.direccion||`—`,L=M||o.telefono||`—`,R=N||o.email||``,z=i.nombreCompleto||`${i.nombres||i.nombre||``} ${i.apellidos||i.apellido||``}`.trim()||i.displayName||e.pacienteNombre||e.patientNombre||e.tercero||e.proveedor||`Paciente / Tercero`,B=i.documento||i.nroDocumento||i.numero_documento||i.nro_documento||i.identificacion||i.cedula||i.docNumber||e.pacienteDocumento||e.documento||e.patientDoc||e.documentoTercero||e.nit||`—`,V=i.tipoDocumento||i.tipo_documento||i.tipoDoc||e.tipoDocumento||(String(B).length>=9?`NIT`:`CC`),H=i.direccion||i.direccionDomicilio||i.lugarResidencia||i.address||e.direccion||`—`;i.ciudadDomicilio||i.ciudad||i.municipio||o.ciudad||e.ciudad;let U=i.celular||i.telefono||i.phone||i.movil||e.telefono||`—`,W=String(e.nroConsecutivo||e.consecutivo||e.numero||e.id&&String(e.id).replace(/\D/g,``).slice(-4)||``).trim();W.startsWith(`No.`)&&(W=W.replace(/^No\.\s*/i,``));let G=W||`S/N`,K=(e.fecha?e.fecha.toDate?e.fecha.toDate():new Date(e.fecha):new Date).toLocaleDateString(`es-CO`,{day:`numeric`,month:`long`,year:`numeric`}),q=`$ ${Number(e.monto||0).toLocaleString(`es-CO`)}`,J=`$ ${Number(e.monto||0).toLocaleString(`es-CO`)}`,Y=!u&&typeof p==`number`&&p>0,X=`
                <div style="border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 14px; position: relative; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);">
                    <!-- Top accent bar -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background-color: ${S}; border-top-left-radius: 14px; border-top-right-radius: 14px;"></div>

                    <!-- Unified Header (OralDrive Media Carta Proportions) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${S}; padding-bottom: 10px; margin-bottom: 12px; margin-top: 2px;">
                        <div style="display: flex; gap: 12px; align-items: center;">
                            ${P?`<img src="${P}" style="max-height: 46px; max-width: 115px; object-fit: contain;" crossorigin="anonymous" />`:`<div style="width: 44px; height: 44px; background: ${S}; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 900; text-transform: uppercase;">${F.substring(0,1)||`O`}</div>`}
                            <div>
                                <h1 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.3px;">${F}</h1>
                                <p style="margin: 1px 0; font-size: 9px; color: #475569; font-weight: 800;">NIT: ${ne}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 500;">${I} ${clinicCity?`(${clinicCity})`:``}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 500;">TEL: ${L} ${R?`| ${R}`:``}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${C}; padding: 3px 10px; border-radius: 8px; border: 1.5px solid ${te}; margin-bottom: 3px; display: inline-block;">
                                <span style="font-size: 11px; font-weight: 800; color: ${S}; text-transform: uppercase; letter-spacing: 0.3px;">${d}</span>
                            </div>
                            <p style="margin: 0; font-size: 8.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">FECHA DE EMISIÓN: ${K}</p>
                            <p style="margin: 1px 0 0 0; font-size: 11px; font-weight: 800; color: ${S}; font-family: monospace;">NRO: ${G}</p>
                        </div>
                    </div>

                    <!-- CUSTOMER / BENEFICIARY INFO CARD -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;">
                        <div style="border-right: 1px solid #cbd5e1; padding-right: 10px;">
                            <span style="font-size: 7px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px;">
                                ${u?`Beneficiario / Proveedor / Tercero`:`Información del Paciente`}
                            </span>
                            <h2 style="margin: 0; font-size: 11.5px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.2px;">${z}</h2>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5px; margin-top: 3px;">
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">ID / DOC:</strong> ${V.toUpperCase()} ${B}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Dirección:</strong> ${H}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Celular:</strong> ${U}</p>
                            </div>
                        </div>
                        <div style="padding-left: 2px;">
                            <span style="font-size: 7px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px;">
                                ${u?`Detalles del Egreso`:`Detalles del Documento`}
                            </span>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 2px; margin-top: 3px;">
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Medio de Pago:</strong> <span style="text-transform: uppercase;">${e.medio||e.metodo||e.metodo_pago||e.medioPago||(l?`Saldo a favor`:`Efectivo`)}</span></p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Elaborado por:</strong> <span style="text-transform: uppercase;">${e.registradoPor&&!e.registradoPor.includes(`@`)?e.registradoPor:s?.nombreCompleto||s?.nombre||`Cajero`}</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- ITEMS DETAIL TABLE (Compact Media Carta) -->
                    <div style="margin-bottom: 10px;">
                        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border-style: hidden; box-shadow: 0 0 0 1px #e2e8f0;">
                            <thead>
                                <tr style="background: ${S}; color: white;">
                                    <th style="padding: 5px 8px; text-align: left; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Concepto</th>
                                    <th style="padding: 5px 8px; text-align: right; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 90px;">Precio Unitario</th>
                                    <th style="padding: 5px 8px; text-align: center; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 45px;">Cant.</th>
                                    <th style="padding: 5px 8px; text-align: right; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 100px;">Total</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 9px; color: #334155; font-weight: 600;">
                                ${w&&w.length>0?w.map((e,t)=>`
                                    <tr style="background: ${t%2==0?`#ffffff`:`#f8fafc`}; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 5px 8px; font-weight: 700; text-transform: uppercase;">${e.desc}</td>
                                        <td style="padding: 5px 8px; text-align: right; font-family: monospace;">$ ${Number(e.monto).toLocaleString(`es-CO`)}</td>
                                        <td style="padding: 5px 8px; text-align: center; font-weight: 800;">1</td>
                                        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">$ ${Number(e.monto).toLocaleString(`es-CO`)}</td>
                                    </tr>
                                `).join(``):`
                                    <tr style="background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 6px 8px; font-weight: 700; text-transform: uppercase;">${T}</td>
                                        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">$ ${Number(e.monto||0).toLocaleString(`es-CO`)}</td>
                                        <td style="padding: 6px 8px; text-align: center; font-weight: 800;">1</td>
                                        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">$ ${Number(e.monto||0).toLocaleString(`es-CO`)}</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- OBS & TOTALS ROW -->
                    <div style="display: flex; justify-content: space-between; gap: 14px; margin-bottom: 14px; align-items: flex-start;">
                        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 6px 10px; background-color: #f8fafc; font-size: 8.5px; line-height: 1.35; min-height: 38px;">
                            <span style="font-weight: 800; color: #475569; text-transform: uppercase; font-size: 7px; display: block; margin-bottom: 2px;">Observaciones:</span>
                            <div style="font-weight: 500; color: #334155; white-space: pre-wrap;">${b}</div>
                        </div>
                        <div style="width: 220px; display: flex; flex-direction: column; gap: 2px;">
                            <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #64748b; padding: 0 4px;">
                                <span style="text-transform: uppercase; letter-spacing: 0.5px;">Subtotal</span>
                                <span>${q}</span>
                            </div>
                            <div style="height: 1px; background: ${S}; margin: 2px 0;"></div>
                            <div style="display: flex; justify-content: space-between; align-items: center; background: ${S}; color: white; padding: 6px 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
                                <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${x}</span>
                                <span style="font-size: 13.5px; font-weight: 900;">${J}</span>
                            </div>

                            ${Y?`
                                <div style="height: 1px; border-top: 1px dashed #cbd5e1; margin: 4px 0 2px 0;"></div>

                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Plan de Trat.:</span>
                                    <span style="font-weight: 800; text-transform: uppercase; text-align: right;" title="${g||`Tratamiento`}">${g||`Tratamiento`}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Total plan:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(p).toLocaleString(`es-CO`)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #10b981; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Total pagado:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(m||0).toLocaleString(`es-CO`)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #ef4444; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Saldo restante:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(h||0).toLocaleString(`es-CO`)}</span>
                                </div>
                            `:``}
                        </div>
                    </div>

                    <!-- SIGNATURE BLOCK (Compact Media Carta) -->
                    <div style="margin-top: 18px; display: flex; justify-content: space-between; gap: 30px; padding: 0 16px;">
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center;">
                            <p style="margin: 0; font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Elaborado por</p>
                            <p style="margin: 1px 0; font-size: 7.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${e.registradoPor&&!e.registradoPor.includes(`@`)?e.registradoPor:s?.nombreCompleto||s?.nombre||`Cajero / Auxiliar`}</p>
                        </div>
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center;">
                            <p style="margin: 0; font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${u?`Recibido / Beneficiario`:`Aceptado por el Paciente`}</p>
                            <p style="margin: 1px 0; font-size: 7.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Firma y Cédula / Sello</p>
                        </div>
                    </div>
                </div>
            `;E.innerHTML=n.sanitize(X),document.body.appendChild(E);let Z=E.querySelectorAll(`img`);await Promise.all(Array.from(Z).map(e=>e.complete?Promise.resolve():new Promise(t=>{e.onload=t,e.onerror=t})));let Q=await(0,a.default)(E,{scale:2.5,useCORS:!0,logging:!1,backgroundColor:`#ffffff`,windowWidth:720}),$=new ee({orientation:`portrait`,unit:`pt`,format:`letter`});$.setProperties({title:l?`Consumo Saldo a Favor`:u?`Comprobante de Egreso`:`Recibo de Caja`});let re=Q.toDataURL(`image/jpeg`,.95),ie=$.internal.pageSize.getWidth(),ae=560/(Q.width/Q.height),oe=(ie-560)/2;$.addImage(re,`JPEG`,oe,24,560,ae,void 0,`FAST`);let se=$.output(`bloburl`);window.open(se,`_blank`),document.body.removeChild(E),t.dismiss(f),t.success(`Documento generado correctamente`)}catch(e){console.error(`Error generating receipt PDF:`,e),t.dismiss(f),t.error(`Error al generar el documento en PDF`)}}};export{o as t};