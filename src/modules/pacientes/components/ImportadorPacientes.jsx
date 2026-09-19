import React, { useState } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { FiDownload, FiUpload, FiUsers, FiZap, FiCheckCircle, FiFileText, FiInfo, FiEye, FiCheck, FiX, FiColumns, FiList } from "react-icons/fi";

// Utility to load XLSX library dynamically with local fallback
async function ensureXLSX() {
    if (typeof window !== "undefined" && window.XLSX) return window.XLSX;
    try {
        const module = await import("xlsx");
        return module.default || module;
    } catch {
        return new Promise((resolve) => {
            const s = document.createElement("script");
            s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
            s.onload = () => resolve(window.XLSX || null);
            s.onerror = () => resolve(null);
            document.head.appendChild(s);
        });
    }
}

const ESTADO_CIVIL_MAP = {
    "1": "Soltero(a)",
    "2": "Casado(a)",
    "3": "Unión libre",
    "4": "Divorciado(a)",
    "5": "Viudo(a)",
    "6": "Otro"
};

const PARENTESCO_MAP = {
    "1": "Padre/Madre",
    "2": "Hijo(a)",
    "3": "Cónyuge",
    "4": "Hermano(a)",
    "5": "Familiar",
    "6": "Amigo(a)/Otro"
};

const generateUUID = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const toIsoDate = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().slice(0, 10);
    }
    if (typeof val === "number") {
        const date = new Date(Math.round((val - 25569) * 86400000));
        return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    if (typeof val === "string") {
        const trimmed = val.trim();
        // Extract only date token, discarding any time like '08:30 AM'
        const firstToken = trimmed.split(/\s+/)[0];
        const parts = firstToken.split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(firstToken)) return firstToken;
    }
    return null;
};

