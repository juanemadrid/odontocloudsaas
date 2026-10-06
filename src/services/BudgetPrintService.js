import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import supabase from "../lib/supabaseClient";

/**
 * BudgetPrintService
 * Generates professional institutional PDF documents for Budgets and Treatment Plans.
 */
export const BudgetPrintService = {
    
    generatePDF: async (plan, patient, clinic, userProfile) => {
        if (!plan || !patient || !clinic) {
            console.error("Missing data for PDF generation:", { plan, patient, clinic });
            window.alert("❌ Datos insuficientes para generar el documento");
            return;
        }

        window.alert("Generando documento institucional...");

        try {
            // 1. Create hidden container
            const printElement = document.createElement("div");
            printElement.className = "budget-print-export";
            printElement.style.position = "absolute";
            printElement.style.left = "-9999px";
            printElement.style.top = "0";
            printElement.style.width = "900px"; // Size for A4 portrait
            printElement.style.padding = "35px 45px";
            printElement.style.backgroundColor = "white";
            printElement.style.color = "#1e293b";
            printElement.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";

            // 2. Data Preparation
            const date = plan.date ? new Date(plan.date) : new Date();
            const formattedDate = date.toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' });
            
            const subtotal = plan.subtotal || plan.items?.reduce((acc, i) => acc + (i.amount * i.qty), 0) || 0;
            const discount = plan.totalDescuento || plan.items?.reduce((acc, i) => acc + (i.descuento || 0), 0) || 0;
            const total = plan.total || (subtotal - discount);

            // 2.3 Fetch clinical evolutions to check realized state of items
            let evolutions = [];
            const patientId = patient?.id || patient?.documento || "";
            if (patientId && plan.id) {
                try {
                    const { data: evoData } = await supabase
                        .from("evoluciones")
                        .select("*")
                        .eq("paciente_id", patientId)
                        .eq("plan_id", plan.id);
                    evolutions = evoData || [];
                } catch (err) {
                    console.error("Error loading evolutions for print:", err);
                }
            }

            const isItemRealized = (item) => {
                if (item.realizado === true) return true;
                return evolutions.some(evo =>
                    evo.plantillaItems?.[item.id]?.realizado === true ||
                    (evo.plantillaItems?.[item.id]?.realizado === undefined && evo.plantillaItems?.[item.id]?.checked === true)
                );
            };

            // 2.5 Resolve Patient Info with extreme robustness
            // Sometimes patient comes from the database, sometimes from form watch, sometimes from list search
            const pName = (patient?.nombreCompleto || patient?.NombreCompleto || patient?.paciente || patient?.Paciente || "").toString().trim() || 
                         (patient?.nombres ? `${patient.nombres} ${patient.apellidos || ""}`.trim() : "") ||
                         (patient?.Nombres ? `${patient.Nombres} ${patient.Apellidos || ""}`.trim() : "") ||
                         (patient?.nombre || patient?.name || "").toString().trim() ||
                         (Object.keys(patient || {}).find(k => k.toLowerCase().includes('nombre') && typeof patient[k] === 'string' && patient[k].length > 2) ? patient[Object.keys(patient).find(k => k.toLowerCase().includes('nombre') && typeof patient[k] === 'string' && patient[k].length > 2)] : "") ||
                         "Paciente Desconocido";
            
            const pDoc = patient?.nroDocumento || 
                        patient?.documento || 
                        patient?.nroHistoria ||
                        patient?.id || 
                        "---";
            
            const pPhone = patient?.celular || 
                          patient?.telefono || 
                          patient?.celularPaciente || 
                          patient?.telDomicilio ||
                          "---";
            
            // Fetch company configuration (empresa) for actual logo, nit, address, phone etc.
            const tenantId = clinic?.inquilino || userProfile?.inquilino || "";
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
            const rawLogoUrl = dbLogoUrl || clinic?.logo || clinic?.logoUrl || "";
            const logoUrl = rawLogoUrl;
            const clinicName = dbClinicName || clinic?.nombreComercial || clinic?.nombre || clinic?.name || "Clínica Odontológica";
            const clinicNit = dbClinicNit || clinic?.nit || clinic?.NIT || "---";
            const clinicAddress = dbClinicAddress || clinic?.direccion || "---";
            const clinicPhone = dbClinicPhone || clinic?.telefono || "---";
            const clinicEmail = dbClinicEmail || clinic?.email || "";

            const cobertura = plan.cobertura || {};
            const isInstitutionalPlan = cobertura.tipo === "entidad";

            // 2.7 Resolve Professional Name & Role (Doctor vs Admin)
            let profDisplayName = plan.profesional || "";
            // If the plan professional matches clinic name or is empty or undefined, try to get it from current user or fallback
            if (!profDisplayName || profDisplayName.toUpperCase() === (clinic?.nombre || "").toUpperCase() || profDisplayName.toLowerCase().includes("undefined")) {
                profDisplayName = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.name || "";
            }
            if (!profDisplayName || profDisplayName.toLowerCase().includes("undefined")) {
                const fallbackName = userProfile?.nombreCompleto || userProfile?.nombre || "";
                profDisplayName = (fallbackName && !fallbackName.toLowerCase().includes("undefined")) ? fallbackName : "Administrador";
            }
            
            // Determine if it's a doctor or admin (Maria Royo is admin)
            const isDoctor = userProfile?.rol?.toLowerCase() === 'doctor' || 
                             userProfile?.rol?.toLowerCase() === 'profesional' || 
                             plan.profesionalId?.toLowerCase().includes('doc') ||
                             profDisplayName.toLowerCase().includes('dr.');
            
            const roleLabel = isDoctor ? "Atendido por" : "Elaborado por";
            
            // Clean name and apply "DR." only if it's a doctor
            profDisplayName = profDisplayName.replace(/^DR\.?\s+/i, "");
            if (isDoctor) profDisplayName = `DR. ${profDisplayName}`;

            // Calculate validity
            const vigencia = plan.vigencia || 30;
            const validUntil = new Date(date);
            validUntil.setDate(validUntil.getDate() + vigencia);
            const formattedValidUntil = validUntil.toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' });

            // 3. Template HTML
            const headerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 20px; align-items: center;">
                        ${logoUrl 
                            ? `<img src="${logoUrl}" style="max-width: 130px; max-height: 70px; object-fit: contain;" crossorigin="anonymous" />`
                            : `<div style="width: 65px; height: 65px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 30px; font-weight: 900;">${clinicName.substring(0, 1) || "O"}</div>`
                        }
                        <div>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${clinicName}</h1>
                            <p style="margin: 3px 0 1px 0; font-size: 12px; color: #475569; font-weight: 800;">NIT: ${clinicNit}</p>
                            <p style="margin: 1px 0; font-size: 11px; color: #64748b; font-weight: 500;">${clinicAddress}</p>
                            <p style="margin: 1px 0; font-size: 11px; color: #64748b; font-weight: 500;">TEL: ${clinicPhone}${clinicEmail ? ` | ${clinicEmail}` : ''}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: #eff6ff; padding: 7px 16px; border-radius: 10px; border: 1.5px solid #bfdbfe; display: inline-block; white-space: nowrap;">
                            <span style="font-size: 13px; font-weight: 900; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">${plan.type === 'plan' ? 'PLAN DE TRATAMIENTO' : 'PRESUPUESTO ODONTOLÓGICO'}</span>
                        </div>
                    </div>
                </div>
            `;

            const patientInfoHTML = `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 20px; display: grid; grid-template-columns: 1.25fr 1fr; gap: 20px;">
                    <div style="border-right: 1px solid #f1f5f9; padding-right: 20px;">
                        <span style="font-size: 8px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Información del Paciente</span>
                        <h2 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${pName}</h2>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 5px;">
                            <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Documento:</strong> ${patient?.tipoDocumento || "C.C."} ${pDoc}</p>
                            <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Dirección:</strong> ${patient?.lugarResidencia || patient?.direccion || "---"}</p>
                            <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Ciudad:</strong> ${patient?.ciudadDomicilio || patient?.ciudad || "---"}</p>
                            <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Teléfono:</strong> ${pPhone}</p>
                        </div>
                    </div>
                    <div style="padding-left: 10px; display: flex; flex-direction: column; justify-content: flex-start;">
                        <span style="font-size: 8px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Detalles del Documento</span>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 5px;">
                            <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Expedición:</strong> ${formattedDate}</p>
                            ${plan.type !== 'plan' 
                                ? `<p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Válido Hasta:</strong> ${formattedValidUntil} (${vigencia} días)</p>`
                                : `<p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Tipo:</strong> Plan de Tratamiento Odontológico</p>`
                            }
                            ${plan.id ? `<p style="margin: 0; font-size: 11px; color: #475569; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">Código Ref:</strong> #${String(plan.id).slice(-8).toUpperCase()}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;

            const coverageHTML = isInstitutionalPlan ? `
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 14px 18px; margin-bottom: 20px;">
                    <span style="font-size: 8px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 12px;">Cobertura / autorizacion institucional</span>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                        <div>
                            <p style="margin: 0 0 3px 0; font-size: 8px; color: #60a5fa; font-weight: 900; text-transform: uppercase;">EPS</p>
                            <p style="margin: 0; font-size: 11px; color: #1e3a8a; font-weight: 800;">${cobertura.epsNombre || "---"}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 3px 0; font-size: 8px; color: #60a5fa; font-weight: 900; text-transform: uppercase;">Entidad</p>
                            <p style="margin: 0; font-size: 11px; color: #1e3a8a; font-weight: 800;">${cobertura.entidadNombre || "---"}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 3px 0; font-size: 8px; color: #60a5fa; font-weight: 900; text-transform: uppercase;">Tarifa</p>
                            <p style="margin: 0; font-size: 11px; color: #1e3a8a; font-weight: 800;">${cobertura.tarifaNombre || "---"}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 3px 0; font-size: 8px; color: #60a5fa; font-weight: 900; text-transform: uppercase;">Orden</p>
                            <p style="margin: 0; font-size: 11px; color: #1e3a8a; font-weight: 800;">${cobertura.ordenNumero || "---"}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 3px 0; font-size: 8px; color: #60a5fa; font-weight: 900; text-transform: uppercase;">Fecha orden</p>
                            <p style="margin: 0; font-size: 11px; color: #1e3a8a; font-weight: 800;">${cobertura.ordenFecha || "---"}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 3px 0; font-size: 8px; color: #60a5fa; font-weight: 900; text-transform: uppercase;">Urgencia</p>
                            <p style="margin: 0; font-size: 11px; color: #1e3a8a; font-weight: 800;">${cobertura.ordenUrgente ? "Si" : "No"}</p>
                        </div>
                    </div>
                </div>
            ` : "";

            const itemsTableHTML = `
                <div style="margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border-style: hidden; box-shadow: 0 0 0 1px #e2e8f0;">
                        <thead>
                            <tr style="background: #2563eb; color: white;">
                                <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Código</th>
                                <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Descripción</th>
                                <th style="padding: 8px 10px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Dientes</th>
                                <th style="padding: 8px 10px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Realizado</th>
                                <th style="padding: 8px 10px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Cant.</th>
                                <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">V. Unitario</th>
                                <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                            </tr>
                        </thead>
                        <tbody style="font-size: 11px; color: #334155; font-weight: 600;">
                            ${plan.items?.map((item, index) => `
                                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px 10px; color: #2563eb; font-weight: 800; font-family: monospace;">${item.code || "---"}</td>
                                    <td style="padding: 8px 10px;">
                                        <div style="font-weight: 800; text-transform: uppercase;">${item.desc || "---"}</div>
                                        ${item.line_obs ? `<div style="font-size: 10px; color: #94a3b8; font-weight: 500; font-style: italic; margin-top: 2px;">OBS: ${item.line_obs}</div>` : ""}
                                    </td>
                                    <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #64748b;">${item.dientes || "---"}</td>
                                    <td style="padding: 8px 10px; text-align: center;">
                                        ${isItemRealized(item)
                                            ? `<span style="color: #10b981; font-weight: 800; background: #ecfdf5; padding: 2px 6px; border-radius: 6px; font-size: 9px; text-transform: uppercase;">Realizado</span>`
                                            : `<span style="color: #64748b; font-weight: 800; background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 9px; text-transform: uppercase;">No realizado</span>`
                                        }
                                    </td>
                                    <td style="padding: 8px 10px; text-align: center; font-weight: 900;">${item.qty}</td>
                                    <td style="padding: 8px 10px; text-align: right;">$${Number(item.amount).toLocaleString('es-CO')}</td>
                                    <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #0f172a;">$${(Number(item.amount) * Number(item.qty)).toLocaleString('es-CO')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            const summaryHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 30px; margin-bottom: 35px;">
                    <div style="flex: 1; background: #fdf2f8/50; border: 1px dashed #fce7f3; border-radius: 14px; padding: 14px 18px;">
                        <span style="font-size: 9px; font-weight: 900; color: #be185d; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Términos y Observaciones</span>
                        <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 500; line-height: 1.6; white-space: pre-wrap;">${plan.observaciones || "Este presupuesto tiene una validez de 30 días a partir de la fecha de emisión. Los valores están sujetos a cambios según la evolución clínica del paciente."}</p>
                    </div>
                    <div style="width: 280px; space-y: 6px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; padding: 0 10px;">
                            <span style="text-transform: uppercase; letter-spacing: 1px;">Subtotal</span>
                            <span>$${subtotal.toLocaleString('es-CO')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; color: #e11d48; margin-bottom: 6px; padding: 0 10px;">
                            <span style="text-transform: uppercase; letter-spacing: 1px;">Descuentos</span>
                            <span>-$${discount.toLocaleString('es-CO')}</span>
                        </div>
                        <div style="height: 2px; background: #2563eb; margin: 10px 0;"></div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #2563eb; color: white; padding: 10px 16px; border-radius: 10px; box-shadow: 0 4px 10px -2px rgba(37,99,235,0.25);">
                            <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">TOTAL NETO</span>
                            <span style="font-size: 18px; font-weight: 900;">$${total.toLocaleString('es-CO')}</span>
                        </div>
                    </div>
                </div>
            `;

            const docSignatureImg = (userProfile?.firmaElectronica || userProfile?.firma)
                ? `<img src="${userProfile.firmaElectronica || userProfile.firma}" style="max-height: 55px; max-width: 180px; object-fit: contain;" crossOrigin="anonymous" />`
                : '';

            const footerHTML = `
                <div style="margin-top: 35px; display: flex; justify-content: space-between; gap: 80px; padding: 0 30px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 45px;"></div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Aceptado por el Paciente</p>
                            <p style="margin: 3px 0 0 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">C.C. / Registro</p>
                        </div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 45px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;">
                            ${docSignatureImg}
                        </div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${profDisplayName}</p>
                            <p style="margin: 3px 0 0 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">${roleLabel}${userProfile?.rol && profDisplayName.toLowerCase() !== "administrador" ? ` • ${userProfile.rol}` : ''}${userProfile?.registroMedico ? ` • TP: ${userProfile.registroMedico}` : ''}</p>
                        </div>
                    </div>
                </div>
            `;

            // 4. Assemble and Append
            printElement.innerHTML = DOMPurify.sanitize(headerHTML + patientInfoHTML + coverageHTML + itemsTableHTML + summaryHTML + footerHTML);
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

            // 5. Generate with html2canvas
            const canvas = await html2canvas(printElement, {
                scale: 2.5, // High resolution
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                windowWidth: 900
            });

            // 6. Professional PDF construction
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            
            // 7. Open in New Tab
            const pdfBlob = pdf.output('bloburl');
            window.open(pdfBlob, '_blank');

            // Cleanup
            document.body.removeChild(printElement);
            window.alert("✅ PDF generado con éxito");

        } catch (error) {
            console.error("Error generating PDF:", error);
            window.alert("❌ Error al generar el documento PDF");
        }
    }
};
