import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import supabase from "../lib/supabaseClient";

export const ReceiptPrintService = {
    generatePDF: async (pago, patient, clinic, userProfile) => {
        if (!pago || !patient || !clinic) {
            console.error("Missing data for PDF generation:", { pago, patient, clinic });
            toast.error("Datos insuficientes para generar el documento");
            return;
        }

        // Parse metadata if notas is stored in JSON format
        let parsedMetadata = null;
        if (typeof pago.notas === "string" && pago.notas.trim().startsWith("{")) {
            try {
                parsedMetadata = JSON.parse(pago.notas);
            } catch (_) {}
        } else if (pago.notas && typeof pago.notas === "object") {
            parsedMetadata = pago.notas;
        }

        // Detect document type
        const isConsumoSaldo = 
            pago.documentTitle?.toLowerCase().includes("consumo") ||
            pago.tipoDocumento === "Consumo Saldo a Favor" ||
            pago.tipoDoc === "Uso de saldo a favor" ||
            pago.tipoDoc === "Consumo Saldo a Favor" ||
            parsedMetadata?.tipoDoc === "Uso de saldo a favor" ||
            parsedMetadata?.tipoDoc === "Consumo Saldo a Favor" ||
            String(pago.metodo || pago.medio || pago.medio_pago || "").toLowerCase() === "saldo a favor" ||
            String(pago.referencia || "").toUpperCase().includes("USO SALDO A FAVOR") ||
            String(pago.concepto || "").toUpperCase().includes("CONSUMO SALDO A FAVOR") ||
            String(pago.concepto || "").toUpperCase().includes("USO DE SALDO A FAVOR");

        const isEgreso = !isConsumoSaldo && (pago.tipo === "egreso" || (pago.tipoDoc && pago.tipoDoc.toLowerCase().includes("egreso")));

        let documentTitle = pago.documentTitle;
        if (!documentTitle) {
            if (isConsumoSaldo) {
                documentTitle = "CONSUMO SALDO A FAVOR";
            } else if (isEgreso) {
                documentTitle = "Comprobante de Egreso";
            } else {
                documentTitle = "Recibo de Caja";
            }
        }

        const toastId = toast.loading(isConsumoSaldo ? "Generando comprobante..." : (isEgreso ? "Generando comprobante de egreso..." : "Generando recibo de caja..."));

        try {
            // Fetch plan details dynamically if planId is present or query patient's active plan
            let totalPlan = null;
            let totalPagadoPlan = null;
            let saldoPlan = null;
            let planTitle = pago.planTitle || parsedMetadata?.planTitle;

            const targetPlanId = pago.planId || pago.plan_id || parsedMetadata?.planId;
            const targetPatientId = patient.id || pago.pacienteId || pago.paciente_id;

            if (targetPlanId) {
                try {
                    const { data: planData } = await supabase
                        .from("treatment_plans")
                        .select("*")
                        .eq("id", targetPlanId)
                        .maybeSingle();
                    if (planData) {
                        planTitle = planData.title || planData.nombre || planTitle || "Tratamiento Odontológico";
                        totalPlan = Number(planData.total || 0);
                        
                        const { data: allPayments } = await supabase
                            .from("pagos")
                            .select("*")
                            .eq("planId", targetPlanId);
                        totalPagadoPlan = (allPayments || []).reduce((sum, p) => sum + Number(p.monto || 0), 0);
                        saldoPlan = Math.max(0, totalPlan - totalPagadoPlan);
                    }
                } catch (e) {}
            } else if (targetPatientId && !isEgreso) {
                try {
                    const { data: pPlans } = await supabase
                        .from("treatment_plans")
                        .select("*")
                        .eq("paciente_id", targetPatientId)
                        .order("created_at", { ascending: false })
                        .limit(1);
                    if (pPlans && pPlans.length > 0) {
                        const planData = pPlans[0];
                        planTitle = planData.title || planData.nombre || "Tratamiento Odontológico";
                        totalPlan = Number(planData.total || 0);
                        const { data: allPayments } = await supabase
                            .from("pagos")
                            .select("*")
                            .eq("pacienteId", targetPatientId);
                        totalPagadoPlan = (allPayments || []).reduce((sum, p) => sum + Number(p.monto || 0), 0);
                        saldoPlan = Math.max(0, totalPlan - totalPagadoPlan);
                    }
                } catch (e) {}
            }

            // Extract pure user observation (never dump JSON or generic boilerplate)
            let rawObs = "";
            if (parsedMetadata) {
                rawObs = parsedMetadata.observaciones || parsedMetadata.observacion || parsedMetadata.notes || "";
            } else if (typeof pago.notas === "string" && !pago.notas.trim().startsWith("{")) {
                rawObs = pago.notas;
            } else if (pago.observaciones) {
                rawObs = pago.observaciones;
            }

            let cleanObservations = String(rawObs || "").trim();
            if (cleanObservations.startsWith("{") && cleanObservations.endsWith("}")) {
                try {
                    const testParse = JSON.parse(cleanObservations);
                    cleanObservations = String(testParse.observaciones || testParse.observacion || "").trim();
                } catch (_) {
                    cleanObservations = "";
                }
            }

            const genericDefaults = [
                "abono a tratamiento",
                "abono de tratamiento",
                "saldo a favor",
                "uso de saldo a favor",
                "consumo saldo a favor",
                "devolución saldo a favor",
                "devolucion saldo a favor",
                "recibo de caja"
            ];
            if (genericDefaults.includes(cleanObservations.toLowerCase())) {
                cleanObservations = "";
            }

            const totalBadgeLabel = isConsumoSaldo 
                ? "TOTAL CONSUMIDO" 
                : (isEgreso ? "TOTAL EGRESO" : "TOTAL ABONADO");

            const accentColor = isEgreso ? "#dc2626" : (isConsumoSaldo ? "#0284c7" : "#2563eb");
            const accentBg = isEgreso ? "#fef2f2" : (isConsumoSaldo ? "#f0f9ff" : "#eff6ff");
            const accentBorder = isEgreso ? "#fca5a5" : (isConsumoSaldo ? "#bae6fd" : "#dbeafe");

            // Items resolution
            const rawItems = (pago.itemPayments && pago.itemPayments.length > 0)
                ? pago.itemPayments
                : (parsedMetadata?.itemPayments && parsedMetadata.itemPayments.length > 0)
                    ? parsedMetadata.itemPayments
                    : null;
            
            const conceptStr = pago.concepto || parsedMetadata?.concepto || (isConsumoSaldo ? "Consumo saldo a favor" : (isEgreso ? "Egreso / Pago" : "Abono a tratamiento"));

            // Create hidden container (sized proportionally for Media Carta: 720px width)
            const printElement = document.createElement("div");
            printElement.style.position = "absolute";
            printElement.style.left = "-9999px";
            printElement.style.top = "0";
            printElement.style.width = "720px";
            printElement.style.padding = "14px 18px";
            printElement.style.backgroundColor = "white";
            printElement.style.color = "#1e293b";
            printElement.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";

            // Fetch company configuration (empresa) for actual logo, nit, address, phone etc.
            const tenantId = clinic.inquilino || userProfile?.inquilino || "";
            let dbLogoUrl = "";
            let dbClinicName = "";
            let dbClinicNit = "";
            let dbClinicAddress = "";
            let dbClinicPhone = "";
            let dbClinicEmail = "";

            if (tenantId) {
                try {
                    const { data: clinicConfig } = await supabase
                        .from("tenants")
                        .select("*")
                        .eq("id", tenantId)
                        .maybeSingle();
                    if (clinicConfig) {
                        dbLogoUrl = clinicConfig.logo || clinicConfig.logo_url || clinicConfig.logoUrl || "";
                        dbClinicName = clinicConfig.nombre_comercial || clinicConfig.nombreComercial || clinicConfig.name || clinicConfig.nombre || "";
                        dbClinicNit = clinicConfig.nit || "";
                        dbClinicAddress = clinicConfig.address || clinicConfig.direccion || "";
                        dbClinicPhone = clinicConfig.phone || clinicConfig.telefono || "";
                        dbClinicEmail = clinicConfig.email || "";
                    }
                } catch (err) {
                    console.error("Error loading tenant config for print:", err);
                }
            }

            // Resolve values
            const rawLogoUrl = dbLogoUrl || clinic.logo || clinic.logoUrl || "";
            const logoUrl = rawLogoUrl;
            const clinicName = dbClinicName || clinic.nombreComercial || clinic.nombre || "Clínica Dental";
            const clinicNit = dbClinicNit || clinic.nit || "—";
            const clinicAddress = dbClinicAddress || clinic.direccion || "—";
            const clinicPhone = dbClinicPhone || clinic.telefono || "—";
            const clinicEmail = dbClinicEmail || clinic.email || "";

            const patientName = patient.nombreCompleto || `${patient.nombres || patient.nombre || ''} ${patient.apellidos || patient.apellido || ''}`.trim() || patient.displayName || pago.pacienteNombre || pago.patientNombre || pago.tercero || pago.proveedor || "Paciente / Tercero";
            const patientDoc = patient.documento || patient.nroDocumento || patient.numero_documento || patient.nro_documento || patient.identificacion || patient.cedula || patient.docNumber || pago.pacienteDocumento || pago.documento || pago.patientDoc || pago.documentoTercero || pago.nit || "—";
            const patientDocType = patient.tipoDocumento || patient.tipo_documento || patient.tipoDoc || pago.tipoDocumento || (String(patientDoc).length >= 9 ? "NIT" : "CC");
            const patientAddress = patient.direccion || patient.direccionDomicilio || patient.lugarResidencia || patient.address || pago.direccion || "—";
            const patientCity = patient.ciudadDomicilio || patient.ciudad || patient.municipio || clinic.ciudad || pago.ciudad || "Sincelejo";
            const patientPhone = patient.celular || patient.telefono || patient.phone || patient.movil || pago.telefono || "—";
            
            // Clean consecutive number (avoid "No. No. REC-...")
            let rawConsecutive = String(pago.nroConsecutivo || pago.consecutivo || pago.numero || (pago.id && String(pago.id).replace(/\D/g, "").slice(-4)) || "").trim();
            if (rawConsecutive.startsWith("No.")) {
                rawConsecutive = rawConsecutive.replace(/^No\.\s*/i, "");
            }
            const receiptNumber = rawConsecutive ? rawConsecutive : "S/N";

            const date = pago.fecha ? (pago.fecha.toDate ? pago.fecha.toDate() : new Date(pago.fecha)) : new Date();
            const formattedDate = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

            const subtotalStr = `$ ${Number(pago.monto || 0).toLocaleString('es-CO')}`;
            const totalStr = `$ ${Number(pago.monto || 0).toLocaleString('es-CO')}`;

            const hasPlanInfo = !isEgreso && typeof totalPlan === "number" && totalPlan > 0;

            const html = `
                <div style="border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 14px; position: relative; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);">
                    <!-- Top accent bar -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background-color: ${accentColor}; border-top-left-radius: 14px; border-top-right-radius: 14px;"></div>

                    <!-- Unified Header (OralDrive Media Carta Proportions) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${accentColor}; padding-bottom: 10px; margin-bottom: 12px; margin-top: 2px;">
                        <div style="display: flex; gap: 12px; align-items: center;">
                            ${logoUrl 
                                ? `<img src="${logoUrl}" style="max-height: 46px; max-width: 115px; object-fit: contain;" crossorigin="anonymous" />`
                                : `<div style="width: 44px; height: 44px; background: ${accentColor}; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 900; text-transform: uppercase;">${clinicName.substring(0, 1) || "O"}</div>`
                            }
                            <div>
                                <h1 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.3px;">${clinicName}</h1>
                                <p style="margin: 1px 0; font-size: 9px; color: #475569; font-weight: 800;">NIT: ${clinicNit}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 500;">${clinicAddress} ${clinicCity ? `(${clinicCity})` : ''}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 500;">TEL: ${clinicPhone} ${clinicEmail ? `| ${clinicEmail}` : ''}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${accentBg}; padding: 3px 10px; border-radius: 8px; border: 1.5px solid ${accentBorder}; margin-bottom: 3px; display: inline-block;">
                                <span style="font-size: 11px; font-weight: 800; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.3px;">${documentTitle}</span>
                            </div>
                            <p style="margin: 0; font-size: 8.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">FECHA DE EMISIÓN: ${formattedDate}</p>
                            <p style="margin: 1px 0 0 0; font-size: 11px; font-weight: 800; color: ${accentColor}; font-family: monospace;">NRO: ${receiptNumber}</p>
                        </div>
                    </div>

                    <!-- CUSTOMER / BENEFICIARY INFO CARD -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;">
                        <div style="border-right: 1px solid #cbd5e1; padding-right: 10px;">
                            <span style="font-size: 7px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px;">
                                ${isEgreso ? "Beneficiario / Proveedor / Tercero" : "Información del Paciente"}
                            </span>
                            <h2 style="margin: 0; font-size: 11.5px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.2px;">${patientName}</h2>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5px; margin-top: 3px;">
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">ID / DOC:</strong> ${patientDocType.toUpperCase()} ${patientDoc}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Dirección:</strong> ${patientAddress}</p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Celular:</strong> ${patientPhone}</p>
                            </div>
                        </div>
                        <div style="padding-left: 2px;">
                            <span style="font-size: 7px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px;">
                                ${isEgreso ? "Detalles del Egreso" : "Detalles del Documento"}
                            </span>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 2px; margin-top: 3px;">
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Medio de Pago:</strong> <span style="text-transform: uppercase;">${pago.medio || pago.metodo || pago.metodo_pago || pago.medioPago || (isConsumoSaldo ? "Saldo a favor" : "Efectivo")}</span></p>
                                <p style="margin: 0; font-size: 8.5px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 7.5px; text-transform: uppercase; margin-right: 3px;">Elaborado por:</strong> <span style="text-transform: uppercase;">${(pago.registradoPor && !pago.registradoPor.includes('@')) ? pago.registradoPor : (userProfile?.nombreCompleto || userProfile?.nombre || "Cajero")}</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- ITEMS DETAIL TABLE (Compact Media Carta) -->
                    <div style="margin-bottom: 10px;">
                        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border-style: hidden; box-shadow: 0 0 0 1px #e2e8f0;">
                            <thead>
                                <tr style="background: ${accentColor}; color: white;">
                                    <th style="padding: 5px 8px; text-align: left; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Concepto</th>
                                    <th style="padding: 5px 8px; text-align: right; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 90px;">Precio Unitario</th>
                                    <th style="padding: 5px 8px; text-align: center; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 45px;">Cant.</th>
                                    <th style="padding: 5px 8px; text-align: right; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 100px;">Total</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 9px; color: #334155; font-weight: 600;">
                                ${rawItems && rawItems.length > 0 ? rawItems.map((ip, index) => `
                                    <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 5px 8px; font-weight: 700; text-transform: uppercase;">${ip.desc}</td>
                                        <td style="padding: 5px 8px; text-align: right; font-family: monospace;">$ ${Number(ip.monto).toLocaleString('es-CO')}</td>
                                        <td style="padding: 5px 8px; text-align: center; font-weight: 800;">1</td>
                                        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">$ ${Number(ip.monto).toLocaleString('es-CO')}</td>
                                    </tr>
                                `).join('') : `
                                    <tr style="background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 6px 8px; font-weight: 700; text-transform: uppercase;">${conceptStr}</td>
                                        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">$ ${Number(pago.monto || 0).toLocaleString('es-CO')}</td>
                                        <td style="padding: 6px 8px; text-align: center; font-weight: 800;">1</td>
                                        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">$ ${Number(pago.monto || 0).toLocaleString('es-CO')}</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- OBS & TOTALS ROW -->
                    <div style="display: flex; justify-content: space-between; gap: 14px; margin-bottom: 14px; align-items: flex-start;">
                        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 6px 10px; background-color: #f8fafc; font-size: 8.5px; line-height: 1.35; min-height: 38px;">
                            <span style="font-weight: 800; color: #475569; text-transform: uppercase; font-size: 7px; display: block; margin-bottom: 2px;">Observaciones:</span>
                            <div style="font-weight: 500; color: #334155; white-space: pre-wrap;">${cleanObservations}</div>
                        </div>
                        <div style="width: 220px; display: flex; flex-direction: column; gap: 2px;">
                            <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #64748b; padding: 0 4px;">
                                <span style="text-transform: uppercase; letter-spacing: 0.5px;">Subtotal</span>
                                <span>${subtotalStr}</span>
                            </div>
                            <div style="height: 1px; background: ${accentColor}; margin: 2px 0;"></div>
                            <div style="display: flex; justify-content: space-between; align-items: center; background: ${accentColor}; color: white; padding: 6px 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
                                <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${totalBadgeLabel}</span>
                                <span style="font-size: 13.5px; font-weight: 900;">${totalStr}</span>
                            </div>

                            ${hasPlanInfo ? `
                                <div style="height: 1px; border-top: 1px dashed #cbd5e1; margin: 4px 0 2px 0;"></div>

                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Plan de Trat.:</span>
                                    <span style="font-weight: 800; text-transform: uppercase; text-align: right;" title="${planTitle || 'Tratamiento'}">${planTitle || 'Tratamiento'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Total plan:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(totalPlan).toLocaleString('es-CO')}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #10b981; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Total pagado:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(totalPagadoPlan || 0).toLocaleString('es-CO')}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #ef4444; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 6.5px;">Saldo restante:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(saldoPlan || 0).toLocaleString('es-CO')}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- SIGNATURE BLOCK (Compact Media Carta) -->
                    <div style="margin-top: 18px; display: flex; justify-content: space-between; gap: 30px; padding: 0 16px;">
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center;">
                            <p style="margin: 0; font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Elaborado por</p>
                            <p style="margin: 1px 0; font-size: 7.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${(pago.registradoPor && !pago.registradoPor.includes('@')) ? pago.registradoPor : (userProfile?.nombreCompleto || userProfile?.nombre || "Cajero / Auxiliar")}</p>
                        </div>
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center;">
                            <p style="margin: 0; font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${isEgreso ? "Recibido / Beneficiario" : "Aceptado por el Paciente"}</p>
                            <p style="margin: 1px 0; font-size: 7.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Firma y Cédula / Sello</p>
                        </div>
                    </div>
                </div>
            `;

            printElement.innerHTML = DOMPurify.sanitize(html);
            document.body.appendChild(printElement);

            // Wait for all images to load before rendering canvas
            const images = printElement.querySelectorAll("img");
            await Promise.all(Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            // Generate image with high quality
            const canvas = await html2canvas(printElement, {
                scale: 2.5,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                windowWidth: 720
            });

            // Standard Letter page (612 x 792 pt), drawn cleanly on the TOP HALF (Media Carta)
            // Exactly matching OralDrive's "Recibo Carta" format!
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'letter'
            });

            pdf.setProperties({
                title: isConsumoSaldo ? "Consumo Saldo a Favor" : (isEgreso ? "Comprobante de Egreso" : "Recibo de Caja")
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pageWidth = pdf.internal.pageSize.getWidth(); // 612 pt

            // Render width 560 pt leaves ~26 pt margins on left/right
            const renderWidth = 560;
            const imgRatio = canvas.width / canvas.height;
            const renderHeight = renderWidth / imgRatio;

            const posX = (pageWidth - renderWidth) / 2;
            const posY = 24; // Top margin (occupies upper ~340-360 pt, well below the 396 pt half-sheet line)

            pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');
            
            const pdfBlob = pdf.output('bloburl');
            window.open(pdfBlob, '_blank');

            document.body.removeChild(printElement);
            toast.dismiss(toastId);
            toast.success("Documento generado correctamente");

        } catch (error) {
            console.error("Error generating receipt PDF:", error);
            toast.dismiss(toastId);
            toast.error("Error al generar el documento en PDF");
        }
    }
};
