// src/services/backupExportService.js
/**
 * Servicio de Generación de Copia de Seguridad Clínica (Estructura OralDrive)
 * Genera un archivo ZIP con la jerarquía:
 * └── [Nombre Paciente] - [Documento]/
 *     ├── Documentos clínicos/
 *     ├── Evoluciones/
 *     ├── Odontogramas/
 *     ├── Periodontogramas/
 *     ├── Rx-Imagenes Oral/
 *     └── placeholder
 * 
 * 100% SEGURO: Operación de solo lectura (SELECT). Sin migraciones ni modificaciones en producción.
 */

import JSZip from "jszip";
import { jsPDF } from "jspdf";
import supabase from "../lib/supabaseClient";
import { resolvePrivateFileUrl } from "./privateStorageService";

// Limpia caracteres inválidos en nombres de carpetas de Windows y Unix
export function sanitizeFolderName(name) {
    if (!name) return "Paciente_Sin_Identificar";
    return name
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim();
}

// Formatea fecha en español de forma segura
function formatDateEs(dateVal) {
    if (!dateVal) return "Fecha no registrada";
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toLocaleDateString("es-CO", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
    } catch {
        return String(dateVal);
    }
}

function formatDateTimeEs(dateVal) {
    if (!dateVal) return "Fecha no registrada";
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return `${d.toLocaleDateString("es-CO")} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
        return String(dateVal);
    }
}

// Genera el encabezado estándar de ficha de paciente en jsPDF
function drawPatientHeader(doc, patient, clinicInfo, title = "EVOLUCIÓN CLÍNICA ODONTOLÓGICA") {
    const clinicName = clinicInfo?.nombre || clinicInfo?.name || "ODONTOCLOUD COLOMBIA";
    const clinicNit = clinicInfo?.nit || "—";
    const clinicPhone = clinicInfo?.telefono || clinicInfo?.phone || "—";

    // Encabezado institucional
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(clinicName.toUpperCase(), 105, 16, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`NIT: ${clinicNit}  |  Tel: ${clinicPhone}  |  Expediente Odontológico Oficial`, 105, 21, { align: "center" });

    // Línea separadora
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(15, 25, 195, 25);

    // Cuadro resumen de datos del paciente
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 28, 180, 24, "FD");

    const nombreCompleto = `${patient.nombres || ""} ${patient.apellidos || ""}`.trim() || patient.nombre || "Paciente";
    const documento = `${patient.tipo_documento || "CC"} ${patient.documento || "—"}`;
    const edad = patient.fecha_nacimiento 
        ? `${Math.floor((new Date() - new Date(patient.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000))} años`
        : (patient.edad ? `${patient.edad} años` : "—");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Paciente:", 18, 34);
    doc.setFont("helvetica", "normal");
    doc.text(nombreCompleto.substring(0, 40), 35, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Documento:", 120, 34);
    doc.setFont("helvetica", "normal");
    doc.text(documento, 142, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Edad:", 18, 41);
    doc.setFont("helvetica", "normal");
    doc.text(edad, 35, 41);

    doc.setFont("helvetica", "bold");
    doc.text("Teléfono:", 70, 41);
    doc.setFont("helvetica", "normal");
    doc.text(patient.telefono || patient.celular || "—", 86, 41);

    doc.setFont("helvetica", "bold");
    doc.text("EPS / Entidad:", 120, 41);
    doc.setFont("helvetica", "normal");
    doc.text((patient.eps || "Particular").substring(0, 25), 145, 41);

    doc.setFont("helvetica", "bold");
    doc.text("F. Impresión:", 18, 48);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("es-CO"), 39, 48);

    doc.setFont("helvetica", "bold");
    doc.text("Dirección:", 70, 48);
    doc.setFont("helvetica", "normal");
    doc.text((patient.direccion || "—").substring(0, 50), 86, 48);

    // Barra de título de la sección
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, 55, 180, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(title, 105, 60, { align: "center" });

    return 66; // Retorna la posición Y siguiente
}

// Parsea el tratamiento si viene como JSON o string
function parseEvolutionData(evo) {
    let parsedTreatment = {};
    if (typeof evo.tratamiento === "string" && (evo.tratamiento.startsWith("{") || evo.tratamiento.startsWith("["))) {
        try {
            parsedTreatment = JSON.parse(evo.tratamiento);
        } catch {
            parsedTreatment = {};
        }
    } else if (typeof evo.tratamiento === "object" && evo.tratamiento !== null) {
        parsedTreatment = evo.tratamiento;
    }

    const diagnostico = evo.diagnostico || parsedTreatment.dxPrincipal || parsedTreatment.diagnostico || "No registrado";
    const procedimiento = evo.procedimiento_cups || parsedTreatment.cups || parsedTreatment.finalidad || "No especificado";
    const notas = evo.notas || parsedTreatment.comentario || parsedTreatment.notas || (typeof evo.tratamiento === "string" ? evo.tratamiento : "");
    const profesional = evo.profesional_nombre || parsedTreatment.profesional || parsedTreatment.doctorQuienRecibeName || "Profesional Tratante";
    const fecha = evo.fecha || parsedTreatment.created_at || evo.created_at;

    return {
        id: evo.id,
        fecha,
        diagnostico,
        procedimiento,
        notas,
        profesional
    };
}

// Genera el PDF de una evolución individual (Estilo OralDrive)
export function generateSingleEvolutionPdf(evo, patient, clinicInfo) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const startY = drawPatientHeader(doc, patient, clinicInfo, "REGISTRO DE EVOLUCIÓN CLÍNICA INDIVIDUAL");
    let y = startY + 6;

    const data = parseEvolutionData(evo);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Fecha y Hora:", 18, y);
    doc.setFont("helvetica", "normal");
    doc.text(formatDateTimeEs(data.fecha), 42, y);

    doc.setFont("helvetica", "bold");
    doc.text("Profesional:", 95, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.profesional, 116, y);

    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Diagnóstico:", 18, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.diagnostico, 38, y);

    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Procedimiento / Finalidad:", 18, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.procedimiento, 60, y);

    y += 10;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 180, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("Descripción Clínica y Procedimiento Efectuado:", 18, y + 5);

    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const textoNotas = data.notas || "Sin notas adicionales registradas.";
    const splitNotas = doc.splitTextToSize(textoNotas, 174);
    doc.text(splitNotas, 18, y);

    y += (splitNotas.length * 4.5) + 20;
    if (y > 260) {
        doc.addPage();
        y = 30;
    }

    // Firma del profesional
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(18, y, 78, y);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(data.profesional, 18, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text("Firma Profesional y Registro Médico", 18, y + 9);

    return doc.output("arraybuffer");
}

// Genera el PDF Consolidado completo con todas las evoluciones del paciente
export function generateConsolidatedEvolutionsPdf(evoluciones, patient, clinicInfo) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    let startY = drawPatientHeader(doc, patient, clinicInfo, "HISTORIAL CRONOLÓGICO COMPLETO DE EVOLUCIONES");
    let y = startY + 5;

    // Ordenar de más antigua a más reciente para lectura legal cronológica
    const evosOrdenadas = [...evoluciones].sort((a, b) => new Date(a.fecha || a.created_at) - new Date(b.fecha || b.created_at));

    if (evosOrdenadas.length === 0) {
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 116, 139);
        doc.text("No existen evoluciones clínicas registradas para este paciente.", 105, y + 15, { align: "center" });
        return doc.output("arraybuffer");
    }

    evosOrdenadas.forEach((evo, idx) => {
        const data = parseEvolutionData(evo);

        // Si queda poco espacio en la página, agregar nueva página
        if (y > 240) {
            doc.addPage();
            startY = drawPatientHeader(doc, patient, clinicInfo, `HISTORIAL DE EVOLUCIONES (Pág. ${doc.internal.getNumberOfPages()})`);
            y = startY + 6;
        }

        // Caja de cada evolución
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.rect(15, y, 180, 6, "FD");

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`#${idx + 1}  —  ${formatDateTimeEs(data.fecha)}`, 18, y + 4.2);
        doc.setFont("helvetica", "normal");
        doc.text(`Dr(a): ${data.profesional}`, 120, y + 4.2);

        y += 9;
        doc.setFont("helvetica", "bold");
        doc.text("Dx:", 18, y);
        doc.setFont("helvetica", "normal");
        doc.text(data.diagnostico, 26, y);

        doc.setFont("helvetica", "bold");
        doc.text("Procedimiento:", 95, y);
        doc.setFont("helvetica", "normal");
        doc.text(data.procedimiento.substring(0, 40), 120, y);

        y += 6;
        doc.setFont("helvetica", "bold");
        doc.text("Notas:", 18, y);
        doc.setFont("helvetica", "normal");

        const splitNotas = doc.splitTextToSize(data.notas || "Sin observaciones.", 160);
        doc.text(splitNotas, 32, y);

        y += Math.max(splitNotas.length * 4.2, 6) + 6;

        // Línea punteada entre evoluciones
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(15, y - 2, 195, y - 2);
    });

    return doc.output("arraybuffer");
}

