import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export const EvolutionPrintService = {
    generatePDF: async (evolutionsList = [], patient = {}, clinic = {}, userProfile = {}) => {
        if (!patient) {
            toast.error("Error: Información del paciente no disponible para generar el reporte");
            return;
        }

        const toastId = toast.loading("Generando historial de evoluciones en PDF...");

        try {
            // 1. Resolve Company Details & Logo
            const tenantId = clinic.inquilino || clinic.id || userProfile?.inquilino || userProfile?.tenantId || "";
            let dbLogoUrl = "";
            let dbClinicName = "";
            let dbClinicNit = "";
            let dbClinicAddress = "";
            let dbClinicPhone = "";
            let dbClinicEmail = "";

            if (tenantId) {
                try {
                    const configSnap = await getDoc(doc(db, "tenants", tenantId));
                    if (configSnap.exists()) {
                        const clinicConfig = configSnap.data();
                        dbLogoUrl = clinicConfig.logo || clinicConfig.logoUrl || "";
                        dbClinicName = clinicConfig.nombreComercial || clinicConfig.name || clinicConfig.nombre || "";
                        dbClinicNit = clinicConfig.nit || "";
                        dbClinicAddress = clinicConfig.address || clinicConfig.direccion || "";
                        dbClinicPhone = clinicConfig.phone || clinicConfig.telefono || "";
                        dbClinicEmail = clinicConfig.email || "";
                    }
                } catch (err) {
                    console.error("Error loading tenant config for evolution print:", err);
                }
            }

            const rawLogoUrl = dbLogoUrl || clinic?.logo || clinic?.logoUrl || userProfile?.tenant?.logo || "";
            const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const logoUrl = (isLocalDev && rawLogoUrl && rawLogoUrl.includes('firebasestorage.googleapis.com'))
                ? `/odontocloud-react/api/proxy-logo?url=${encodeURIComponent(rawLogoUrl)}`
                : rawLogoUrl;

            const clinicName = dbClinicName || clinic?.nombreComercial || clinic?.nombre || clinic?.name || userProfile?.tenant?.nombreComercial || "Clínica Dental";
            const clinicNit = dbClinicNit || clinic?.nit || clinic?.NIT || userProfile?.tenant?.nit || "---";
            const clinicAddress = dbClinicAddress || clinic?.direccion || clinic?.address || userProfile?.tenant?.direccion || "---";
            const clinicPhone = dbClinicPhone || clinic?.telefono || clinic?.phone || userProfile?.tenant?.telefono || "---";
            const clinicEmail = dbClinicEmail || clinic?.email || userProfile?.tenant?.email || "---";

            // 2. Resolve Patient Details & Age
            const patientName = patient?.nombreCompleto || `${patient?.nombre || ''} ${patient?.apellido || ''}`.trim() || 'Paciente Sin Nombre';
            const fechaNac = patient?.fechaNacimiento ? new Date(patient.fechaNacimiento) : null;
            const edad = patient?.edad || (fechaNac && !isNaN(fechaNac.getTime()) ? Math.floor((new Date() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000)) : '---');
            const printDate = new Date().toLocaleDateString("es-CO", { day: '2-digit', month: '2-digit', year: 'numeric' });

            // 3. Create Container
            const printElement = document.createElement("div");
            printElement.style.position = "absolute";
            printElement.style.left = "-9999px";
            printElement.style.top = "0";
            printElement.style.width = "850px";
            printElement.style.padding = "40px";
            printElement.style.backgroundColor = "white";
            printElement.style.color = "#1e293b";
            printElement.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";

            // Header Logo
            const logoHTML = logoUrl
                ? `<img src="${logoUrl}" style="max-height: 70px; max-width: 140px; object-fit: contain; border-radius: 12px;" crossOrigin="anonymous" />`
                : `<div style="width: 60px; height: 60px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px; font-weight: 900;">${clinicName.substring(0, 1) || "O"}</div>`;

            // Header HTML
            const headerHTML = `
                <div style="position: relative; padding-bottom: 20px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start;">
                    <!-- Top Blue Gradient Bar -->
                    <div style="position: absolute; top: -40px; left: -40px; right: -40px; height: 8px; background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);"></div>

                    <div style="display: flex; gap: 18px; align-items: center;">
                        ${logoHTML}
                        <div>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${clinicName}</h1>
                            <p style="margin: 3px 0 0 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                <strong style="color: #94a3b8; margin-right: 4px;">NIT:</strong> ${clinicNit}
                            </p>
                            <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #64748b; font-weight: 500;">
                                <strong style="color: #94a3b8; margin-right: 4px;">Dirección:</strong> ${clinicAddress}
                            </p>
                            <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #64748b; font-weight: 500;">
                                <strong style="color: #94a3b8; margin-right: 4px;">Tel:</strong> ${clinicPhone} <span style="color: #cbd5e1; margin: 0 4px;">|</span> <strong style="color: #94a3b8; margin-right: 4px;">Email:</strong> ${clinicEmail}
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 10px 20px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.05);">
                            <span style="font-size: 11px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; display: block;">HISTORIA CLÍNICA</span>
                            <span style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Reporte de Evoluciones</span>
                        </div>
                        <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: 600;">
                            <strong style="color: #94a3b8; text-transform: uppercase; margin-right: 4px;">Fecha Impresión:</strong> ${printDate}
                        </p>
                    </div>
                </div>
            `;

            // Patient Summary Table (Matching OralDrive structure with OdontoCloud styling)
            const patientTableHTML = `
                <div style="margin-bottom: 25px;">
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10px; background: white;">
                        <tbody>
                            <tr>
                                <td style="width: 18%; background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Nombre del paciente</td>
                                <td style="width: 32%; border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; color: #0f172a;">${patientName}</td>
                                <td style="width: 12%; background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Edad</td>
                                <td style="width: 10%; border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; color: #0f172a;">${edad}</td>
                                <td style="width: 14%; background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Nro Historia</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; color: #0f172a;">${patient?.numeroDocumento || patient?.documento || patient?.cedula || '---'}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Tipo documento</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.tipoDocumento || 'Cédula de ciudadanía'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Nro de documento</td>
                                <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; color: #0f172a;">${patient?.numeroDocumento || patient?.documento || patient?.cedula || '---'}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Sexo</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.genero || patient?.sexo || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Fecha / Lugar Nac.</td>
                                <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">
                                    ${fechaNac && !isNaN(fechaNac.getTime()) ? fechaNac.toLocaleDateString('es-CO') : '---'} ${patient?.lugarNacimiento ? `· ${patient.lugarNacimiento}` : ''}
                                </td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Correo</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.email || patient?.correo || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Ocupación</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.ocupacion || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Fecha impresión</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${printDate}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Teléfonos</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.telefono || patient?.celular || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Estado civil</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.estadoCivil || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Doctor/Profesional</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 700; color: #2563eb;">${userProfile?.nombreCompleto || userProfile?.nombre || patient?.doctorTratante || '---'}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Nombre responsable</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.nombreResponsable || patient?.acudiente || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Teléfono responsable</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.telefonoResponsable || '---'}</td>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">EPS</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.nombreEps || patient?.eps || patient?.epsNombre || '---'}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; color: #475569; text-transform: uppercase;">Dirección residencia</td>
                                <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #334155;">${patient?.lugarResidencia || patient?.direccion || patient?.direccionResidencia || patient?.address || '---'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            // Section Title
            const sectionTitleHTML = `
                <div style="text-align: center; font-size: 11px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 2px; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; padding: 8px 0; margin: 25px 0 20px;">
                    Evoluciones Clínicas Registradas (${evolutionsList.length})
                </div>
            `;

            // Evolutions List Render
            let evolutionsHTML = "";

            if (evolutionsList.length === 0) {
                evolutionsHTML = `
                    <div style="padding: 30px; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; font-weight: 700; font-size: 11px; text-transform: uppercase;">
                        No existen evoluciones clínicas registradas para este paciente.
                    </div>
                `;
            } else {
                evolutionsHTML = evolutionsList.map((evo) => {
                    const rawDate = evo.date ? (evo.date.seconds ? new Date(evo.date.seconds * 1000) : new Date(evo.date)) : new Date();
                    const dateStr = rawDate.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                    const timeStr = rawDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

                    const profName = evo.profesional || userProfile?.nombreCompleto || 'Doctor';
                    const isRemission = evo.type === 'remission';
                    const obsText = evo.description || evo.comentario || 'Sin observaciones registradas.';

                    // Extract procedures from plantillaItems or treatment
                    let procTagsHTML = "";
                    if (evo.plantillaItems && typeof evo.plantillaItems === 'object') {
                        const procs = Object.values(evo.plantillaItems)
                            .filter(v => v?.checked)
                            .map(v => {
                                const name = v.desc || v.procedimiento || v.nombre || '';
                                const tooth = v.dientes ? `[Diente ${v.dientes}] ` : '';
                                return tooth + name;
                            })
                            .filter(Boolean);

                        if (procs.length > 0) {
                            procTagsHTML = procs.map(p => `
                                <span style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 6px; margin-right: 6px; margin-bottom: 6px; text-transform: uppercase;">
                                    ${p}
                                </span>
                            `).join('');
                        }
                    }

                    if (!procTagsHTML && evo.treatment) {
                        procTagsHTML = `
                            <span style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 6px; margin-right: 6px; margin-bottom: 6px; text-transform: uppercase;">
                                ${evo.treatment}
                            </span>
                        `;
                    }

                    // Diagnosis if present
                    let dxHTML = "";
                    if (evo.dxPrincipal?.code) {
                        dxHTML = `
                            <div style="font-size: 9.5px; font-weight: 700; color: #475569; margin-top: 4px;">
                                <strong style="color: #94a3b8; text-transform: uppercase;">Dx CIE-10:</strong> ${evo.dxPrincipal.code} — ${evo.dxPrincipal.name || ''}
                            </div>
                        `;
                    }

                    return `
                        <div style="margin-bottom: 18px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
                                    ${patientName} (${profName})
                                </span>
                                <span style="font-size: 9.5px; font-weight: 800; color: #64748b;">
                                    ${dateStr} — ${timeStr}
                                </span>
                            </div>

                            ${procTagsHTML ? `<div style="margin-top: 6px; margin-bottom: 6px;">${procTagsHTML}</div>` : ''}
                            ${dxHTML}

                            <div style="font-size: 10.5px; color: #334155; line-height: 1.6; font-weight: 500; margin-top: 6px; white-space: pre-wrap; word-break: break-word;">
                                ${obsText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Signature & Footer
            const docSignatureImg = (userProfile?.firmaElectronica || userProfile?.firma)
                ? `<img src="${userProfile.firmaElectronica || userProfile.firma}" style="max-height: 55px; max-width: 180px; object-fit: contain;" crossOrigin="anonymous" />`
                : '';

            const footerHTML = `
                <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;">
                            ${docSignatureImg}
                        </div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Firma del Especialista / Odontólogo</p>
                            <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${userProfile?.registroMedico ? `TP: ${userProfile.registroMedico}` : 'Sello y Registro Médico'}</p>
                        </div>
                    </div>

                    <div style="flex: 1; text-align: center;">
                        <div style="height: 60px;"></div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Responsable de Registro</p>
                            <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Generado por: ${(userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Administrador").toUpperCase()}</p>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 40px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                    <p style="margin: 0; font-size: 8.5px; color: #cbd5e1; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">
                        Documento oficial generado por OdontoCloud Elite Pro
                    </p>
                </div>
            `;

            // 4. Assemble HTML
            printElement.innerHTML = headerHTML + patientTableHTML + sectionTitleHTML + evolutionsHTML + footerHTML;
            document.body.appendChild(printElement);

            // Wait for images
            const images = printElement.querySelectorAll("img");
            await Promise.all(Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            // 5. Render Canvas & PDF with Multi-page Pagination support
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
            const imgWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pageHeight;
            }

            const pdfBlob = pdf.output('bloburl');
            window.open(pdfBlob, '_blank');

            document.body.removeChild(printElement);
            toast.success("Historial de evoluciones generado con éxito", { id: toastId });

        } catch (error) {
            console.error("Error generating evolutions PDF:", error);
            toast.error("Error al generar el documento de evoluciones", { id: toastId });
        }
    }
};