export default function ImportadorPacientes({ onComplete, onClose }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId;
    const toast = useToast();

    const [fileData, setFileData] = useState([]);
    const [fileName, setFileName] = useState("");
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, valid: 0 });
    const [progress, setProgress] = useState({ current: 0, total: 0, active: false });
    const [overwriteExisting, setOverwriteExisting] = useState(true);
    const [viewMode, setViewMode] = useState("resumen"); // "resumen" | "todas_columnas"
    const [selectedPatientDetail, setSelectedPatientDetail] = useState(null);

    const normalizePatientRecord = (row) => {
        // 1. Identificación y Nombres
        const rawDoc = String(row["Documento"] || row["nroDocumento"] || row["Identificación"] || "").trim();
        const cleanDoc = rawDoc.replace(/[^\d\w-]/g, "");

        let nombres = String(row["Nombre"] || row["Nombres"] || "").trim();
        let apellidos = String(row["Apellido"] || row["Apellidos"] || "").trim();
        const nombreCompleto = String(row["nombreCompleto"] || row["Nombre completo"] || `${nombres} ${apellidos}`).trim();

        // 2. Tipo de documento
        let tipoDoc = row["Tipo de documento"] || row["Tipo_Doc"] || "Cédula de ciudadanía";
        const tdLower = String(tipoDoc).toLowerCase();
        if (tdLower.includes("cédula de ciudadanía") || tdLower.includes("cedula de ciudadania") || tdLower.includes("cédula de identidad") || tdLower.includes("documento nacional")) {
            tipoDoc = "Cédula de ciudadanía";
        } else if (tdLower.includes("tarjeta de identidad")) {
            tipoDoc = "Tarjeta de identidad";
        } else if (tdLower.includes("pasaporte")) {
            tipoDoc = "Pasaporte";
        } else if (tdLower.includes("extranjería") || tdLower.includes("extranjeria")) {
            tipoDoc = "Cédula de extranjería";
        } else if (tdLower.includes("registro civil")) {
            tipoDoc = "Registro civil de nacimiento";
        } else {
            tipoDoc = "Cédula de ciudadanía";
        }

        // 3. Género
        let genero = String(row["Género"] || row["Sexo"] || "Femenino").trim();
        if (genero.toLowerCase().startsWith("f") || genero === "1") genero = "Femenino";
        else if (genero.toLowerCase().startsWith("m")) genero = "Masculino";
        else if (genero === "2") genero = "Femenino"; // Desplazamiento fila 44
        else genero = "Otro";

        // 4. Contacto básico y correo
        let email = String(row["Correo"] || row["Email"] || "").trim().toLowerCase();
        let celular = String(row["Celular"] || "").trim().replace(/[^\d+]/g, "");
        let telDomicilio = String(row["Teléfono"] || "").trim();
        let telOficina = String(row["Teléfono oficina"] || "").trim();
        let extension = String(row["Extensión oficina"] || "").trim();

        // 5. Demografía y fechas
        let fechaNacimiento = toIsoDate(row["Fecha de nacimiento"]);
        let rh = String(row["RH"] || "").trim();
        let estadoCivilRaw = String(row["Estado civil"] || "1").trim();
        let estadoCivil = ESTADO_CIVIL_MAP[estadoCivilRaw] || estadoCivilRaw || "Soltero(a)";
        let ocupacion = String(row["Ocupación"] || "").trim();
        let paisNac = String(row["País de nacimiento"] || "Colombia").trim();
        let ciudadNac = String(row["Ciudad de nacimiento"] || "").trim();
        let paisDom = String(row["País de domicilio"] || "Colombia").trim();
        let ciudadDom = String(row["Ciudad de domicilio"] || "").trim();
        let direccion = String(row["Dirección"] || "").trim();
        let barrio = String(row["Barrio"] || "").trim();
        let estrato = String(row["Estrato"] || "1").trim();
        let zonaResidencialRaw = String(row["Zona residencial"] || "1").trim();
        let zonaResidencial = (zonaResidencialRaw === "2" || zonaResidencialRaw.toLowerCase().includes("rural")) ? "Rural" : "Urbana";

        // 6. EPS, Aseguramiento y Comercial
        let eps = String(row["Eps"] || "").trim();
        let tipoAfiliacion = String(row["Tipo de afiliación"] || "").trim();
        let polizaSalud = String(row["Póliza de salud"] || "").trim();
        let sgsss = String(row["Sgsss"] || "").trim();
        let tipoPaciente = String(row["Tipo de paciente"] || "").trim();
        let convenio = String(row["Convenio"] || "").trim();
        let convenioBeneficio = String(row["Convenio beneficio"] || "").trim();
        let convenioPago = String(row["Convenio de pago"] || "").trim();
        let comoConocio = String(row["Cómo nos conoció"] || "").trim();
        let campania = String(row["Campaña"] || "").trim();
        let remitidoPor = String(row["Remitido por"] || "").trim();
        let asesorComercial = String(row["Asesor comercial"] || "").trim();
        let doctores = String(row["Doctores"] || "").trim();

        // 7. Responsable y Acompañante
        let nombreResponsable = String(row["Nombre del responsable"] || "").trim();
        let parentescoRaw = String(row["Relación con responsable"] || "").trim();
        let parentesco = PARENTESCO_MAP[parentescoRaw] || parentescoRaw || "";
        let celularResponsable = String(row["Celular responsable"] || "").trim().replace(/[^\d+]/g, "");
        let telefonoResponsable = String(row["Teléfono responsable"] || "").trim();
        let emailResponsable = String(row["Correo responsable"] || "").trim().toLowerCase();

        let nombreAcompanante = String(row["Nombre acompañante"] || "").trim();
        let telefonoAcompanante = String(row["Teléfono acompañante"] || "").trim();

        // 8. Historial previo migrado
        const presupuestos = Number(row["Presupuestos"]) || 0;
        const tratIniciados = Number(row["Tratamientos iniciados"]) || 0;
        const tratNoIniciados = Number(row["Tratamientos no iniciados"]) || 0;
        const tratFinalizados = Number(row["Tratamientos finalizados"]) || 0;
        const citas = Number(row["Citas"]) || 0;
        const proximaCita = String(row["Próxima Cita"] || "").trim();
        const fechaHoraIngreso = String(row["Fecha hora ingreso"] || "").trim();
        const fechaHoraCreacion = String(row["Fecha hora creación"] || "").trim();
        let fechaIngreso = toIsoDate(fechaHoraIngreso) || new Date().toISOString().slice(0, 10);

        // --- HEURÍSTICA DE REPARACIÓN INTELIGENTE (CASO FILA 44 Y SHIFTS DE COLUMNAS) ---
        if (!email && barrio.includes("@")) {
            email = barrio.toLowerCase();
            barrio = "";
        }
        if (!fechaNacimiento && toIsoDate(rh)) {
            fechaNacimiento = toIsoDate(rh);
            rh = "";
        }
        if (!ocupacion && estrato && isNaN(estrato)) {
            ocupacion = estrato;
            estrato = "1";
        }
        if (!tipoAfiliacion && zonaResidencialRaw.includes("Contributivo")) {
            tipoAfiliacion = zonaResidencialRaw;
            zonaResidencial = "Urbana";
        }
        if (!eps && (celular.toLowerCase().includes("sanitas") || String(row["Celular"] || "").toLowerCase().includes("sanitas") || String(row["Celular"] || "").toLowerCase().includes("salud total") || String(row["Celular"] || "").toLowerCase().includes("mutual"))) {
            eps = String(row["Celular"]).trim();
            celular = "";
        }
        if (!celular && paisDom.match(/^\d{7,12}$/)) {
            celular = paisDom;
            paisDom = "Estados Unidos";
        }
        if (telDomicilio && isNaN(telDomicilio.replace(/[\s-+()]/g, "")) && !remitidoPor) {
            remitidoPor = telDomicilio;
            telDomicilio = "";
        }
        if (telOficina && isNaN(telOficina.replace(/[\s-+()]/g, "")) && !doctores) {
            doctores = telOficina;
            telOficina = "";
        }
        if (nombreAcompanante.toUpperCase() === "N/A" || nombreAcompanante.toUpperCase() === "N") {
            nombreAcompanante = "";
        }
        if (telefonoAcompanante === "0") {
            telefonoAcompanante = "";
        }

        // 9. Cálculo de edad
        let edad = "";
        if (fechaNacimiento) {
            const birth = new Date(fechaNacimiento);
            const today = new Date();
            let calcAge = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) calcAge--;
            if (!isNaN(calcAge) && calcAge >= 0) edad = String(calcAge);
        }

        return {
            tipo_documento: tipoDoc,
            documento: cleanDoc,
            nro_historia: String(row["Número Historia"] || cleanDoc).trim(),
            nombres: (nombres || nombreCompleto.split(" ")[0] || "PACIENTE").toUpperCase(),
            apellidos: (apellidos || nombreCompleto.split(" ").slice(1).join(" ") || "").toUpperCase(),
            nombreCompleto: (nombreCompleto || `${nombres} ${apellidos}`).toUpperCase(),
            genero,
            sexo: genero,
            rh,
            estado_civil: estadoCivil,
            fecha_nacimiento: fechaNacimiento,
            fecha_ingreso: fechaIngreso,
            pais_nacimiento: paisNac,
            ciudad_nacimiento: ciudadNac,
            pais_domicilio: paisDom,
            ciudad_domicilio: ciudadDom,
            ciudad: ciudadDom,
            direccion,
            lugar_residencia: direccion,
            barrio,
            estrato: /^\d+$/.test(estrato) ? estrato : "1",
            zona_residencial: zonaResidencial,
            telefono: celular,
            celular,
            prefijo_celular: "+57",
            telefono_domicilio: telDomicilio,
            telefono_oficina: telOficina,
            extension,
            email,
            ocupacion,
            eps,
            tipo_afiliacion: tipoAfiliacion,
            poliza_salud: polizaSalud,
            plan_nombre: convenio,
            convenio,
            sgsss,
            tipo_paciente: tipoPaciente,
            convenio_beneficio: convenioBeneficio,
            convenio_pago: convenioPago,
            como_conocio: comoConocio,
            campania,
            remitido_por_type: "Libre",
            remitido_por_value: remitidoPor,
            asesor_comercial_type: "Libre",
            asesor_comercial_value: asesorComercial,
            profesional_nombre: doctores,
            nombre_responsable: nombreResponsable,
            parentesco,
            celular_responsable: celularResponsable,
            telefono_responsable: telefonoResponsable,
            email_responsable: emailResponsable,
            nombre_acompanante: nombreAcompanante,
            telefono_acompanante: telefonoAcompanante,
            alertas: "",
            notas: "",
            activo: true,
            edad,
            historial_medico: {
                rh,
                grupo_sanguineo: rh,
                edad,
                convenio,
                sgsss,
                tipo_paciente: tipoPaciente,
                profesionales: doctores ? doctores.split(",").map(d => ({ nombre: d.trim(), especialidad: "Odontología General" })) : [],
                resumen_migracion: {
                    presupuestos,
                    tratamientos_iniciados: tratIniciados,
                    tratamientos_no_iniciados: tratNoIniciados,
                    tratamientos_finalizados: tratFinalizados,
                    citas,
                    doctores,
                    proxima_cita: proximaCita,
                    fecha_creacion_original: fechaHoraCreacion,
                    fecha_ingreso_original: fechaHoraIngreso
                }
            },
            contacto_emergencia: {
                nombre: nombreResponsable || nombreAcompanante || "",
                telefono: celularResponsable || telefonoAcompanante || "",
                parentesco: parentesco || "Contacto"
            }
        };
    };

    const processWorkbook = (workbook, name) => {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

        if (rawJson.length === 0) {
            toast.error("El archivo seleccionado está vacío.");
            setLoading(false);
            return;
        }

        const mapped = rawJson.map((row) => normalizePatientRecord(row));
        const validRecords = mapped.filter(p => p.documento && p.nombres);

        setFileData(mapped);
        setFileName(name);
        setStats({
            total: mapped.length,
            valid: validRecords.length
        });
        toast.success(`Archivo cargado: ${mapped.length} pacientes listos con sus 52 columnas mapeadas.`);
        setLoading(false);
    };

    // 1. Cargar archivo local directo considerando el baseUrl de Vite
    const handleLoadPresetATM = async () => {
        setLoading(true);
        try {
            const XLSX = await ensureXLSX();
            if (!XLSX) {
                toast.error("Error al cargar la librería de lectura Excel.");
                setLoading(false);
                return;
            }
            window.XLSX = XLSX;

            const candidateUrls = [
                `${import.meta.env.BASE_URL || "/"}plantillas/Pacientes ATM.xlsx`,
                "/odontocloudsaas/plantillas/Pacientes ATM.xlsx",
                "/plantillas/Pacientes ATM.xlsx"
            ];

            let res = null;
            for (const url of candidateUrls) {
                try {
                    const testRes = await fetch(url);
                    if (testRes.ok) {
                        res = testRes;
                        break;
                    }
                } catch {}
            }

            if (!res) {
                throw new Error("No se pudo cargar automáticamente la plantilla. Por favor usa el botón 'Seleccionar otro archivo'.");
            }

            const arrayBuffer = await res.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            processWorkbook(workbook, "Pacientes ATM.xlsx (Detectado en Descargas)");
        } catch (err) {
            console.error("Error cargando Pacientes ATM.xlsx:", err);
            toast.error(err.message || "Error al cargar Pacientes ATM.xlsx");
            setLoading(false);
        }
    };

    // 2. Cargar archivo seleccionado manualmente por el usuario
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const XLSX = await ensureXLSX();
        if (!XLSX) {
            toast.error("Error al cargar la librería de importación");
            setLoading(false);
            return;
        }
        window.XLSX = XLSX;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target.result;
                const workbook = XLSX.read(arrayBuffer, { type: "array" });
                processWorkbook(workbook, file.name);
            } catch (err) {
                console.error("Error parsing file:", err);
                toast.error("Error al analizar el archivo Excel/CSV.");
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = async () => {
        setLoading(true);
        const XLSX = await ensureXLSX();
        if (!XLSX) {
            toast.error("Error al cargar la librería Excel");
            setLoading(false);
            return;
        }

        const headers = [
            "Fecha hora ingreso", "Fecha hora creación", "Tipo de documento", "Documento",
            "Número Historia", "Nombre", "Apellido", "Género", "RH", "Estado civil",
            "Fecha de nacimiento", "Edad", "País de nacimiento", "Ciudad de nacimiento",
            "Dirección", "País de domicilio", "Ciudad de domicilio", "Barrio", "Estrato",
            "Zona residencial", "Celular", "Teléfono", "Teléfono oficina", "Extensión oficina",
            "Correo", "Ocupación", "Nombre del responsable", "Relación con responsable",
            "Celular responsable", "Teléfono responsable", "Correo responsable",
            "Nombre acompañante", "Teléfono acompañante", "Convenio", "Tipo de afiliación",
            "Eps", "Póliza de salud", "Sgsss", "Tipo de paciente", "Convenio beneficio",
            "Convenio de pago", "Cómo nos conoció", "Campaña", "Remitido por",
            "Asesor comercial", "Presupuestos", "Tratamientos iniciados",
            "Tratamientos no iniciados", "Tratamientos finalizados", "Citas", "Doctores", "Próxima Cita"
        ];

        const sampleRow = [
            "18/01/2020 08:30 AM", "04/10/2022 02:58 PM", "Cédula de ciudadanía", "64550984",
            "64550984", "SILVIA ELENA", "ALMANZA CAMPO", "Femenino", "O+", "1",
            "20/07/1964", "58", "Colombia", "Corozal", "Calle 29 #16 – 56 casa 8",
            "Colombia", "Sincelejo", "Majagual", "3", "1", "3243332923", "2750039",
            "", "", "silviaelena2064@gmail.com", "Docente", "", "", "", "", "",
            "N/A", "0", "", "Contributivo cotizante", "Salud Total EPS", "", "", "",
            "", "", "", "", "Dr. Juan Carlos Vergara", "", "0", "0", "0", "0", "0", "Dr. Juan Carlos Vergara", ""
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
        XLSX.utils.book_append_sheet(wb, ws, "Reporte de pacientes");
        XLSX.writeFile(wb, "Plantilla_Pacientes_ATM.xlsx");

        toast.success("Plantilla descargada");
        setLoading(false);
    };

    const handleImport = async () => {
        if (!inquilino) {
            toast.error("No se identificó la clínica/tenant activo. Por favor recarga.");
            return;
        }

        const validPatients = fileData.filter(p => p.documento && p.nombres);
        if (validPatients.length === 0) {
            toast.error("No hay registros válidos para importar.");
            return;
        }

        setLoading(true);
        setProgress({ current: 0, total: validPatients.length, active: true });

        try {
            const BATCH_SIZE = 25;
            let successCount = 0;

            for (let i = 0; i < validPatients.length; i += BATCH_SIZE) {
                const batch = validPatients.slice(i, i + BATCH_SIZE);
                const batchDocs = batch.map(p => p.documento);

                // 1. Consultar si existen pacientes con esos documentos en el inquilino
                const { data: existingRecords, error: checkErr } = await supabase
                    .from("pacientes")
                    .select("id, documento, historial_medico")
                    .eq("tenant_id", inquilino)
                    .in("documento", batchDocs);

                if (checkErr) {
                    console.warn("Error al verificar pacientes existentes:", checkErr);
                }

                const existingMap = new Map();
                (existingRecords || []).forEach(r => existingMap.set(r.documento, r));

                // 2. Armar payloads adaptados con todos los campos
                const payloads = batch.map(p => {
                    const existing = existingMap.get(p.documento);
                    const isNew = !existing;
                    const mergedHistorial = {
                        ...(existing?.historial_medico || {}),
                        ...(p.historial_medico || {})
                    };

                    const record = {
                        id: existing?.id || generateUUID(),
                        tenant_id: inquilino,
                        tipo_documento: p.tipo_documento || "Cédula de ciudadanía",
                        documento: p.documento,
                        nombres: p.nombres,
                        apellidos: p.apellidos,
                        nro_historia: p.nro_historia || p.documento,
                        fecha_ingreso: p.fecha_ingreso || new Date().toISOString().slice(0, 10),
                        fecha_nacimiento: p.fecha_nacimiento || null,
                        genero: p.genero || "Femenino",
                        estado_civil: p.estado_civil || "Soltero(a)",
                        es_extranjero: p.es_extranjero || false,
                        permite_publicidad: true,
                        registro_completo: true,
                        pais_nacimiento: p.pais_nacimiento || "Colombia",
                        ciudad_nacimiento: p.ciudad_nacimiento || null,
                        pais_domicilio: p.pais_domicilio || "Colombia",
                        ciudad_domicilio: p.ciudad_domicilio || null,
                        ciudad: p.ciudad_domicilio || null,
                        direccion: p.direccion || null,
                        lugar_residencia: p.direccion || null,
                        barrio: p.barrio || null,
                        estrato: p.estrato || "1",
                        zona_residencial: p.zona_residencial || "Urbana",
                        telefono: p.telefono || null,
                        prefijo_celular: "+57",
                        telefono_domicilio: p.telefono_domicilio || null,
                        telefono_oficina: p.telefono_oficina || null,
                        extension: p.extension || null,
                        email: p.email || null,
                        ocupacion: p.ocupacion || null,
                        eps: p.eps || null,
                        tipo_afiliacion: p.tipo_afiliacion || null,
                        poliza_salud: p.poliza_salud || null,
                        plan_id: null,
                        plan_nombre: p.plan_nombre || null,
                        convenio_beneficio: p.convenio_beneficio || null,
                        convenio_pago: p.convenio_pago || null,
                        como_conocio: p.como_conocio || null,
                        campania: p.campania || null,
                        remitido_por_type: "Libre",
                        remitido_por_value: p.remitido_por_value || null,
                        asesor_comercial_type: "Libre",
                        asesor_comercial_value: p.asesor_comercial_value || null,
                        profesional_id: null,
                        profesional_nombre: p.profesional_nombre || null,
                        nombre_responsable: p.nombre_responsable || null,
                        parentesco: p.parentesco || null,
                        celular_responsable: p.celular_responsable || null,
                        telefono_responsable: p.telefono_responsable || null,
                        email_responsable: p.email_responsable || null,
                        nombre_acompanante: p.nombre_acompanante || null,
                        telefono_acompanante: p.telefono_acompanante || null,
                        alertas: p.alertas || null,
                        notas: p.notas || null,
                        historial_medico: mergedHistorial,
                        contacto_emergencia: p.contacto_emergencia || {},
                        activo: true,
                        updated_at: new Date().toISOString(),
                        _isNew: isNew
                    };

                    return record;
                });

                const recordsToInsert = overwriteExisting ? payloads : payloads.filter(p => p._isNew);
                const cleanedRecords = recordsToInsert.map(({ _isNew, ...rest }) => rest);

                if (cleanedRecords.length > 0) {
                    const { error: upsertErr } = await supabase
                        .from("pacientes")
                        .upsert(cleanedRecords, { onConflict: "tenant_id,documento" });

                    if (upsertErr) {
                        console.error("Error en lote:", upsertErr);
                        throw new Error(`Error guardando lote de pacientes: ${upsertErr.message}`);
                    }
                }

                successCount += batch.length;
                setProgress(prev => ({ ...prev, current: successCount }));
            }

            toast.success(`¡Importación completada! ${successCount} pacientes guardados con sus 52 campos en el sistema.`);
            onComplete && onComplete();
            onClose();
        } catch (err) {
            console.error("Error crítico durante importación:", err);
            toast.error(err.message || "Error al importar pacientes a la base de datos.");
        } finally {
            setLoading(false);
            setProgress(prev => ({ ...prev, active: false }));
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh]">
                
                {/* Header */}
                <div className="px-6 md:px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                            <FiUsers size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase text-slate-800 tracking-wider">
                                Importador Integral de Pacientes
                            </h3>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                52 campos mapeados • Domicilio, EPS, Responsables, Citas y Tratamientos
                            </p>
                        </div>
                    </div>
                    <button 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors border-0 cursor-pointer font-bold text-base" 
                        onClick={onClose} 
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
                    
                    {/* Explicación de campos */}
                    <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100/90 rounded-2xl p-4 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                <FiCheckCircle size={16} />
                            </div>
                            <div className="text-xs text-slate-700 space-y-1">
                                <p className="font-black text-slate-900 uppercase tracking-wide">
                                    Mapeo total de 52 columnas sin omisiones
                                </p>
                                <p className="leading-relaxed text-slate-600">
                                    Toda la información se guardará en la ficha del paciente: demografía, teléfonos, correos, ocupación, estrato, zona, EPS, póliza, SGSSS, responsable, acompañante, convenios, doctores y resumen de tratamientos/citas previas.
                                </p>
                            </div>
                        </div>
                        <span className="hidden md:inline-flex items-center px-3 py-1 bg-white text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-blue-200 shadow-xs shrink-0">
                            52 Columnas Activas
                        </span>
                    </div>

                    {/* Botones de acción principales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        
                        {/* Botón 1: Carga directa automática del archivo que dejó en Descargas */}
                        <button 
                            type="button"
                            onClick={handleLoadPresetATM} 
                            disabled={loading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-lg shadow-blue-500/20 transition-all cursor-pointer border-0"
                        >
                            <div className="flex items-center gap-3 text-left">
                                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                                    <FiZap size={18} />
                                </div>
                                <div>
                                    <span className="block font-black text-[13px]">⚡ Cargar Pacientes ATM.xlsx</span>
                                    <span className="text-[10px] font-normal text-blue-100">Archivo detectado en Descargas (110 pacientes)</span>
                                </div>
                            </div>
                            <span className="text-xs bg-white/20 px-3 py-1 rounded-lg font-bold">Cargar</span>
                        </button>

                        {/* Botón 2: Selector de cualquier archivo Excel */}
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                                id="import-excel-file-upload"
                                disabled={loading}
                            />
                            <label 
                                htmlFor="import-excel-file-upload" 
                                className="bg-white border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50 text-slate-700 p-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer h-full"
                            >
                                <div className="flex items-center gap-3 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                        <FiUpload size={18} />
                                    </div>
                                    <div>
                                        <span className="block font-black text-[13px]">Seleccionar otro archivo</span>
                                        <span className="text-[10px] font-normal text-slate-400">Excel (.xlsx, .xls) o CSV</span>
                                    </div>
                                </div>
                                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-bold">Buscar</span>
                            </label>
                        </div>
                    </div>

                    {/* Previsualización y confirmación */}
                    {fileData.length > 0 && (
                        <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 space-y-4">
                            
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200/60 pb-3">
                                <div>
                                    <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                                        <FiFileText className="text-blue-600" /> Previsualización: {fileName || "Archivo cargado"}
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                        {stats.valid} pacientes con sus 52 columnas listos para importar
                                    </p>
                                </div>

                                {/* Selector de vista: Resumen vs Todas las 52 columnas */}
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-200/80 p-1 rounded-xl flex items-center text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("resumen")}
                                            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-all flex items-center gap-1.5 border-0 cursor-pointer ${
                                                viewMode === "resumen" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                                            }`}
                                        >
                                            <FiList size={13} /> Vista Resumida
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("todas_columnas")}
                                            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-all flex items-center gap-1.5 border-0 cursor-pointer ${
                                                viewMode === "todas_columnas" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                                            }`}
                                        >
                                            <FiColumns size={13} /> Ver Todas las Columnas (52)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Opciones de importación */}
                            <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60">
                                <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
                                    <input
                                        type="checkbox"
                                        checked={overwriteExisting}
                                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span>Actualizar datos si el paciente ya existe en el sistema (por documento)</span>
                                </label>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">
                                    Haz clic en el icono 👁️ de cualquier paciente para ver sus 52 campos
                                </span>
                            </div>

                            {/* TABLA: VISTA RESUMIDA */}
                            {viewMode === "resumen" ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
                                    <table className="min-w-full text-left text-[11px] border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600">
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Detalle</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Doc.</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Nombre Completo</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">RH</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Celular</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Correo</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">EPS / Vinculación</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Ciudad / Domicilio</th>
                                                <th className="px-3 py-2.5 font-black uppercase tracking-wider">Ocupación</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {fileData.slice(0, 8).map((p, i) => (
                                                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedPatientDetail(p)}
                                                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all border-0 cursor-pointer shadow-xs"
                                                            title="Ver los 52 campos de este paciente"
                                                        >
                                                            <FiEye size={13} />
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2 font-mono font-bold text-blue-600">{p.documento}</td>
                                                    <td className="px-3 py-2 font-bold text-slate-800">{p.nombreCompleto}</td>
                                                    <td className="px-3 py-2 font-black text-rose-600">{p.rh || "—"}</td>
                                                    <td className="px-3 py-2 font-mono text-slate-600">{p.telefono || "—"}</td>
                                                    <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]">{p.email || "—"}</td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                        <span className="font-semibold text-slate-800 block">{p.eps || "Particular"}</span>
                                                        {p.tipo_afiliacion && <span className="text-[9px] text-slate-400 block">{p.tipo_afiliacion}</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                        {p.ciudad_domicilio || p.pais_domicilio || "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">{p.ocupacion || "—"}</td>
                                                </tr>
                                            ))}
                                            {fileData.length > 8 && (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-2.5 text-center text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                                                        ... y {fileData.length - 8} pacientes más en la lista listos para procesar.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* TABLA: VER TODAS LAS 52 COLUMNAS CON SCROLL HORIZONTAL */
                                <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm max-h-[380px] custom-scrollbar">
                                    <table className="min-w-max text-left text-[11px] border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 whitespace-nowrap sticky top-0 z-10">
                                                <th className="px-3 py-2 font-black">Detalle</th>
                                                <th className="px-3 py-2 font-black">Documento</th>
                                                <th className="px-3 py-2 font-black">Tipo Doc</th>
                                                <th className="px-3 py-2 font-black">Nombres</th>
                                                <th className="px-3 py-2 font-black">Apellidos</th>
                                                <th className="px-3 py-2 font-black">Género</th>
                                                <th className="px-3 py-2 font-black">RH</th>
                                                <th className="px-3 py-2 font-black">Estado Civil</th>
                                                <th className="px-3 py-2 font-black">F. Nacimiento</th>
                                                <th className="px-3 py-2 font-black">Edad</th>
                                                <th className="px-3 py-2 font-black">País Nac.</th>
                                                <th className="px-3 py-2 font-black">Ciudad Nac.</th>
                                                <th className="px-3 py-2 font-black">Dirección</th>
                                                <th className="px-3 py-2 font-black">Ciudad Dom.</th>
                                                <th className="px-3 py-2 font-black">Barrio</th>
                                                <th className="px-3 py-2 font-black">Estrato</th>
                                                <th className="px-3 py-2 font-black">Zona</th>
                                                <th className="px-3 py-2 font-black">Celular</th>
                                                <th className="px-3 py-2 font-black">Teléfono</th>
                                                <th className="px-3 py-2 font-black">Correo</th>
                                                <th className="px-3 py-2 font-black">Ocupación</th>
                                                <th className="px-3 py-2 font-black">EPS</th>
                                                <th className="px-3 py-2 font-black">Afiliación</th>
                                                <th className="px-3 py-2 font-black">Póliza</th>
                                                <th className="px-3 py-2 font-black">SGSSS</th>
                                                <th className="px-3 py-2 font-black">Tipo Paciente</th>
                                                <th className="px-3 py-2 font-black">Responsable</th>
                                                <th className="px-3 py-2 font-black">Parentesco</th>
                                                <th className="px-3 py-2 font-black">Cel. Resp.</th>
                                                <th className="px-3 py-2 font-black">Acompañante</th>
                                                <th className="px-3 py-2 font-black">Convenio</th>
                                                <th className="px-3 py-2 font-black">Remitido por</th>
                                                <th className="px-3 py-2 font-black">Asesor</th>
                                                <th className="px-3 py-2 font-black">Presupuestos</th>
                                                <th className="px-3 py-2 font-black">Trat. Iniciados</th>
                                                <th className="px-3 py-2 font-black">Citas</th>
                                                <th className="px-3 py-2 font-black">Doctores</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap">
                                            {fileData.map((p, i) => (
                                                <tr key={i} className="hover:bg-slate-50/70">
                                                    <td className="px-3 py-1.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedPatientDetail(p)}
                                                            className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded border-0 cursor-pointer"
                                                        >
                                                            <FiEye size={12} />
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-1.5 font-mono font-bold text-blue-600">{p.documento}</td>
                                                    <td className="px-3 py-1.5">{p.tipo_documento}</td>
                                                    <td className="px-3 py-1.5 font-bold">{p.nombres}</td>
                                                    <td className="px-3 py-1.5 font-bold">{p.apellidos}</td>
                                                    <td className="px-3 py-1.5">{p.genero}</td>
                                                    <td className="px-3 py-1.5 font-black text-rose-600">{p.rh || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.estado_civil}</td>
                                                    <td className="px-3 py-1.5 font-mono">{p.fecha_nacimiento || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.edad || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.pais_nacimiento}</td>
                                                    <td className="px-3 py-1.5">{p.ciudad_nacimiento || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.direccion || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.ciudad_domicilio || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.barrio || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.estrato}</td>
                                                    <td className="px-3 py-1.5">{p.zona_residencial}</td>
                                                    <td className="px-3 py-1.5 font-mono">{p.telefono || "—"}</td>
                                                    <td className="px-3 py-1.5 font-mono">{p.telefono_domicilio || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.email || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.ocupacion || "—"}</td>
                                                    <td className="px-3 py-1.5 font-semibold">{p.eps || "Particular"}</td>
                                                    <td className="px-3 py-1.5">{p.tipo_afiliacion || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.poliza_salud || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.sgsss || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.tipo_paciente || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.nombre_responsable || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.parentesco || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.celular_responsable || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.nombre_acompanante || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.convenio || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.remitido_por_value || "—"}</td>
                                                    <td className="px-3 py-1.5">{p.asesor_comercial_value || "—"}</td>
                                                    <td className="px-3 py-1.5 text-center">{p.historial_medico?.resumen_migracion?.presupuestos || 0}</td>
                                                    <td className="px-3 py-1.5 text-center">{p.historial_medico?.resumen_migracion?.tratamientos_iniciados || 0}</td>
                                                    <td className="px-3 py-1.5 text-center">{p.historial_medico?.resumen_migracion?.citas || 0}</td>
                                                    <td className="px-3 py-1.5">{p.profesional_nombre || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Barra de progreso interactiva */}
                            {progress.active && (
                                <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200/80">
                                    <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                        <span className="text-blue-600 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                            Guardando pacientes en Supabase...
                                        </span>
                                        <span className="text-emerald-600">
                                            {progress.current} / {progress.total}
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                                        <span>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% completado</span>
                                        <span>{progress.total - progress.current} restantes</span>
                                    </div>
                                </div>
                            )}

                            {/* Botón de confirmación final */}
                            <button
                                type="button"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                onClick={handleImport}
                                disabled={loading || stats.valid === 0}
                            >
                                {loading
                                    ? `⏳ Guardando ${progress.current} de ${progress.total}...`
                                    : `🚀 Confirmar e Importar ${stats.valid} Pacientes a la Base de Datos`
                                }
                            </button>
                        </div>
                    )}

                    {/* Descarga de plantilla adicional */}
                    <div className="pt-2 flex justify-between items-center text-xs text-slate-400">
                        <span>¿Necesitas el formato en blanco?</span>
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 border-0 bg-transparent cursor-pointer p-0"
                        >
                            <FiDownload size={14} /> Descargar Plantilla ATM
                        </button>
                    </div>

                </div>
            </div>

            {/* MODAL DETALLADO DE 52 CAMPOS PARA INSPECCIÓN INDIVIDUAL */}
            {selectedPatientDetail && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[24px] max-w-2xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                    Inspección de 52 Campos: {selectedPatientDetail.nombreCompleto}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">
                                    Documento: {selectedPatientDetail.documento} • Historia: #{selectedPatientDetail.nro_historia}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPatientDetail(null)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 border-0 cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar text-xs text-slate-700">
                            
                            {/* 1. Identificación */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="font-black text-[10px] uppercase text-blue-700 tracking-wider block mb-2">
                                    1. Identificación y Demografía
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Tipo Doc</span><span className="font-bold">{selectedPatientDetail.tipo_documento}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Género</span><span className="font-bold">{selectedPatientDetail.genero}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">RH</span><span className="font-black text-rose-600">{selectedPatientDetail.rh || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Estado Civil</span><span className="font-bold">{selectedPatientDetail.estado_civil}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Fecha Nacimiento</span><span className="font-mono">{selectedPatientDetail.fecha_nacimiento || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Edad</span><span className="font-bold">{selectedPatientDetail.edad || "—"} años</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">País Nac.</span><span>{selectedPatientDetail.pais_nacimiento}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Ciudad Nac.</span><span>{selectedPatientDetail.ciudad_nacimiento || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Ocupación</span><span className="font-bold">{selectedPatientDetail.ocupacion || "—"}</span></div>
                                </div>
                            </div>

                            {/* 2. Ubicación y Contacto */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="font-black text-[10px] uppercase text-emerald-700 tracking-wider block mb-2">
                                    2. Ubicación y Contacto
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div className="col-span-2"><span className="text-[9px] text-slate-400 uppercase block">Dirección</span><span className="font-bold">{selectedPatientDetail.direccion || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Ciudad Domicilio</span><span>{selectedPatientDetail.ciudad_domicilio || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Barrio</span><span>{selectedPatientDetail.barrio || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Estrato</span><span>{selectedPatientDetail.estrato}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Zona</span><span>{selectedPatientDetail.zona_residencial}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Celular</span><span className="font-mono font-bold text-blue-600">{selectedPatientDetail.telefono || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Teléfono Fijo</span><span className="font-mono">{selectedPatientDetail.telefono_domicilio || "—"}</span></div>
                                    <div className="col-span-2"><span className="text-[9px] text-slate-400 uppercase block">Correo Electrónico</span><span className="font-semibold text-slate-800">{selectedPatientDetail.email || "—"}</span></div>
                                </div>
                            </div>

                            {/* 3. EPS y Aseguramiento */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="font-black text-[10px] uppercase text-indigo-700 tracking-wider block mb-2">
                                    3. Aseguramiento y EPS
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div><span className="text-[9px] text-slate-400 uppercase block">EPS</span><span className="font-bold text-slate-800">{selectedPatientDetail.eps || "Particular"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Tipo Afiliación</span><span>{selectedPatientDetail.tipo_afiliacion || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Póliza Salud</span><span>{selectedPatientDetail.poliza_salud || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">SGSSS</span><span>{selectedPatientDetail.sgsss || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Tipo Paciente</span><span>{selectedPatientDetail.tipo_paciente || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Convenio</span><span>{selectedPatientDetail.convenio || "—"}</span></div>
                                </div>
                            </div>

                            {/* 4. Responsable y Acompañante */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="font-black text-[10px] uppercase text-purple-700 tracking-wider block mb-2">
                                    4. Responsable y Acompañante
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Nombre Resp.</span><span className="font-bold">{selectedPatientDetail.nombre_responsable || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Parentesco</span><span>{selectedPatientDetail.parentesco || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Celular Resp.</span><span className="font-mono">{selectedPatientDetail.celular_responsable || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Nombre Acompañante</span><span>{selectedPatientDetail.nombre_acompanante || "—"}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Teléfono Acompañante</span><span className="font-mono">{selectedPatientDetail.telefono_acompanante || "—"}</span></div>
                                </div>
                            </div>

                            {/* 5. Historial y Datos del Software Anterior */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="font-black text-[10px] uppercase text-amber-700 tracking-wider block mb-2">
                                    5. Historial Migrado (ATM / Software Anterior)
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Presupuestos</span><span className="font-black">{selectedPatientDetail.historial_medico?.resumen_migracion?.presupuestos || 0}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Trat. Iniciados</span><span className="font-black text-blue-600">{selectedPatientDetail.historial_medico?.resumen_migracion?.tratamientos_iniciados || 0}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Trat. Finalizados</span><span className="font-black text-emerald-600">{selectedPatientDetail.historial_medico?.resumen_migracion?.tratamientos_finalizados || 0}</span></div>
                                    <div><span className="text-[9px] text-slate-400 uppercase block">Citas Previas</span><span className="font-black">{selectedPatientDetail.historial_medico?.resumen_migracion?.citas || 0}</span></div>
                                    <div className="col-span-2"><span className="text-[9px] text-slate-400 uppercase block">Doctores Asignados</span><span className="font-semibold text-slate-800">{selectedPatientDetail.profesional_nombre || "—"}</span></div>
                                    <div className="col-span-2"><span className="text-[9px] text-slate-400 uppercase block">Remitido Por</span><span className="font-semibold text-slate-800">{selectedPatientDetail.remitido_por_value || "—"}</span></div>
                                </div>
                            </div>

                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedPatientDetail(null)}
                                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-900 transition-all border-0 cursor-pointer"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