// Genera un documento PDF de resumen del Odontograma
export function generateOdontogramPdf(odontogramaData, patient, clinicInfo) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const startY = drawPatientHeader(doc, patient, clinicInfo, "REGISTRO Y ESTADO DEL ODONTOGRAMA");
    let y = startY + 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    if (!odontogramaData || Object.keys(odontogramaData).length === 0) {
        doc.text("No se registran hallazgos patológicos o tratamientos activos en el odontograma actual.", 18, y);
        return doc.output("arraybuffer");
    }

    doc.setFont("helvetica", "bold");
    doc.text("Resumen de Hallazgos y Superficies Registradas:", 18, y);
    y += 7;

    const entries = Object.entries(odontogramaData);
    entries.slice(0, 30).forEach(([diente, info]) => {
        if (y > 260) {
            doc.addPage();
            y = 25;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`Pieza Dental ${diente}:`, 18, y);
        doc.setFont("helvetica", "normal");
        const detalle = typeof info === "object" ? JSON.stringify(info) : String(info);
        doc.text(detalle.substring(0, 80), 45, y);
        y += 6;
    });

    return doc.output("arraybuffer");
}

// Genera un documento PDF de resumen del Periodontograma
export function generatePeriodontogramPdf(periodontoData, patient, clinicInfo) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const startY = drawPatientHeader(doc, patient, clinicInfo, "FICHA Y REPORTE DE PERIODONTOGRAMA");
    let y = startY + 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    if (!periodontoData || Object.keys(periodontoData).length === 0) {
        doc.text("No se registran datos de sondaje periodontal activo para este paciente.", 18, y);
        return doc.output("arraybuffer");
    }

    doc.setFont("helvetica", "bold");
    doc.text("Resumen de Sondajes Periodontales:", 18, y);
    y += 7;

    const dientes = Object.keys(periodontoData);
    dientes.slice(0, 25).forEach((d) => {
        if (y > 260) {
            doc.addPage();
            y = 25;
        }
        const dataDiente = periodontoData[d];
        doc.setFont("helvetica", "bold");
        doc.text(`Diente ${d}:`, 18, y);
        doc.setFont("helvetica", "normal");
        doc.text(JSON.stringify(dataDiente).substring(0, 80), 38, y);
        y += 6;
    });

    return doc.output("arraybuffer");
}

