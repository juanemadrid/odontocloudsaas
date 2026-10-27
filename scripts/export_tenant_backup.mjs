// scripts/export_tenant_backup.mjs
/**
 * Script CLI para generar Copia de Seguridad (ZIP Formato OralDrive) desde consola
 * Uso: node scripts/export_tenant_backup.mjs [tenant_id] [modo_evolucion: both|individual|consolidated]
 */

import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { createClient } from "@supabase/supabase-js";
import {
    sanitizeFolderName,
    generateSingleEvolutionPdf,
    generateConsolidatedEvolutionsPdf,
    generateOdontogramPdf,
    generatePeriodontogramPdf
} from "../src/services/backupExportService.js";

// Leer variables de entorno
const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function main() {
    const tenantIdArg = process.argv[2];
    const evolutionMode = process.argv[3] || "both";

    console.log("==========================================================");
    console.log("   GENERADOR DE COPIA DE SEGURIDAD (ORALDRIVE ZIP)");
    console.log("==========================================================");

    let tenantId = tenantIdArg;

    if (!tenantId) {
        console.log("🔍 No se proporcionó tenant_id como argumento. Buscando clínicas disponibles...");
        const { data: tenants, error: tErr } = await supabase.from("tenants").select("id, nombre, nit").limit(10);
        if (tErr || !tenants || tenants.length === 0) {
            console.error("❌ No se pudieron listar inquilinos. Proporcione el tenant_id como argumento:", tErr?.message);
            process.exit(1);
        }
        console.log("Inquilinos encontrados:");
        tenants.forEach((t, i) => console.log(`  [${i + 1}] ${t.nombre} (${t.id})`));
        tenantId = tenants[0].id;
        console.log(`\n➡️ Usando primer inquilino por defecto: ${tenants[0].nombre} (${tenantId})`);
    }

    // 1. Obtener datos de la clínica
    const { data: tenantData } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
    const clinicInfo = {
        nombre: tenantData?.nombre || tenantData?.name || "Clínica Odontológica",
        nit: tenantData?.nit || "—",
        telefono: tenantData?.telefono || "—",
        direccion: tenantData?.direccion || "—"
    };

    console.log(`\n🏥 Clínica: ${clinicInfo.nombre} (NIT: ${clinicInfo.nit})`);
    console.log(`📦 Modo de evoluciones: ${evolutionMode}`);

    // 2. Obtener lista de pacientes
    const { data: pacientes, error: pErr } = await supabase
        .from("pacientes")
        .select("*")
        .eq("tenant_id", tenantId);

    if (pErr) {
        console.error("❌ Error al consultar pacientes:", pErr);
        process.exit(1);
    }

    if (!pacientes || pacientes.length === 0) {
        console.log("⚠️ No se encontraron pacientes registrados para este inquilino.");
        process.exit(0);
    }

    console.log(`👥 Total pacientes a procesar: ${pacientes.length}\n`);

    const zip = new JSZip();
    const emptyPlaceholder = Buffer.alloc(0);

    for (let i = 0; i < pacientes.length; i++) {
        const p = pacientes[i];
        const nombrePaciente = `${p.nombres || ""} ${p.apellidos || ""}`.trim() || p.nombre || "Paciente";
        const documento = p.documento || p.cedula || p.id.substring(0, 8);
        const folderName = sanitizeFolderName(`${nombrePaciente} - ${documento}`);

        process.stdout.write(`[${i + 1}/${pacientes.length}] Procesando ${folderName}... `);

        // Carpeta del paciente
        const patientFolder = zip.folder(folderName);
        patientFolder.file("placeholder", emptyPlaceholder);

        // Subcarpetas estándar
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

        // Evoluciones
        try {
            const { data: evoluciones } = await supabase
                .from("evoluciones")
                .select("*")
                .eq("paciente_id", p.id)
                .order("fecha", { ascending: true });

            const evosList = evoluciones || [];
            if (evosList.length > 0) {
                if (evolutionMode === "both" || evolutionMode === "consolidated") {
                    const consBuf = generateConsolidatedEvolutionsPdf(evosList, p, clinicInfo);
                    evosFolder.file("00_HISTORIAL_COMPLETO_EVOLUCIONES.pdf", Buffer.from(consBuf));
                }
                if (evolutionMode === "both" || evolutionMode === "individual") {
                    evosList.forEach((evo, idx) => {
                        const evoBuf = generateSingleEvolutionPdf(evo, p, clinicInfo);
                        const evoDate = evo.fecha ? new Date(evo.fecha).toISOString().slice(0, 10) : "sin_fecha";
                        evosFolder.file(`${evoDate}_${evo.id || idx + 1}.pdf`, Buffer.from(evoBuf));
                    });
                }
            }
        } catch (e) {
            // Ignorar errores menores
        }

        // Odontogramas
        try {
            const { data: odonto } = await supabase.from("odontogramas").select("*").eq("paciente_id", p.id).limit(1);
            if (odonto && odonto.length > 0) {
                const odontoPdf = generateOdontogramPdf(odonto[0].data, p, clinicInfo);
                odontoFolder.file("Odontograma_Actual.pdf", Buffer.from(odontoPdf));
            }
        } catch {}

        // Periodontogramas
        try {
            const perioData = p.periodontograma || p.historial_medico?.periodontograma;
            if (perioData && Object.keys(perioData).length > 0) {
                const perioPdf = generatePeriodontogramPdf(perioData, p, clinicInfo);
                perioFolder.file("Periodontograma.pdf", Buffer.from(perioPdf));
            }
        } catch {}

        console.log("OK");
    }

    console.log("\n📦 Comprimiendo archivo ZIP...");
    const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    const outDir = path.resolve("backups");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const outputFilePath = path.join(outDir, `${tenantId}_backup.zip`);
    fs.writeFileSync(outputFilePath, zipBuffer);

    console.log(`\n✅ Copia de seguridad generada con éxito!`);
    console.log(`📁 Ubicación: ${outputFilePath}`);
    console.log(`📏 Tamaño: ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
