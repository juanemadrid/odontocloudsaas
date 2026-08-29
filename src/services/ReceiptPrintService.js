import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import supabase from "../lib/supabaseClient";

export const ReceiptPrintService = {
    generatePDF: async (pago, patient, clinic, userProfile) => {
        if (!pago || !patient || !clinic) {
            console.error("Missing data for PDF generation:", { pago, patient, clinic });
            toast.error("Datos insuficientes para generar el recibo");
            return;
        }

        const toastId = toast.loading("Generando recibo de caja...");

        try {
            // Fetch plan details dynamically if planId is present or query patient's active plan
            let totalPlan = null;
            let totalPagadoPlan = null;
            let saldoPlan = null;
            let planTitle = pago.planTitle;

            const targetPlanId = pago.planId || pago.plan_id;
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
            } else if (targetPatientId && pago.tipo !== "egreso") {
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

            // Create hidden container
            const printElement = document.createElement("div");
            printElement.style.position = "absolute";
            printElement.style.left = "-9999px";
            printElement.style.top = "0";
            printElement.style.width = "850px"; // Size for A4 portrait
            printElement.style.padding = "40px";
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

            const patientName = patient.nombreCompleto || `${patient.nombres || patient.nombre || ''} ${patient.apellidos || patient.apellido || ''}`.trim() || patient.displayName || pago.pacienteNombre || pago.patientNombre || "Paciente";
            const patientDoc = patient.documento || patient.nroDocumento || patient.numero_documento || patient.nro_documento || patient.identificacion || patient.cedula || patient.docNumber || pago.pacienteDocumento || pago.documento || pago.patientDoc || "—";
            const patientDocType = patient.tipoDocumento || patient.tipo_documento || patient.tipoDoc || pago.tipoDocumento || "CC";
            const patientAddress = patient.direccion || patient.direccionDomicilio || patient.lugarResidencia || patient.address || "—";
            const patientCity = patient.ciudadDomicilio || patient.ciudad || patient.municipio || clinic.ciudad || "Sincelejo";
            const patientPhone = patient.celular || patient.telefono || patient.phone || patient.movil || "—";
            // Clean consecutive number (avoid "No. No. REC-...")
            let rawConsecutive = String(pago.nroConsecutivo || "").trim();
            if (rawConsecutive.startsWith("No.")) {
                rawConsecutive = rawConsecutive.replace(/^No\.\s*/i, "");
            }
            const receiptNumber = rawConsecutive ? rawConsecutive : "S/N";

            const date = pago.fecha ? (pago.fecha.toDate ? pago.fecha.toDate() : new Date(pago.fecha)) : new Date();
            const formattedDate = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

            const subtotalStr = `$ ${Number(pago.monto || 0).toLocaleString('es-CO')}`;
            const totalStr = `$ ${Number(pago.monto || 0).toLocaleString('es-CO')}`;

            const conceptStr = pago.concepto || "Abono a tratamiento";
            const observationsStr = pago.notas || `Abono de tratamiento`;

            const isEgreso = pago.tipo === "egreso";
            const hasPlanInfo = !isEgreso && typeof totalPlan === "number" && totalPlan > 0;
            const accentColor = isEgreso ? "#dc2626" : "#2563eb";
            const accentBg = isEgreso ? "#fef2f2" : "#eff6ff";
            const accentBorder = isEgreso ? "#fca5a5" : "#dbeafe";
            const documentTitle = pago.documentTitle 
                || (isEgreso ? "Comprobante de Egreso" : "Recibo de Caja");

            const html = `
                <div style="border: 1px solid #e2e8f0; padding: 40px; border-radius: 24px; position: relative; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    <!-- Top accent bar -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background-color: ${accentColor}; border-top-left-radius: 24px; border-top-right-radius: 24px;"></div>

                    <!-- Unified Premium Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid ${accentColor}; padding-bottom: 25px; margin-bottom: 30px; margin-top: 15px;">
                        <div style="display: flex; gap: 25px; align-items: center;">
                            ${logoUrl 
                                ? `<img src="${logoUrl}" style="max-height: 75px; max-width: 165px; object-fit: contain;" crossorigin="anonymous" />`
                                : `<div style="width: 80px; height: 80px; background: ${accentColor}; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: 900; text-transform: uppercase;">${clinicName.substring(0, 1) || "O"}</div>`
                            }
                            <div>
                                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -1px;">${clinicName}</h1>
                                <p style="margin: 4px 0; font-size: 13px; color: #475569; font-weight: 800;">NIT: ${clinicNit}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500;">${clinicAddress}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500;">TEL: ${clinicPhone} | ${clinicEmail}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${accentBg}; padding: 12px 20px; border-radius: 16px; border: 2px solid ${accentBorder}; margin-bottom: 8px; display: inline-block;">
                                <span style="font-size: 16px; font-weight: 900; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">${documentTitle}</span>
                            </div>
                            <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 900; text-transform: uppercase;">FECHA DE EMISIÓN: ${formattedDate}</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 900; color: ${accentColor}; font-family: monospace;">NRO: ${receiptNumber}</p>
                        </div>
                    </div>

                    <!-- CUSTOMER / BENEFICIARY INFO CARD -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 25px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
                        <div style="border-right: 1px solid #cbd5e1; padding-right: 20px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                                ${isEgreso ? "Beneficiario / Proveedor / Tercero" : "Información del Paciente"}
                            </span>
                            <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">${patientName}</h2>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 10px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">ID / DOC:</strong> ${patientDocType.toUpperCase()} ${patientDoc}</p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Dirección:</strong> ${patientAddress} (${patientCity})</p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Celular:</strong> ${patientPhone}</p>
                            </div>
                        </div>
                        <div style="padding-left: 10px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                                ${isEgreso ? "Detalles del Egreso" : "Detalles del Recibo"}
                            </span>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px;">
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Medio de Pago:</strong> <span style="text-transform: uppercase;">${pago.medio || pago.metodo || pago.metodo_pago || pago.medioPago || "Efectivo"}</span></p>
                                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Elaborado por:</strong> <span style="text-transform: uppercase;">${(pago.registradoPor && !pago.registradoPor.includes('@')) ? pago.registradoPor : (userProfile?.nombreCompleto || userProfile?.nombre || "Guillermo Rodríguez")}</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- ITEMS DETAIL TABLE -->
                    <div style="margin-bottom: 30px;">
                        <table style="width: 100%; border-collapse: collapse; border-radius: 16px; overflow: hidden; border-style: hidden; box-shadow: 0 0 0 1px #e2e8f0;">
                            <thead>
                                <tr style="background: ${accentColor}; color: white;">
                                    <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Concepto</th>
                                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 120px;">Precio Unitario</th>
                                    <th style="padding: 12px 15px; text-align: center; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 70px;">Cantidad</th>
                                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 130px;">Total</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 12px; color: #334155; font-weight: 600;">
                                ${pago.itemPayments && pago.itemPayments.length > 0 ? pago.itemPayments.map((ip, index) => `
                                    <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 15px; font-weight: 800; text-transform: uppercase;">${ip.desc}</td>
                                        <td style="padding: 12px 15px; text-align: right; font-family: monospace;">$ ${Number(ip.monto).toLocaleString('es-CO')}</td>
                                        <td style="padding: 12px 15px; text-align: center; font-weight: 900;">1</td>
                                        <td style="padding: 12px 15px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">$ ${Number(ip.monto).toLocaleString('es-CO')}</td>
                                    </tr>
                                `).join('') : `
                                    <tr style="background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 14px 15px; font-weight: 800; text-transform: uppercase;">${conceptStr}</td>
                                        <td style="padding: 14px 15px; text-align: right; font-family: monospace;">$ ${Number(pago.monto || 0).toLocaleString('es-CO')}</td>
                                        <td style="padding: 14px 15px; text-align: center; font-weight: 900;">1</td>
                                        <td style="padding: 14px 15px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">$ ${Number(pago.monto || 0).toLocaleString('es-CO')}</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- OBS & TOTALS ROW -->
                    <div style="display: flex; justify-content: space-between; gap: 40px; margin-bottom: 60px; align-items: flex-start;">
                        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 20px; padding: 20px; background-color: #f8fafc; font-size: 11px; line-height: 1.6;">
                            <span style="font-weight: 900; color: #475569; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 8px;">Observaciones:</span>
                            <div style="font-weight: 500; color: #334155; white-space: pre-wrap;">${observationsStr}</div>
                        </div>
                        <div style="width: 280px; display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #64748b; padding: 0 4px;">
                                <span style="text-transform: uppercase; letter-spacing: 1px;">Subtotal</span>
                                <span>${subtotalStr}</span>
                            </div>
                            <div style="height: 2px; background: ${accentColor}; margin: 6px 0;"></div>
                            <div style="display: flex; justify-content: space-between; align-items: center; background: ${accentColor}; color: white; padding: 12px 18px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">${isEgreso ? "TOTAL EGRESO" : "TOTAL ABONADO"}</span>
                                <span style="font-size: 18px; font-weight: 900;">${totalStr}</span>
                            </div>

                            ${hasPlanInfo ? `
                                <div style="height: 1px; border-top: 1px dashed #cbd5e1; margin: 12px 0 6px 0;"></div>

                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Plan de Trat.:</span>
                                    <span style="font-weight: 800; text-transform: uppercase; text-align: right;" title="${planTitle || 'Tratamiento'}">${planTitle || 'Tratamiento'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748b; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Total plan:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(totalPlan).toLocaleString('es-CO')}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #10b981; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Total pagado:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(totalPagadoPlan || 0).toLocaleString('es-CO')}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #ef4444; padding: 0 4px;">
                                    <span style="text-transform: uppercase; font-size: 8px;">Saldo restante:</span>
                                    <span style="font-family: monospace; font-weight: bold;">$ ${Number(saldoPlan || 0).toLocaleString('es-CO')}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- SIGNATURE BLOCK -->
                    <div style="margin-top: 80px; display: flex; justify-content: space-between; gap: 80px; padding: 0 30px;">
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Elaborado por</p>
                            <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${(pago.registradoPor && !pago.registradoPor.includes('@')) ? pago.registradoPor : (userProfile?.nombreCompleto || userProfile?.nombre || "Cajero / Auxiliar")}</p>
                        </div>
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">${isEgreso ? "Recibido / Beneficiario" : "Aceptado por el Paciente"}</p>
                            <p style="margin: 4px 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Firma y Cédula / Sello</p>
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
                windowWidth: 850
            });

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            
            const pdfBlob = pdf.output('bloburl');
            window.open(pdfBlob, '_blank');

            document.body.removeChild(printElement);
            toast.dismiss(toastId);
            toast.success("Recibo de caja generado correctamente");

        } catch (error) {
            console.error("Error generating receipt PDF:", error);
            toast.dismiss(toastId);
            toast.error("Error al generar el recibo de caja en PDF");
        }
    }
};