/**
 * Función Principal de Exportación de Copia de Seguridad
 * @param {Object} options
 * @param {string} options.tenantId
 * @param {Object} [options.clinicInfo]
 * @param {string} [options.evolutionMode] - 'both' | 'consolidated' | 'individual'
 * @param {boolean} [options.includeImages] - descargar imágenes al ZIP
 * @param {Function} [options.onProgress] - callback ({ current, total, patientName, phase })
 */
export async function generateClinicBackupZip({
    tenantId,
    clinicInfo = {},
    evolutionMode = "both",
    includeImages = true,
    onProgress = () => {}
}) {
    if (!tenantId) throw new Error("tenantId es requerido para generar la copia de seguridad");

    // 1. Obtener información de la clínica si no viene provista
    let finalClinicInfo = clinicInfo;
    if (!finalClinicInfo.nombre) {
        const { data: tenantData } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", tenantId)
            .maybeSingle();
        if (tenantData) {
            finalClinicInfo = {
                nombre: tenantData.nombre || tenantData.name || "Clínica Dental OdontoCloud",
                nit: tenantData.nit || "—",
                telefono: tenantData.telefono || tenantData.phone || "—",
                direccion: tenantData.direccion || tenantData.address || "—"
            };
        }
    }

    // 2. Obtener lista completa de pacientes del inquilino
    onProgress({ current: 0, total: 100, patientName: "Consultando directorio de pacientes...", phase: "init" });

    const { data: pacientes, error: pErr } = await supabase
        .from("pacientes")
        .select("*")
        .eq("tenant_id", tenantId);

    if (pErr) throw pErr;
    if (!pacientes || pacientes.length === 0) {
        throw new Error("No hay pacientes registrados en esta clínica para exportar.");
    }

    const zip = new JSZip();
    const total = pacientes.length;

    // Buffer de 0 bytes para los archivos 'placeholder' que garantizan que el ZIP mantenga la estructura de carpetas
    const emptyPlaceholder = new Uint8Array(0);

    for (let i = 0; i < total; i++) {
        const patient = pacientes[i];
        const nombrePaciente = `${patient.nombres || ""} ${patient.apellidos || ""}`.trim() || patient.nombre || "Paciente";
        const documento = patient.documento || patient.cedula || patient.id.substring(0, 8);
        const folderName = sanitizeFolderName(`${nombrePaciente} - ${documento}`);

        onProgress({
            current: i + 1,
            total,
            patientName: `${nombrePaciente} (${i + 1}/${total})`,
            phase: "processing"
        });

        // Crear la carpeta del paciente en la raíz del ZIP
        const patientFolder = zip.folder(folderName);
        patientFolder.file("placeholder", emptyPlaceholder);

        // Crear las 5 subcarpetas estándar requeridas
        const docsFolder = patientFolder.folder("Documentos clínicos");
        const evosFolder = patientFolder.folder("Evoluciones");
        const odontoFolder = patientFolder.folder("Odontogramas");
        const perioFolder = patientFolder.folder("Periodontogramas");
        const rxFolder = patientFolder.folder("Rx-Imagenes Oral");

        docsFolder.file("placeholder", emptyPlaceholder);
        evosFolder.file("placeholder", emptyPlaceholder);
        odontoFolder.file("placeholder", emptyPlaceholder);
        perioFolder.file("placeholder", emptyPlaceholder);
        rxFolder.file("placeholder", emptyPlaceholder);

        // --- A. EVOLUCIONES ---
        try {
            const { data: evoluciones } = await supabase
                .from("evoluciones")
                .select("*")
                .eq("paciente_id", patient.id)
                .order("fecha", { ascending: true });

            const evosList = evoluciones || [];

            if (evosList.length > 0) {
                // Modo 1: Consolidado (Siempre que sea 'both' o 'consolidated')
                if (evolutionMode === "both" || evolutionMode === "consolidated") {
                    const consolidatedBuf = generateConsolidatedEvolutionsPdf(evosList, patient, finalClinicInfo);
                    evosFolder.file("00_HISTORIAL_COMPLETO_EVOLUCIONES.pdf", consolidatedBuf);
                }

                // Modo 2: Individuales (Siempre que sea 'both' o 'individual')
                if (evolutionMode === "both" || evolutionMode === "individual") {
                    evosList.forEach((evo, idx) => {
                        const evoBuf = generateSingleEvolutionPdf(evo, patient, finalClinicInfo);
                        // Formato idéntico a OralDrive (UUID.pdf o fecha_UUID.pdf)
                        const evoDate = evo.fecha ? new Date(evo.fecha).toISOString().slice(0, 10) : "sin_fecha";
                        const fileName = `${evoDate}_${evo.id || idx + 1}.pdf`;
                        evosFolder.file(fileName, evoBuf);
                    });
                }
            }
        } catch (evoErr) {
            console.warn(`Aviso al exportar evoluciones de ${nombrePaciente}:`, evoErr);
        }

        // --- B. DOCUMENTOS CLÍNICOS ---
        try {
            const { data: docsClinicos } = await supabase
                .from("documentos_clinicos")
                .select("*")
                .eq("paciente_id", patient.id);

            if (docsClinicos && docsClinicos.length > 0) {
                docsClinicos.forEach((docItem, dIdx) => {
                    const docTitle = sanitizeFolderName(docItem.titulo || docItem.tipo || `Documento_${dIdx + 1}`);
                    const docPdf = new jsPDF();
                    drawPatientHeader(docPdf, patient, finalClinicInfo, (docItem.titulo || "DOCUMENTO CLÍNICO").toUpperCase());
                    docPdf.setFontSize(9);
                    docPdf.text(`Tipo: ${docItem.tipo || "General"}`, 18, 72);
                    docPdf.text(`Fecha: ${formatDateEs(docItem.created_at)}`, 120, 72);

                    const content = docItem.contenido || docItem.descripcion || JSON.stringify(docItem.metadata || {});
                    const split = docPdf.splitTextToSize(content, 174);
                    docPdf.text(split, 18, 82);

                    docsFolder.file(`${docTitle}_${docItem.id || dIdx + 1}.pdf`, docPdf.output("arraybuffer"));
                });
            }
        } catch (dErr) {
            console.warn(`Aviso al exportar documentos de ${nombrePaciente}:`, dErr);
        }

        // --- C. ODONTOGRAMAS ---
        try {
            const { data: odontoRows } = await supabase
                .from("odontogramas")
                .select("*")
                .eq("paciente_id", patient.id)
                .order("created_at", { ascending: false });

            if (odontoRows && odontoRows.length > 0) {
                const odontoPdf = generateOdontogramPdf(odontoRows[0].data, patient, finalClinicInfo);
                odontoFolder.file("Odontograma_Actual.pdf", odontoPdf);
                odontoFolder.file("odontograma_data.json", JSON.stringify(odontoRows[0].data, null, 2));
            }
        } catch (oErr) {
            console.warn(`Aviso al exportar odontograma de ${nombrePaciente}:`, oErr);
        }

        // --- D. PERIODONTOGRAMAS ---
        try {
            const perioData = patient.periodontograma || patient.historial_medico?.periodontograma;
            if (perioData && Object.keys(perioData).length > 0) {
                const perioPdf = generatePeriodontogramPdf(perioData, patient, finalClinicInfo);
                perioFolder.file("Periodontograma.pdf", perioPdf);
                perioFolder.file("periodontograma_data.json", JSON.stringify(perioData, null, 2));
            }
        } catch (pErr2) {
            console.warn(`Aviso al exportar periodontograma de ${nombrePaciente}:`, pErr2);
        }

        // --- E. RX E IMÁGENES ORALES ---
        if (includeImages) {
            try {
                const currentHistorial = patient.historial_medico || {};
                const rxList = (Array.isArray(patient.rxImagenes) && patient.rxImagenes.length > 0)
                    ? patient.rxImagenes
                    : (Array.isArray(currentHistorial.rxImagenes) ? currentHistorial.rxImagenes : []);

                for (let rIdx = 0; rIdx < rxList.length; rIdx++) {
                    const imgItem = rxList[rIdx];
                    const imgUrl = imgItem.url || imgItem.path;
                    if (imgUrl) {
                        try {
                            const resolvedUrl = await resolvePrivateFileUrl(imgUrl, imgItem.path);
                            const finalFetchUrl = resolvedUrl || imgUrl;

                            if (finalFetchUrl.startsWith("http")) {
                                const response = await fetch(finalFetchUrl);
                                if (response.ok) {
                                    const imgBlob = await response.blob();
                                    const ext = imgItem.type?.includes("png") ? "png" : (imgItem.type?.includes("pdf") ? "pdf" : "jpg");
                                    const imgFileName = sanitizeFolderName(imgItem.title || imgItem.name || `Imagen_${rIdx + 1}`) + `.${ext}`;
                                    rxFolder.file(imgFileName, imgBlob);
                                }
                            }
                        } catch (fetchErr) {
                            console.warn(`No se pudo descargar imagen ${rIdx} para ${nombrePaciente}:`, fetchErr);
                        }
                    }
                }
            } catch (rxErr) {
                console.warn(`Aviso al exportar imágenes de ${nombrePaciente}:`, rxErr);
            }
        }
    }

    onProgress({ current: total, total, patientName: "Comprimiendo archivo ZIP final...", phase: "compressing" });

    // Generar archivo ZIP binario
    const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    return {
        blob: zipBlob,
        fileName: `${tenantId}_backup.zip`,
        totalPatients: total
    };
}
